import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/fournisseurs - Récupérer tous les fournisseurs
export async function GET() {
  try {
    const fournisseurs = await prisma.fournisseur.findMany({
      orderBy: {
        entreprise: 'asc',
      },
    });
    return NextResponse.json(fournisseurs);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// POST /api/fournisseurs - Créer un nouveau fournisseur
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nom, prenom, entreprise, contact, domaineActivite, adresse, email, typeFournisseur } = body;

    // Basic validation
    if (!entreprise || !contact) {
      return NextResponse.json({ message: 'Les champs entreprise et contact sont requis' }, { status: 400 });
    }

    const newFournisseur = await prisma.fournisseur.create({
      data: {
        nom,
        prenom,
        entreprise,
        contact,
        domaineActivite,
        adresse,
        email: email?.trim() ? email.trim() : null,
        typeFournisseur: typeFournisseur?.trim() || null,
      },
    });

    return NextResponse.json(newFournisseur, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur lors de la création du fournisseur:', error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const errWithCode = error as { code?: string };
      if (errWithCode.code === 'P2002') { // Unique constraint violation
        return NextResponse.json({ message: `Un prestataire avec cet email ou nom d'entreprise existe déjà.` }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
