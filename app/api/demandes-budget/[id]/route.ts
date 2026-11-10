import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget, isSameEmail } from "@/lib/budgetAuth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const demande = await prisma.demandeBudget.findUnique({
      where: { id },
      include: {
        lignes: { orderBy: { designation: "asc" } },
        attachments: true,
        bonCommande: { include: { fournisseur: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
        depenses: {
          orderBy: { dateDepense: "desc" },
          include: {
            cashRegister: { select: { id: true, name: true } },
            invoice: { select: { id: true, numero: true } },
            attachments: true,
          },
        },
        commentaires: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    // Une demande n'est consultable que par son auteur, ou par un rôle du circuit budget —
    // jamais par un autre employé qui devinerait l'URL.
    if (!isImpliqueBudget(caps) && !isSameEmail(demande.requesterEmail, caps.email)) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la récupération de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
