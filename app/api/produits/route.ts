import { requireAnyPage, requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';

// GET /api/produits?actif=true|false - Liste des produits (sans paramètre : tous, utilisé par la page admin)
export async function GET(request: Request) {
  const refusAcces = await requireAnyPage(["produits", "proforma"]);
  if (refusAcces) return refusAcces;
  try {
    const { searchParams } = new URL(request.url);
    const actifParam = searchParams.get('actif');

    const produits = await prisma.produit.findMany({
      where: actifParam !== null ? { actif: actifParam === 'true' } : undefined,
      orderBy: { nom: 'asc' },
    });
    return NextResponse.json(produits);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

const produitSchema = z.object({
  nom: z.string().min(1, "Le nom du produit est requis."),
  prixUnitaire: z.coerce.number().min(0, "Le prix ne peut pas être négatif."),
});

// POST /api/produits - Créer un nouveau produit
export async function POST(request: Request) {
  const droitsAcces = await requirePermission("produits.creer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  try {
    const data = await request.json();
    const validation = produitSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const nouveauProduit = await prisma.produit.create({ data: validation.data });
    return NextResponse.json(nouveauProduit, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du produit :", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: "Un produit avec ce nom existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
