
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/factures-fournisseurs/[id] - Mettre à jour le statut d'une facture
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ message: 'Le statut est requis.' }, { status: 400 });
    }

    const updatedFacture = await prisma.factureFournisseur.update({
      where: { id: context.params.id },
      data: { status },
    });

    return NextResponse.json(updatedFacture);
  } catch (error: unknown) {
    console.error(`Erreur lors de la mise à jour de la facture ${context.params.id}:`, error);

    const err = error as { code?: string; message?: string } | null;

    if (err && err.code === 'P2025') { // Record to update not found
      return NextResponse.json({ message: 'Facture non trouvée' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

