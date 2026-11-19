import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { safeCreatedById } from '@/lib/authz';
import { etatEcheance } from '@/lib/retardPaiement';
import { getDelaisPaiement } from '@/lib/retardPaiementServeur';

// GET /api/fournisseurs/[id] - Récupérer un fournisseur par ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> },) {
  const { id } = await params;
  console.log(`[API] Fetching fournisseur details for id: ${id}`);

  try {
    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id },
      include: {
        factures: true,
        statutHistorique: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { nom: true } } },
        },
      },
    });

    if (!fournisseur) {
      console.warn(`[API] Fournisseur not found for id: ${id}`);
      return NextResponse.json({ message: 'Prestataire non trouvé' }, { status: 404 });
    }

    console.log(`[API] Successfully fetched fournisseur: ${fournisseur.entreprise}`);
    // Échéance de paiement de chaque facture (délai selon le type du prestataire).
    const delais = await getDelaisPaiement();
    const maintenant = new Date();
    return NextResponse.json({
      ...fournisseur,
      factures: fournisseur.factures.map((f) => ({
        ...f,
        echeance: etatEcheance(f, fournisseur.typeFournisseur, delais, maintenant),
      })),
    });
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
export async function PUT(req: Request,{ params }: { params: Promise<{ id: string }> },) {
  const { id } = await params;
  console.log(`[API] Updating fournisseur for id: ${id}`);

  try {
    const body = await req.json();
    const { nom, prenom, entreprise, contact, domaineActivite, adresse, email, typeFournisseur, dateDebutContrat, dateFinContrat } = body;

    const updatedFournisseur = await prisma.fournisseur.update({
      where: { id },
      data: {
        nom,
        prenom,
        entreprise,
        contact,
        domaineActivite,
        adresse,
        email: email?.trim() ? email.trim() : null,
        typeFournisseur: typeFournisseur?.trim() || null,
        dateDebutContrat: dateDebutContrat ? new Date(dateDebutContrat) : null,
        dateFinContrat: dateFinContrat ? new Date(dateFinContrat) : null,
      },
    });

    console.log(`[API] Successfully updated fournisseur: ${id}`);
    return NextResponse.json(updatedFournisseur);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`[API] Error updating fournisseur ${id}:`, err);
    if (err.code === 'P2025') { // Record to update not found
      return NextResponse.json({ message: 'Prestataire non trouvé' }, { status: 404 });
    }
    if (err.code === 'P2002') { // Unique constraint violation
      return NextResponse.json({ message: `Un prestataire avec cet email ou nom d'entreprise existe déjà.` }, { status: 409 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
// PATCH /api/fournisseurs/[id] - Bascule rapide actif/inactif (+ motif optionnel),
// avec création d'une ligne d'historique si la valeur change réellement.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { userId } = await auth();
    const body = await req.json();
    const { actif, motif, dateContrat } = body;

    if (typeof actif !== 'boolean') {
      return NextResponse.json({ message: 'Le champ actif (booléen) est requis.' }, { status: 400 });
    }

    const existing = await prisma.fournisseur.findUnique({ where: { id }, select: { actif: true } });
    if (!existing) {
      return NextResponse.json({ message: 'Prestataire non trouvé' }, { status: 404 });
    }

    const statutChange = existing.actif !== actif;
    const parsedDateContrat = dateContrat ? new Date(dateContrat) : null;
    if (statutChange && (!dateContrat || Number.isNaN(parsedDateContrat?.getTime()))) {
      return NextResponse.json({ message: 'La date du changement est requise.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.fournisseur.update({
        where: { id },
        data: {
          actif,
          // La date saisie alimente aussi le contrat : début si on repasse actif, fin si on passe inactif.
          ...(statutChange && actif ? { dateDebutContrat: parsedDateContrat } : {}),
          ...(statutChange && !actif ? { dateFinContrat: parsedDateContrat } : {}),
        },
      });
      if (statutChange) {
        const createdById = await safeCreatedById(tx, userId);
        await tx.fournisseurStatutHistorique.create({
          data: {
            fournisseurId: id,
            actif,
            motif: motif?.trim() ? motif.trim() : null,
            dateContrat: parsedDateContrat,
            createdById,
          },
        });
      }
      return result;
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error(`[API] Error updating fournisseur status ${id}:`, err);
    if (err.code === 'P2025') {
      return NextResponse.json({ message: 'Prestataire non trouvé' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// DELETE /api/fournisseurs/[id] - Supprimer un fournisseur
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> },) {
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
      return NextResponse.json({ message: 'Prestataire non trouvé' }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

