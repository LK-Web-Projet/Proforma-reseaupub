import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser, refusValidation } from "@/lib/budgetAuth";
import { sendDemandeValideeNotification } from "@/lib/email/demandeBudget";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== "SOUMISE") {
      return NextResponse.json({ error: "Seule une demande soumise peut être validée." }, { status: 400 });
    }

    const refus = refusValidation(caps, existing);
    if (refus) {
      return NextResponse.json({ error: refus }, { status: 403 });
    }

    const demande = await prisma.demandeBudget.update({
      where: { id },
      data: { statut: "VALIDEE", validatedByEmail: caps.email, validatedAt: new Date() },
      include: { lignes: true },
    });

    sendDemandeValideeNotification(demande).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de validation:", err)
    );

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la validation de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
