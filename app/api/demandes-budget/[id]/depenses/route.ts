import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RECEVEUR_NON_PRECISE, receveurObligatoire } from "@/lib/budgetTypes";
import { ModePaiementDemande, NatureDepense, Prisma, SourceDepense } from "@prisma/client";
import prisma from "@/lib/prisma";
import { refusPetiteDepense, requireBudgetUser } from "@/lib/budgetAuth";
import { saveDemandeBudgetFiles, describeFsError, UploadRejectedError } from "@/lib/uploadDemandeBudget";
import { cloturerBudgetsMensuelsEchus, seuilsFranchis } from "@/lib/budgetSuivi";
import { sendAlerteConsommationNotification } from "@/lib/email/demandeBudget";
import { PaiementCommandeError } from "@/lib/commandeFournisseurSuivi";
import { DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";

const depenseSchema = z
  .object({
    ligneId: z.string().min(1, "La ligne de budget est requise."),
    montant: z.number().positive("Le montant doit être supérieur à 0."),
    dateDepense: z.string().min(1, "La date de la dépense est requise."),
    // Obligatoire sauf pour les budgets mensuels et de campagne (contrôlé plus bas selon le type).
    nomReceveur: z.string().trim().default(""),
    modePaiement: z.nativeEnum(ModePaiementDemande),
    cashRegisterId: z.number().int().positive("Choisissez la caisse concernée."),
    invoiceId: z.string().optional(),
    notes: z.string().optional(),
    sansJustificatif: z.boolean(),
    motifSansJustificatif: z.string().optional(),
    // Paiement fournisseur : avance ou solde d'un bon de commande financé par la ligne, sur une
    // ligne de produit du bon (ou « tout le bon », réparti au prorata).
    commandeId: z.string().optional(),
    nature: z.nativeEnum(NatureDepense).default(NatureDepense.NORMALE),
    ligneCommandeId: z.string().optional(),
    factureFournisseurId: z.string().optional(),
    // Saisie lancée depuis la fiche proforma (même opération, origine tracée).
    depuisProforma: z.boolean().optional(),
  })
  .refine((d) => d.nature === NatureDepense.NORMALE || !!d.commandeId, {
    message: "Choisissez le bon de commande concerné par cette avance ou ce solde.",
  });

/**
 * POST /api/demandes-budget/[id]/depenses — le comptable enregistre une dépense réelle sur une ligne
 * de budget (depuis la fiche budget, ou depuis la fiche proforma de la campagne). Tout est fait par
 * enregistrerDepense (lib/depenses/enregistrerDepense.ts) dans une seule transaction : contrôles du
 * budget, écriture dans la caisse choisie, dépense sur la proforma, bon de commande (imputation sur
 * la ligne de produit, facture et bon « payés »), historique et statut du budget.
 * Un justificatif n'est pas obligatoire, mais son absence doit être déclarée avec un motif.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  // Comptable (canPay), ou accueil (canPetiteDepense : petites dépenses en espèces, plafonnées —
  // contrôlées plus bas, une fois le montant connu).
  if (!caps.canPay && !caps.canPetiteDepense) {
    return NextResponse.json({ error: "Réservé au comptable habilité à enregistrer les dépenses." }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Un budget mensuel échu est clôturé avant toute nouvelle dépense (refusée ensuite).
    await cloturerBudgetsMensuelsEchus(prisma);

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
      commandeId: (formData.get("commandeId") as string) || undefined,
      nature: (formData.get("nature") as string) || undefined,
      ligneCommandeId: (formData.get("ligneCommandeId") as string) || undefined,
      factureFournisseurId: (formData.get("factureFournisseurId") as string) || undefined,
      depuisProforma: formData.get("depuisProforma") === "true",
    });
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const data = validation.data;

    // Receveur : facultatif pour un budget mensuel ou de campagne, obligatoire sinon.
    const demandeType = await prisma.demandeBudget.findUnique({ where: { id }, select: { type: true } });
    if (!data.nomReceveur && receveurObligatoire(demandeType?.type)) {
      return NextResponse.json({ error: "Le nom du receveur est requis." }, { status: 400 });
    }
    const nomReceveur = data.nomReceveur || RECEVEUR_NON_PRECISE;

    const refusPetite = refusPetiteDepense(caps, data);
    if (refusPetite) return NextResponse.json({ error: refusPetite }, { status: 403 });

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
    const dateDepense = new Date(data.dateDepense);
    const savedFiles = await saveDemandeBudgetFiles(id, preuves, {
      date: dateDepense,
      montant: data.montant,
      kind: "PREUVE_PAIEMENT",
    });

    const resultat = await prisma.$transaction(
      (tx) =>
        enregistrerDepense(tx, {
          source: data.depuisProforma ? SourceDepense.PROFORMA : SourceDepense.MANUEL,
          auteur: { userId: caps.userId, email: caps.email, name: caps.name },
          montant: data.montant,
          dateDepense,
          cashRegisterId: data.cashRegisterId,
          nomReceveur,
          modePaiement: data.modePaiement,
          notes: data.notes,
          ligneBudgetId: data.ligneId,
          demandeBudgetId: id,
          invoiceId: data.invoiceId,
          commandeId: data.commandeId,
          nature: data.nature,
          ligneCommandeId: data.ligneCommandeId,
          factureFournisseurId: data.factureFournisseurId,
          justificatifs: savedFiles,
          motifSansJustificatif: data.motifSansJustificatif,
        }),
      { timeout: 20000 }
    );

    // Alertes 80 % / 100 % de la ligne — hors transaction, un échec d'email ne bloque rien.
    const { demande, ligne, avant } = resultat;
    if (demande && ligne && avant) {
      const demandeEmail = await prisma.demandeBudget.findUnique({ where: { id: demande.id }, include: { lignes: true } });
      for (const seuil of seuilsFranchis(avant.consomme, avant.consomme + data.montant, avant.plafond)) {
        if (!demandeEmail) break;
        sendAlerteConsommationNotification(demandeEmail, {
          designation: ligne.designation,
          seuil,
          consomme: avant.consomme + data.montant,
          plafond: avant.plafond,
        }).catch((err) => console.error("Erreur lors de l'envoi de l'alerte de consommation:", err));
      }
    }

    return NextResponse.json(resultat.budgetDepense, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError || error instanceof UploadRejectedError || error instanceof PaiementCommandeError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error(`Erreur lors de l'enregistrement d'une dépense sur la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    const message =
      fsMessage ||
      (error instanceof Prisma.PrismaClientKnownRequestError ? "Erreur base de données." : error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
