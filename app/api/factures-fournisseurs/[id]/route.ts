
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Params {
  params: { id: string };
}

// PATCH /api/factures-fournisseurs/[id] - Mettre à jour le statut d'une facture
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ message: 'Le statut est requis.' }, { status: 400 });
    }

    const updatedFacture = await prisma.factureFournisseur.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json(updatedFacture);
  } catch (error: any) {
    console.error(`Erreur lors de la mise à jour de la facture ${params.id}:`, error);
    if (error.code === 'P2025') { // Record to update not found
      return NextResponse.json({ message: 'Facture non trouvée' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
