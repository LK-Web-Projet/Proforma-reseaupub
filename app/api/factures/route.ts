import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filtres
    const statut = searchParams.get("statut");
    const clientId = searchParams.get("clientId");
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");
    const objet = searchParams.get("objet");

    const where: any = {};

    if (statut) where.statut = statut;
    if (clientId) where.clientId = clientId;
    if (objet) where.objet = { contains: objet, mode: "insensitive" };
    if (dateMin || dateMax) {
      where.dateCreation = {};
      if (dateMin) where.dateCreation.gte = new Date(dateMin);
      if (dateMax) where.dateCreation.lte = new Date(dateMax);
    }

    const factures = await prisma.invoice.findMany({
      where,
      orderBy: { dateCreation: "desc" },
      include: { client: true, produits: true },
    });

    return NextResponse.json(factures);
  } catch (error) {
    console.error("Erreur lors de la récupération des factures :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}

// POST /api/factures
export async function POST(request: Request) {
  try {
    const { clientNom, objet, produits } = await request.json();

    if (!clientNom || !objet || !produits || !produits.length) {
      return NextResponse.json(
        { error: "Données manquantes pour créer la facture." },
        { status: 400 }
      );
    }

    // Utilisation d'une transaction pour garantir l'intégrité des données
    // Soit tout réussit, soit tout est annulé.
    const newInvoice = await prisma.$transaction(async (tx) => {
      // 1. Gestion du client : trouver ou créer
      let client = await tx.client.findFirst({
        where: { nom: clientNom },
      });

      if (!client) {
        client = await tx.client.create({
          data: { nom: clientNom },
        });
      }

      // 2. Calcul des totaux en amont
      let totalHT = 0;
      for (const prod of produits) {
        const quantite = Number(prod.quantite) || 1;
        const prixUnitaire = Number(prod.prixUnitaire) || 0;
        const duree = Number(prod.duree) || 1;
        const inclureDuree = prod.inclureDuree ?? false;

        let montantTotalLigne = quantite * prixUnitaire;
        if (inclureDuree) {
          montantTotalLigne *= duree;
        }
        totalHT += montantTotalLigne;
      }

      const tva = totalHT * 0.18;
      const totalTTC = totalHT + tva;

      // 3. Création de la facture et des lignes de produits associées en une seule opération
      // 1. Création de la facture
      const facture = await tx.invoice.create({
        data: {
          numero: "PRO-" + Date.now(),
          objet,
          clientId: client.id,
          statut: "brouillon",
          totalHT,
          tva,
          totalTTC,
          societeNom: "Ma Société", // À remplir dynamiquement
          societeIFU: "1234567890", // À remplir dynamiquement
        },
      });

      // 2. Création des lignes de produits
      await Promise.all(
        produits.map(async (p) => {
          const quantite = Number(p.quantite) || 1;
          const prixUnitaire = Number(p.prixUnitaire) || 0;
          const duree = Number(p.duree) || 1;
          const inclureDuree = p.inclureDuree ?? false;
          let montantTotal = quantite * prixUnitaire;
          if (inclureDuree) {
            montantTotal *= duree;
          }

          // Recherche du produit existant
          let produit = await tx.produit.findUnique({
            where: { nom: p.designation },
          });

          if (!produit) {
            // Création seulement si le produit n'existe pas
            produit = await tx.produit.create({
              data: {
                nom: p.designation,
                prixUnitaire: prixUnitaire,
              },
            });
          }

          // Création de la ligne de facture (InvoiceProduit)
          await tx.invoiceProduit.create({
            data: {
              invoiceId: facture.id, // ici facture existe bien
              productId: produit.id,
              designation: p.designation,
              quantite: quantite,
              prixUnitaire: prixUnitaire,
              duree: duree,
              uniteDuree: p.uniteDuree || "jour",
              montantTotal,
            },
          });
        })
      );

      return facture;
    });

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la facture :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}
