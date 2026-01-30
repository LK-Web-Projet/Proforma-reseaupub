import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/fournisseurs/[id] - Récupérer un fournisseur par ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: (await params).id },
      include: {
        factures: true,
      },
    });

    if (!fournisseur) {
      return NextResponse.json({ message: 'Fournisseur non trouvé' }, { status: 404 });
    }

    return NextResponse.json(fournisseur);
  } catch (error) {
    console.error(`Erreur lors de la récupération du fournisseur ${(await params).id}:`, error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// PUT /api/fournisseurs/[id] - Mettre à jour un fournisseur
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { nom, prenom, entreprise, contact, domaineActivite, adresse, email } = body;

    const updatedFournisseur = await prisma.fournisseur.update({
      where: { id: (await params).id },
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
    console.error(`Erreur lors de la mise à jour du fournisseur ${(await params).id}:`, err);
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
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await prisma.fournisseur.delete({
      where: { id: (await params).id },
    });

    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(
      `Erreur lors de la suppression du fournisseur ${(await params).id}:`,
      err,
    );
    if (err.code === "P2025") {
      // Record to delete not found
      return NextResponse.json(
        { message: "Fournisseur non trouvé" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { message: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

