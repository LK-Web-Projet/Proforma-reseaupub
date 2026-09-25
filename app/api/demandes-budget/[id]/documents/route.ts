import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserIdentity, isBudgetAdminEmail, isBudgetComptableEmail } from "@/lib/budgetAuth";
import { saveTypedDemandeBudgetAttachments, describeFsError } from "@/lib/uploadDemandeBudget";

// POST /api/demandes-budget/[id]/documents - Ajouter des documents à une demande déjà
// validée (avant paiement), sans toucher au reste de la demande. Autorisé pour l'auteur de
// la demande, l'admin et le comptable — des pièces complémentaires peuvent être nécessaires
// après la validation, avant que le comptable ne traite le paiement.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { email } = await getCurrentUserIdentity();
    if (!email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const demande = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    const isAutorise = demande.requesterEmail === email || isBudgetAdminEmail(email) || isBudgetComptableEmail(email);
    if (!isAutorise) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier cette demande." }, { status: 403 });
    }

    if (demande.statut !== "VALIDEE") {
      return NextResponse.json({ error: "Des documents ne peuvent être ajoutés que sur une demande validée." }, { status: 400 });
    }

    const formData = await request.formData();
    const attachmentRows = await saveTypedDemandeBudgetAttachments(id, formData);
    if (attachmentRows.length === 0) {
      return NextResponse.json({ error: "Aucun document fourni." }, { status: 400 });
    }

    await prisma.demandeBudgetAttachment.createMany({ data: attachmentRows });

    return NextResponse.json({ success: true, count: attachmentRows.length });
  } catch (error) {
    console.error(`Erreur lors de l'ajout de documents à la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    if (fsMessage) {
      return NextResponse.json({ error: fsMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
