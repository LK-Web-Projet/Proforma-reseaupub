"use clients";

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schéma de validation pour la mise à jour du statut
const updateStatusSchema = z.object({
  statut: z.string().min(1, "Le statut est requis"),
});


// Schéma de validation pour la mise à jour des produits
const updateProduitsSchema = z.object({
  produits: z.array(
    z.object({
      id: z.string().optional(), // L'ID du produit existant dans la facture
      produitId: z.string(),
      designation: z.string(),
      quantite: z.number().min(1),
      prixUnitaire: z.number().min(0),
      duree: z.number().min(0),
      uniteDuree: z.enum(["jour", "heure", "mois"]),
    })
  ),
  tva: z.number().min(0),
});


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const facture = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        produits: {
          include: {
            produit: true,
          },
        },
        gestionnaires: {
          include: {
            gestionnaire: true,
          },
        },
      },
    });

    if (!facture) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    return NextResponse.json(facture);
  } catch (error) {
    console.error("Erreur lors de la récupération de la facture :", error);
    return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();

  // Scénario 1: Mise à jour du statut uniquement
  if ('statut' in body && Object.keys(body).length === 1) {
    const validation = updateStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }
    try {
      const updatedFacture = await prisma.invoice.update({
        where: { id },
        data: { statut: validation.data.statut },
      });
      return NextResponse.json(updatedFacture);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
    }
  }

  // Scénario 2: Mise à jour des produits et des totaux
  const validation = updateProduitsSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 });
  }

  const { produits, tva } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculer les nouveaux totaux
      const totalHT = produits.reduce((acc, p) => acc + (p.quantite * p.prixUnitaire * p.duree), 0);
      const totalTTC = totalHT * (1 + tva / 100);

      // 2. Supprimer les anciens produits de la facture
      await tx.invoiceProduit.deleteMany({
        where: { invoiceId: id },
      });

      // 3. Créer les nouveaux produits de la facture
      await tx.invoiceProduit.createMany({
        data: produits.map((p) => ({
          invoiceId: id,
          productId: p.produitId, // Correction ici: produitId doit être productId
          designation: p.designation,
          quantite: p.quantite,
          prixUnitaire: p.prixUnitaire,
          duree: p.duree,
          uniteDuree: p.uniteDuree,
          montantTotal: p.quantite * p.prixUnitaire * p.duree,
        })),
      });

      // 4. Mettre à jour la facture avec les nouveaux totaux
      const updatedFacture = await tx.invoice.update({
        where: { id },
        data: {
          totalHT,
          tva,
          totalTTC,
        },
        include: {
          produits: { include: { produit: true } },
        }
      });

      return updatedFacture;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erreur lors de la mise à jour des produits de la facture :", error);
    return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
  }
}


// DELETE /api/factures/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // On doit supprimer les lignes de produits associés avant de supprimer la facture elle-même
    await prisma.invoiceProduit.deleteMany({ where: { invoiceId: params.id } });
    await prisma.invoiceGestionnaire.deleteMany({ where: { invoiceId: params.id } });
    await prisma.invoice.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}