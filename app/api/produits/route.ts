import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/produits
export async function GET() {
  try {
    const produits = await prisma.produit.findMany();
    return NextResponse.json(produits);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// POST /api/produits
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const nouveauProduit = await prisma.produit.create({ data });
    return NextResponse.json(nouveauProduit, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du produit :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
