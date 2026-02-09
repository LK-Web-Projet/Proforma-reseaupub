
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Params {
  params: { id: string };
}

// PATCH /api/factures-fournisseurs/[id] - Mettre à jour le statut d'une facture
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  console.log(`[API] Updating facture status for id: ${id}`);

  try {
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ message: 'Le statut est requis.' }, { status: 400 });
    }

    const updatedFacture = await prisma.factureFournisseur.update({
      where: { id },
      data: { status },
    });

    console.log(`[API] Successfully updated facture status: ${id}`);
    return NextResponse.json(updatedFacture);
  } catch (error: unknown) {
    console.error(`[API] Critical error updating facture ${id}:`, error);

    // Log full error details
    if (typeof error === 'object' && error !== null) {
      console.error("[API] Full error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }

    const err = error as { code?: string; message?: string } | null;

    if (err && err.code === 'P2025') { // Record to update not found
      return NextResponse.json({ message: 'Facture non trouvée' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur', details: err?.message || "Unknown" }, { status: 500 });
  }
}
