import { requireAnyPage, requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syntheseRetards } from '@/lib/retardPaiement';
import { getDelaisPaiement } from '@/lib/retardPaiementServeur';

// GET /api/fournisseurs - Récupérer tous les fournisseurs
export async function GET() {
  const refusAcces = await requireAnyPage(["fournisseurs"]);
  if (refusAcces) return refusAcces;
  try {
    const [fournisseurs, delais] = await Promise.all([
      prisma.fournisseur.findMany({
        orderBy: {
          entreprise: 'asc',
        },
        // Factures à payer : seulement pour calculer les retards (non renvoyées telles quelles).
        include: { factures: { where: { status: 'EN_ATTENTE' }, select: { montant: true, date: true, status: true } } },
      }),
      getDelaisPaiement(),
    ]);
    const maintenant = new Date();
    return NextResponse.json(
      fournisseurs.map(({ factures, ...f }) => ({
        ...f,
        // Factures en retard de paiement (délai selon le type) : ligne rouge et bouton clignotant.
        retard: syntheseRetards(factures, f.typeFournisseur, delais, maintenant),
      }))
    );
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// POST /api/fournisseurs - Créer un nouveau fournisseur
export async function POST(req: Request) {
  const droitsAcces = await requirePermission("fournisseurs.creer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
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
