import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/factures/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const facture = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { client: true, produits: true },
    });
    if (!facture) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }
    return NextResponse.json(facture);
  } catch (error) {
    console.error("Erreur lors de la récupération de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// PUT /api/factures/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const factureMiseAJour = await prisma.invoice.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(factureMiseAJour);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// DELETE /api/factures/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.invoice.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
