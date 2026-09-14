import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
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

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la récupération de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
