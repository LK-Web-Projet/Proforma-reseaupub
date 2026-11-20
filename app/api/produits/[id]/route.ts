import { requireAnyPage, requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';

// GET /api/produits/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refusAcces = await requireAnyPage(["produits", "proforma"]);
  if (refusAcces) return refusAcces;
  try {
    const { id } = await params;

    const produit = await prisma.produit.findUnique({
      where: { id: id },
    });
    if (!produit) {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 },
      );
    }
    return NextResponse.json(produit);
  } catch (error) {
    console.error("Erreur lors de la récupération du produit :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 },
    );
  }
}

const produitUpdateSchema = z.object({
  nom: z.string().min(1, "Le nom du produit est requis.").optional(),
  prixUnitaire: z.coerce.number().min(0, "Le prix ne peut pas être négatif.").optional(),
  actif: z.boolean().optional(),
});

// PUT /api/produits/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const droitsAcces = await requirePermission("produits.modifier");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  try {
    const data = await request.json();
    const validation = produitUpdateSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const produitMisAJour = await prisma.produit.update({
      where: { id: (await params).id },
      data: validation.data,
    });
    return NextResponse.json(produitMisAJour);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du produit :", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "Un produit avec ce nom existe déjà." }, { status: 409 });
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// DELETE /api/produits/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const droitsAcces = await requirePermission("produits.supprimer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  try {
    await prisma.produit.delete({ where: { id: (await params).id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression du produit :", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003' || error.code === 'P2014') {
        return NextResponse.json(
          { error: "Ce produit est utilisé dans au moins une facture et ne peut pas être supprimé. Désactivez-le à la place." },
          { status: 409 },
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
