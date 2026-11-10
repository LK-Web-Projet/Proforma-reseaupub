import { NextRequest, NextResponse } from "next/server";
import { Prisma, StatutDemandeBudget, TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget } from "@/lib/budgetAuth";
import { parseDemandeBudgetFormData, toPeriodeMois, firstZodMessage } from "@/lib/budgetSchema";
import { saveTypedDemandeBudgetAttachments, describeFsError } from "@/lib/uploadDemandeBudget";
import { sendDemandeSoumiseNotification } from "@/lib/email/demandeBudget";

// GET /api/demandes-budget - Liste des demandes de budget
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");
    const mois = searchParams.get("mois"); // "yyyy-MM"
    const departement = searchParams.get("departement");
    const year = searchParams.get("year");
    const sansJustificatif = searchParams.get("sansJustificatif") === "1";

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
      where.depenses = { some: { attachments: { none: {} } } };
    }

    const demandes = await prisma.demandeBudget.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lignes: true,
        bonCommande: { select: { id: true, numero: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
        depenses: { select: { montant: true, _count: { select: { attachments: true } } } },
      },
    });

    return NextResponse.json(
      demandes.map(({ depenses, ...d }) => ({
        ...d,
        montantConsomme: depenses.reduce((s, dep) => s + Number(dep.montant), 0),
        nbDepensesSansJustificatif: depenses.filter((dep) => dep._count.attachments === 0).length,
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

    const montantTotal = data.lignes.reduce((sum, l) => sum + l.montant, 0);

    const year = new Date().getFullYear();
    const count = await prisma.demandeBudget.count();
    const numero = `DB-${year}-${String(count + 1).padStart(4, "0")}`;

    const demande = await prisma.demandeBudget.create({
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
        lignes: { create: data.lignes },
        proformas: { create: data.proformaIds.map((invoiceId) => ({ invoiceId })) },
      },
      include: { lignes: true },
    });

    const attachmentRows = await saveTypedDemandeBudgetAttachments(demande.id, formData);
    if (attachmentRows.length > 0) {
      await prisma.demandeBudgetAttachment.createMany({ data: attachmentRows });
    }

    sendDemandeSoumiseNotification(demande, caps.plafond).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de demande soumise:", err)
    );

    return NextResponse.json(demande, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la demande de budget:", error);
    const fsMessage = describeFsError(error);
    const message = fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
