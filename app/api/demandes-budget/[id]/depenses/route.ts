import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, ModePaiementDemande, Prisma, StatutDemandeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isSameEmail } from "@/lib/budgetAuth";
import { recordCashDepense, recordDepensePaiement } from "@/lib/paiements";
import { saveDemandeBudgetFiles, describeFsError } from "@/lib/uploadDemandeBudget";
import { BUDGET_EPSILON, getLigneDisponible, logBudget, recalculerStatutBudget, seuilsFranchis } from "@/lib/budgetSuivi";
import { sendAlerteConsommationNotification } from "@/lib/email/demandeBudget";

/** Erreur métier → réponse 400 avec le message tel quel. */
class BudgetDepenseError extends Error {}

const depenseSchema = z
  .object({
    ligneId: z.string().min(1, "La ligne de budget est requise."),
    montant: z.number().positive("Le montant doit être supérieur à 0."),
    dateDepense: z.string().min(1, "La date de la dépense est requise."),
    nomReceveur: z.string().trim().min(1, "Le nom du receveur est requis."),
    modePaiement: z.nativeEnum(ModePaiementDemande),
    cashRegisterId: z.number().int().positive("Choisissez la caisse concernée."),
    invoiceId: z.string().optional(),
    notes: z.string().optional(),
    sansJustificatif: z.boolean(),
    motifSansJustificatif: z.string().optional(),
  });

/**
 * POST /api/demandes-budget/[id]/depenses — le comptable enregistre une dépense réelle sur une
 * ligne de budget. Celui qui a validé le budget ne peut pas en enregistrer les dépenses
 * (séparation des tâches). Dans une seule transaction :
 *   1. vérifie le reste disponible de la ligne (prévu + dépassements approuvés − dépenses actives) ;
 *   2. crée l'écriture DEPENSE dans le journal de la caisse choisie (solde vérifié) — et, si le
 *      budget est lié à une proforma, le Paiement DEPENSE de cette proforma (marge juste) ;
 *   3. crée la BudgetDepense rattachée à cette écriture, avec ses justificatifs ;
 *   4. passe la demande en EN_COURS, ou PAYEE si toutes ses lignes sont soldées.
 * Un justificatif n'est pas obligatoire, mais son absence doit être déclarée avec un motif.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canPay) {
    return NextResponse.json({ error: "Réservé au comptable habilité à enregistrer les dépenses." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const formData = await request.formData();
    const preuves = (formData.getAll("preuves") as File[]).filter((f) => f && f.size > 0);

    const validation = depenseSchema.safeParse({
      ligneId: formData.get("ligneId"),
      montant: Number(formData.get("montant")),
      dateDepense: formData.get("dateDepense"),
      nomReceveur: formData.get("nomReceveur") ?? "",
      modePaiement: formData.get("modePaiement"),
      cashRegisterId: Number(formData.get("cashRegisterId")),
      invoiceId: (formData.get("invoiceId") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      sansJustificatif: formData.get("sansJustificatif") === "true",
      motifSansJustificatif: ((formData.get("motifSansJustificatif") as string) || "").trim() || undefined,
    });
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const data = validation.data;

    // Justificatif : un fichier, OU une absence déclarée avec motif — jamais un oubli silencieux.
    if (preuves.length === 0 && !data.sansJustificatif) {
      return NextResponse.json(
        { error: "Joignez un justificatif, ou cochez « Dépense sans justificatif » en indiquant le motif." },
        { status: 400 }
      );
    }
    if (preuves.length === 0 && !data.motifSansJustificatif) {
      return NextResponse.json({ error: "Indiquez le motif de l'absence de justificatif." }, { status: 400 });
    }

    // Fichiers écrits avant la transaction (le disque n'est pas transactionnel) : en cas d'échec
    // de la transaction, seuls des fichiers orphelins restent, jamais une dépense sans sa pièce.
    const savedFiles = await saveDemandeBudgetFiles(id, preuves);
    const dateDepense = new Date(data.dateDepense);

    const { depense, demande, ligne, avant } = await prisma.$transaction(
      async (tx) => {
        const demande = await tx.demandeBudget.findUnique({
          where: { id },
          include: { lignes: true, proformas: { include: { invoice: { select: { id: true, numero: true } } } } },
        });
        if (!demande) throw new BudgetDepenseError("Demande introuvable.");
        if (demande.statut !== StatutDemandeBudget.VALIDEE && demande.statut !== StatutDemandeBudget.EN_COURS) {
          throw new BudgetDepenseError("Les dépenses ne peuvent être enregistrées que sur un budget validé et non clôturé.");
        }
        if (isSameEmail(demande.validatedByEmail, caps.email)) {
          throw new BudgetDepenseError(
            "Vous avez validé ce budget : ses dépenses doivent être enregistrées par une autre personne (séparation des tâches)."
          );
        }

        const ligne = demande.lignes.find((l) => l.id === data.ligneId);
        if (!ligne) throw new BudgetDepenseError("Cette ligne n'appartient pas à ce budget.");

        // Verrou sur la ligne : deux dépenses simultanées ne peuvent pas dépasser le plafond ensemble.
        await tx.$queryRaw`SELECT id FROM "DemandeBudgetLigne" WHERE id = ${ligne.id} FOR UPDATE`;
        const avant = await getLigneDisponible(tx, ligne);
        if (data.montant > avant.reste + BUDGET_EPSILON) {
          throw new BudgetDepenseError(
            `Budget de la ligne « ${ligne.designation} » atteint : il reste ${Math.max(avant.reste, 0).toLocaleString("fr-FR")} FCFA. Demandez un dépassement pour aller au-delà.`
          );
        }

        // Budget lié à une ou plusieurs proformas (CAMPAGNE, ou TIERS avec proforma) : la dépense
        // est imputée à l'une d'elles. Une seule → choisie d'office ; plusieurs → choix explicite.
        let invoiceId: string | null = null;
        if (demande.proformas.length > 0) {
          invoiceId = data.invoiceId ?? (demande.proformas.length === 1 ? demande.proformas[0].invoiceId : null);
          if (!invoiceId) throw new BudgetDepenseError("Choisissez la proforma à laquelle imputer cette dépense.");
          if (!demande.proformas.some((p) => p.invoiceId === invoiceId)) {
            throw new BudgetDepenseError("Cette proforma n'est pas liée à ce budget.");
          }
        }

        const libelle = `Budget ${demande.numero} — ${ligne.designation} — ${data.nomReceveur}`;
        const cashJournalEntry = invoiceId
          ? (
              await recordDepensePaiement(tx, {
                invoiceId,
                cashRegisterId: data.cashRegisterId,
                montant: data.montant,
                libelle,
                date_operation: dateDepense,
                methode: data.modePaiement,
                reference: demande.numero,
                notes: data.notes,
                createdById: caps.userId,
              })
            ).cashJournalEntry
          : await recordCashDepense(tx, {
              cashRegisterId: data.cashRegisterId,
              montant: data.montant,
              libelle,
              date_operation: dateDepense,
              createdById: caps.userId,
            });

        const created = await tx.budgetDepense.create({
          data: {
            demandeBudgetId: id,
            ligneId: ligne.id,
            montant: data.montant,
            dateDepense,
            nomReceveur: data.nomReceveur,
            modePaiement: data.modePaiement,
            notes: data.notes,
            cashRegisterId: data.cashRegisterId,
            cashJournalEntryId: cashJournalEntry.id,
            invoiceId,
            sansJustificatif: savedFiles.length === 0,
            motifSansJustificatif: savedFiles.length === 0 ? data.motifSansJustificatif : null,
            createdByEmail: caps.email,
          },
        });

        if (savedFiles.length > 0) {
          await tx.demandeBudgetAttachment.createMany({
            data: savedFiles.map((f) => ({ demandeBudgetId: id, depenseId: created.id, kind: "PREUVE_PAIEMENT" as const, ...f })),
          });
        }

        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.DEPENSE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: data.montant,
          details: `${ligne.designation} — ${data.nomReceveur} — caisse n° ${data.cashRegisterId}, écriture n° ${cashJournalEntry.id}${savedFiles.length === 0 ? ` — SANS JUSTIFICATIF (${data.motifSansJustificatif})` : ""}`,
        });

        // Toutes les lignes soldées → budget entièrement consommé (PAYEE), sinon EN_COURS.
        await recalculerStatutBudget(tx, id, { datePaiement: dateDepense, nomReceveur: data.nomReceveur });

        return { depense: created, demande, ligne, avant };
      },
      { timeout: 20000 }
    );

    // Alertes 80 % / 100 % de la ligne — hors transaction, un échec d'email ne bloque rien.
    for (const seuil of seuilsFranchis(avant.consomme, avant.consomme + data.montant, avant.plafond)) {
      sendAlerteConsommationNotification(
        demande,
        { designation: ligne.designation, seuil, consomme: avant.consomme + data.montant, plafond: avant.plafond }
      ).catch((err) => console.error("Erreur lors de l'envoi de l'alerte de consommation:", err));
    }

    return NextResponse.json(depense, { status: 201 });
  } catch (error) {
    if (error instanceof BudgetDepenseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // "Solde insuffisant…" levé par recordCashDepense : erreur métier, pas une panne serveur.
    if (error instanceof Error && error.message.startsWith("Solde insuffisant")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de l'enregistrement d'une dépense sur la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    const message =
      fsMessage ||
      (error instanceof Prisma.PrismaClientKnownRequestError ? "Erreur base de données." : error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
