import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBudgetUser, refusValidation } from "@/lib/budgetAuth";
import { sendDemandeRejeteeNotification } from "@/lib/email/demandeBudget";

const rejeterSchema = z.object({
  motif: z.string().min(1, "Le motif du rejet est requis."),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = rejeterSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Le motif du rejet est requis." }, { status: 400 });
    }

    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== "SOUMISE") {
      return NextResponse.json({ error: "Seule une demande soumise peut être rejetée." }, { status: 400 });
    }

    // Même matrice que la validation : qui peut valider peut rejeter.
    const refus = refusValidation(caps, existing);
    if (refus) {
      return NextResponse.json({ error: refus }, { status: 403 });
    }

    const demande = await prisma.demandeBudget.update({
      where: { id },
      data: {
        statut: "REJETEE",
        validatedByEmail: caps.email,
        validatedAt: new Date(),
        rejectionReason: validation.data.motif,
      },
      include: { lignes: true },
    });

    sendDemandeRejeteeNotification(demande).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de rejet:", err)
    );

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors du rejet de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
