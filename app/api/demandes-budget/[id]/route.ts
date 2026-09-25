import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserIdentity, isBudgetAdminEmail, isBudgetComptableEmail } from "@/lib/budgetAuth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { email } = await getCurrentUserIdentity();
    if (!email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const demande = await prisma.demandeBudget.findUnique({
      where: { id },
      include: {
        lignes: true,
        attachments: true,
        bonCommande: { include: { fournisseur: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
      },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    // Une demande n'est consultable que par son auteur, ou par l'admin/comptable du
    // processus budget — jamais par un autre employé qui devinerait l'URL.
    const isImplique = isBudgetAdminEmail(email) || isBudgetComptableEmail(email);
    if (!isImplique && demande.requesterEmail !== email) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la récupération de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
