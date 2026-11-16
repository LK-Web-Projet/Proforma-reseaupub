import { NextRequest, NextResponse } from "next/server";
import { ActionBudget, Prisma, StatutDemandeBudget, StatutDepassement, TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logBudget, budgetMensuelExistant, cloturerBudgetsMensuelsEchus, montantAccordeLigne } from "@/lib/budgetSuivi";
import { requireBudgetUser, isImpliqueBudget } from "@/lib/budgetAuth";
import { parseDemandeBudgetFormData, toPeriodeMois, firstZodMessage, lignesAvecMode } from "@/lib/budgetSchema";
import { saveTypedDemandeBudgetAttachments, assertTypedAttachmentsAllowed, describeFsError, UploadRejectedError } from "@/lib/uploadDemandeBudget";
import { sendDemandeSoumiseNotification } from "@/lib/email/demandeBudget";
import { etatJustificatif } from "@/lib/justificatifs";

// GET /api/demandes-budget - Liste des demandes de budget
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    // Clôture automatique des budgets mensuels échus (idempotente, voir lib/budgetSuivi.ts).
    await cloturerBudgetsMensuelsEchus(prisma).catch((err) => console.error("Clôture automatique des budgets mensuels:", err));

    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");
    const mois = searchParams.get("mois"); // "yyyy-MM"
    const departement = searchParams.get("departement");
    const year = searchParams.get("year");
    const sansJustificatif = searchParams.get("sansJustificatif") === "1";
    const depassementEnAttente = searchParams.get("depassementEnAttente") === "1";

    const where: Prisma.DemandeBudgetWhereInput = {};

    // Un utilisateur sans aucun droit budget ne voit que ses propres demandes — filtre
    // imposé côté serveur (pas de paramètre client possible pour le contourner).
    if (!isImpliqueBudget(caps)) {
      where.requesterEmail = { equals: caps.email, mode: "insensitive" };
    }

    if (statut && Object.values(StatutDemandeBudget).includes(statut as StatutDemandeBudget)) {
      where.statut = statut as StatutDemandeBudget;
    }
    if (type && Object.values(TypeBudget).includes(type as TypeBudget)) {
      where.type = type as TypeBudget;
    }
    if (mois) {
      const debut = toPeriodeMois(mois);
      if (debut) {
        where.periodeMois = {
          gte: new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1)),
          lt: new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1)),
        };
      }
    }
    if (departement) where.departement = departement;
    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!Number.isNaN(parsedYear)) {
        where.createdAt = { gte: new Date(parsedYear, 0, 1), lt: new Date(parsedYear + 1, 0, 1) };
      }
    }
    if (sansJustificatif) {
      where.depenses = { some: { annuleeAt: null, source: { not: "CAMPTRACK" }, attachments: { none: {} } } };
    }
    if (depassementEnAttente) {
      where.depassements = { some: { statut: StatutDepassement.EN_ATTENTE } };
    }

    const demandes = await prisma.demandeBudget.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lignes: true,
        bonCommande: { select: { id: true, numero: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
        depenses: { where: { annuleeAt: null }, select: { montant: true, createdAt: true, source: true, _count: { select: { attachments: true } } } },
        depassements: { where: { statut: { in: [StatutDepassement.APPROUVE, StatutDepassement.EN_ATTENTE] } }, select: { montant: true, statut: true } },
      },
    });

    const maintenant = new Date();
    return NextResponse.json(
      demandes.map(({ depenses, depassements, ...d }) => ({
        ...d,
        // Plafond effectif = prévu + dépassements approuvés ; consommé = dépenses non annulées.
        // Plafond effectif = Σ montants accordés + dépassements approuvés (0 tant que rien n'est accordé).
        montantPlafond:
          d.lignes.reduce((s, l) => s + montantAccordeLigne(l), 0) +
          depassements.filter((x) => x.statut === StatutDepassement.APPROUVE).reduce((s, x) => s + Number(x.montant), 0),
        montantConsomme: depenses.reduce((s, dep) => s + Number(dep.montant), 0),
        nbDepensesSansJustificatif: depenses.filter((dep) => dep._count.attachments === 0 && dep.source !== "CAMPTRACK").length,
        // Sans justificatif ET délai de 24 h ouvrées dépassé (affichées en rouge).
        nbJustificatifsEnRetard: depenses.filter(
          (dep) => etatJustificatif({ createdAt: dep.createdAt, nbJustificatifs: dep._count.attachments, source: dep.source }, maintenant) === "EN_RETARD"
        ).length,
        nbDepassementsEnAttente: depassements.filter((x) => x.statut === StatutDepassement.EN_ATTENTE).length,
        nbLignesACorriger: d.lignes.filter((l) => l.statutValidation === "A_CORRIGER").length,
      }))
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des demandes de budget:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

// POST /api/demandes-budget - Soumettre une nouvelle demande de budget
export async function POST(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const formData = await request.formData();
    const validation = parseDemandeBudgetFormData(formData);
    if (!validation.success) {
      return NextResponse.json({ error: firstZodMessage(validation.error) }, { status: 400 });
    }
    const data = validation.data;
    assertTypedAttachmentsAllowed(formData);

    // Un seul budget mensuel par service et par mois (hors demandes rejetées).
    if (data.type === TypeBudget.MENSUEL && data.departement) {
      const periode = toPeriodeMois(data.periodeMois);
      const doublon = periode
        ? await budgetMensuelExistant(prisma, { departement: data.departement, periodeMois: periode })
        : null;
      if (doublon) {
        return NextResponse.json(
          { error: `Un budget mensuel existe déjà pour ce service et ce mois (${doublon}). Complétez-le plutôt que d'en créer un second.` },
          { status: 409 }
        );
      }
    }

    const montantTotal = data.lignes.reduce((sum, l) => sum + l.montant, 0);

    // Numéro = plus grand numéro de l'année + 1 (et non un simple comptage, qui donnait des
    // doublons) ; nouvel essai si deux soumissions simultanées obtiennent le même numéro.
    const year = new Date().getFullYear();
    const prochainNumero = async () => {
      const existants = await prisma.demandeBudget.findMany({ where: { numero: { startsWith: `DB-${year}-` } }, select: { numero: true } });
      const max = existants.reduce((m, d) => Math.max(m, parseInt(d.numero.split("-")[2] ?? "0", 10) || 0), 0);
      return `DB-${year}-${String(max + 1).padStart(4, "0")}`;
    };

    let demande: Prisma.DemandeBudgetGetPayload<{ include: { lignes: true } }> | null = null;
    for (let essai = 0; essai < 3 && !demande; essai++) {
      const numero = await prochainNumero();
      try {
    demande = await prisma.demandeBudget.create({
      data: {
        numero,
        type: data.type,
        periodeMois: data.type === TypeBudget.MENSUEL ? toPeriodeMois(data.periodeMois) : null,
        requesterEmail: caps.email,
        requesterName: caps.name,
        departement: data.departement,
        contexteMotivation: data.contexteMotivation,
        montantTotal,
        modePaiement: data.modePaiement,
        typeDepense: data.typeDepense,
        pourLeCompteDe: data.pourLeCompteDe,
        dateLimiteSouhaitee: data.dateLimiteSouhaitee ? new Date(data.dateLimiteSouhaitee) : undefined,
        bonCommandeId: data.bonCommandeId || undefined,
        lignes: { create: lignesAvecMode(data) },
        proformas: { create: data.proformaIds.map((invoiceId) => ({ invoiceId })) },
      },
      include: { lignes: true },
    });
      } catch (e) {
        const doublonNumero = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!doublonNumero || essai === 2) throw e;
      }
    }
    if (!demande) throw new Error("Impossible d'attribuer un numéro à la demande.");

    const attachmentRows = await saveTypedDemandeBudgetAttachments(demande.id, formData, {
      date: new Date(),
      montant: Number(demande.montantTotal),
    });
    if (attachmentRows.length > 0) {
      await prisma.demandeBudgetAttachment.createMany({ data: attachmentRows });
    }

    await logBudget(prisma, {
      demandeBudgetId: demande.id,
      action: ActionBudget.CREATION,
      auteurEmail: caps.email,
      auteurNom: caps.name,
      montant: montantTotal,
      details: `${demande.lignes.length} ligne(s)${attachmentRows.length > 0 ? `, ${attachmentRows.length} document(s)` : ""}`,
    });

    sendDemandeSoumiseNotification(demande, caps.plafond).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de demande soumise:", err)
    );

    return NextResponse.json(demande, { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erreur lors de la création de la demande de budget:", error);
    const fsMessage = describeFsError(error);
    const message = fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
