import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest, // Le premier argument est l'objet de requête Next.js
  context: { params: Promise<{ id: string }> } // Le deuxième argument contient les paramètres de route dynamiques (ici, 'id')
) {
  try {
    // Tente de trouver une facture unique dans la base de données en utilisant l'ID fourni.
    const { id } = await context.params; // <-- attendre la résolution
    // 'include' permet de récupérer également les données du client et des produits associés à la facture.
    const facture = await prisma.invoice.findUnique({
      where: { id }, // Utilise l'ID extrait des paramètres de l route pour la recherche
      include: { client: true, produits: true, gestionnaires: true },
    });

    // Si aucune facture n'est trouvée avec l'ID donné
    if (!facture) {
      // Renvoie une réponse JSON avec un message d'erreur et un statut 404 (Non trouvé)
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Si la facture est trouvée, renvoie les données de la facture en JSON avec un statut 200 (OK)
    return NextResponse.json(facture);
  } catch (error) {
    // En cas d'erreur lors de l'exécution de la requête (ex: problème de connexion à la DB)
    console.error("Erreur lors de la récupération de la facture :", error); // Log l'erreur pour le débogage côté serveur
    // Renvoie une réponse JSON avec un message d'erreur générique et un statut 500 (Erreur Interne du Serveur)
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}
// PUT /api/factures/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const factureMiseAJour = await prisma.invoice.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(factureMiseAJour);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// DELETE /api/factures/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.invoice.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
