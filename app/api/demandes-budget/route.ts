import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, ModePaiementDemande, StatutDemandeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserIdentity } from "@/lib/budgetAuth";
import { saveDemandeBudgetFiles, describeFsError } from "@/lib/uploadDemandeBudget";
import { sendDemandeSoumiseNotification } from "@/lib/email/demandeBudget";

const ligneSchema = z.object({
  designation: z.string().min(1),
  montant: z.number().min(0),
});

const createSchema = z.object({
  departement: z.string().optional(),
  contexteMotivation: z.string().min(1, "Le contexte et la motivation sont requis."),
  modePaiement: z.nativeEnum(ModePaiementDemande),
  typeDepense: z.string().min(1, "Le type de dépense est requis."),
  pourLeCompteDe: z.string().optional(),
  dateLimiteSouhaitee: z.string().optional(),
  bonCommandeId: z.string().optional(),
  proformaIds: z.array(z.string()).default([]),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne de dépense."),
});

// GET /api/demandes-budget - Liste des demandes de budget
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");
    const departement = searchParams.get("departement");
    const year = searchParams.get("year");

    const where: Prisma.DemandeBudgetWhereInput = {};
    if (statut && Object.values(StatutDemandeBudget).includes(statut as StatutDemandeBudget)) {
      where.statut = statut as StatutDemandeBudget;
    }
    if (departement) where.departement = departement;
    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!Number.isNaN(parsedYear)) {
        where.createdAt = {
          gte: new Date(parsedYear, 0, 1),
          lt: new Date(parsedYear + 1, 0, 1),
        };
      }
    }

    const demandes = await prisma.demandeBudget.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lignes: true,
        bonCommande: { select: { id: true, numero: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
      },
    });

    return NextResponse.json(demandes);
  } catch (error) {
    console.error("Erreur lors de la récupération des demandes de budget:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

// POST /api/demandes-budget - Soumettre une nouvelle demande de budget
export async function POST(request: NextRequest) {
  try {
    const { email, name } = await getCurrentUserIdentity();
    if (!email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const formData = await request.formData();

    const rawLignes = formData.get("lignes");
    const rawProformaIds = formData.get("proformaIds");
    const documents = formData.getAll("documentsCommande") as File[];

    const parsedBody = {
      departement: (formData.get("departement") as string) || undefined,
      contexteMotivation: (formData.get("contexteMotivation") as string) || "",
      modePaiement: formData.get("modePaiement") as string,
      typeDepense: (formData.get("typeDepense") as string) || "",
      pourLeCompteDe: (formData.get("pourLeCompteDe") as string) || undefined,
      dateLimiteSouhaitee: (formData.get("dateLimiteSouhaitee") as string) || undefined,
      bonCommandeId: (formData.get("bonCommandeId") as string) || undefined,
      proformaIds: rawProformaIds ? JSON.parse(rawProformaIds as string) : [],
      lignes: rawLignes ? JSON.parse(rawLignes as string) : [],
    };

    const validation = createSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }
    const data = validation.data;

    const montantTotal = data.lignes.reduce((sum, l) => sum + l.montant, 0);

    const year = new Date().getFullYear();
    const count = await prisma.demandeBudget.count();
    const numero = `DB-${year}-${String(count + 1).padStart(4, "0")}`;

    const demande = await prisma.demandeBudget.create({
      data: {
        numero,
        requesterEmail: email,
        requesterName: name,
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

    if (documents.length > 0) {
      const saved = await saveDemandeBudgetFiles(demande.id, documents);
      await prisma.demandeBudgetAttachment.createMany({
        data: saved.map((f) => ({ demandeBudgetId: demande.id, kind: "DOCUMENT_COMMANDE", ...f })),
      });
    }

    sendDemandeSoumiseNotification(demande).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de demande soumise:", err)
    );

    return NextResponse.json(demande, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la demande de budget:", error);
    const fsMessage = describeFsError(error);
    if (fsMessage) {
      return NextResponse.json({ error: fsMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
