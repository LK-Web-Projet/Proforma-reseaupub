import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Params {
  params: { id: string };
}

// GET /api/fournisseurs/[id] - Récupérer un fournisseur par ID
export async function GET(req: Request, { params }: Params) {
  try {
    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: params.id },
      include: {
        factures: true,
      },
    });

    if (!fournisseur) {
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }

    return NextResponse.json(fournisseur);
  } catch (error) {
    console.error(`Erreur lors de la récupération du fournisseur ${params.id}:`, error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// PUT /api/fournisseurs/[id] - Mettre à jour un fournisseur
export async function PUT(req: Request, { params }: Params) {
  try {
    const body = await req.json();
    const { nom, prenom, entreprise, contact, domaineActivite, adresse, email } = body;

    const updatedFournisseur = await prisma.fournisseur.update({
      where: { id: params.id },
      data: {
        nom,
        prenom,
        entreprise,
        contact,
        domaineActivite,
        adresse,
        email,
      },
    });

    return NextResponse.json(updatedFournisseur);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`Erreur lors de la mise à jour du fournisseur ${params.id}:`, err);
    if (err.code === 'P2025') { // Record to update not found
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }
    if (err.code === 'P2002') { // Unique constraint violation
      return NextResponse.json({ message: `Un fournisseur avec cet email ou nom d'entreprise existe déjà.` }, { status: 409 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
// DELETE /api/fournisseurs/[id] - Supprimer un fournisseur
export async function DELETE(req: Request, { params }: Params) {
  try {
    await prisma.fournisseur.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`Erreur lors de la suppression du fournisseur ${params.id}:`, err);
    if (err.code === 'P2025') { // Record to delete not found
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

