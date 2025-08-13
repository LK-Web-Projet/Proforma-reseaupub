import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/produits/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params; 

    const produit = await prisma.produit.findUnique({
      where: { id:id },
    });
    if (!produit) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }
    return NextResponse.json(produit);
  } catch (error) {
    console.error("Erreur lors de la récupération du produit :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// PUT /api/produits/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const produitMisAJour = await prisma.produit.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(produitMisAJour);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du produit :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// DELETE /api/produits/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.produit.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression du produit :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
