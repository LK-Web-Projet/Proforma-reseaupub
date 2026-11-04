import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetComptable } from "@/lib/budgetAuth";
import { saveDemandeBudgetFiles, describeFsError } from "@/lib/uploadDemandeBudget";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const comptable = await requireBudgetComptable();
  if (comptable instanceof NextResponse) return comptable;

  const { id } = await params;

  try {
    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== "VALIDEE") {
      return NextResponse.json({ error: "Seule une demande validée peut être marquée comme payée." }, { status: 400 });
    }

    const formData = await request.formData();
    const datePaiement = formData.get("datePaiement") as string | null;
    const nomReceveur = formData.get("nomReceveur") as string | null;
    const preuves = formData.getAll("preuves") as File[];

    if (!datePaiement || !nomReceveur) {
      return NextResponse.json({ error: "La date de paiement et le nom du receveur sont requis." }, { status: 400 });
    }

    if (preuves.length > 0) {
      const saved = await saveDemandeBudgetFiles(id, preuves);
      await prisma.demandeBudgetAttachment.createMany({
        data: saved.map((f) => ({ demandeBudgetId: id, kind: "PREUVE_PAIEMENT", ...f })),
      });
    }

    const demande = await prisma.demandeBudget.update({
      where: { id },
      data: {
        statut: "PAYEE",
        datePaiement: new Date(datePaiement),
        nomReceveur,
      },
    });

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors du traitement du paiement de la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    const message = fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
