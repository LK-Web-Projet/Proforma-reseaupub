import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Params {
  params: { id: string };
}

// GET /api/fournisseurs/[id] - Récupérer un fournisseur par ID
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  console.log(`[API] Fetching fournisseur details for id: ${id}`);

  try {
    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id },
      include: {
        factures: true,
      },
    });

    if (!fournisseur) {
      console.warn(`[API] Fournisseur not found for id: ${id}`);
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }

    console.log(`[API] Successfully fetched fournisseur: ${fournisseur.entreprise}`);
    return NextResponse.json(fournisseur);
  } catch (error) {
    console.error(`[API] Critical error fetching fournisseur ${id}:`, error);

    // Log full error details
    if (typeof error === 'object' && error !== null) {
      console.error("[API] Full error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }

    return NextResponse.json({ message: 'Erreur interne du serveur', details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// PUT /api/fournisseurs/[id] - Mettre à jour un fournisseur
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  console.log(`[API] Updating fournisseur for id: ${id}`);

  try {
    const body = await req.json();
    const { nom, prenom, entreprise, contact, domaineActivite, adresse, email } = body;

    const updatedFournisseur = await prisma.fournisseur.update({
      where: { id },
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

    console.log(`[API] Successfully updated fournisseur: ${id}`);
    return NextResponse.json(updatedFournisseur);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`[API] Error updating fournisseur ${id}:`, err);
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
  const { id } = await params;
  console.log(`[API] Deleting fournisseur id: ${id}`);

  try {
    await prisma.fournisseur.delete({
      where: { id },
    });

    console.log(`[API] Successfully deleted fournisseur: ${id}`);
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`[API] Error deleting fournisseur ${id}:`, err);
    if (err.code === 'P2025') { // Record to delete not found
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

