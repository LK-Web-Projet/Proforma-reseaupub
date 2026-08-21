import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { getEntrepriseConfig } from "@/lib/entreprise";
import { safeCreatedById } from "@/lib/authz";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filtres
    const statut = searchParams.get("statut");
    const clientId = searchParams.get("clientId");
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");
    const objet = searchParams.get("objet");
    const year = searchParams.get("year");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: { [key: string]: any } = {};

    if (statut) where.statut = statut;
    if (clientId) where.clientId = clientId;
    if (objet) where.objet = { contains: objet, mode: "insensitive" };

    if (year) {
      const parsedYear = parseInt(year, 10);
      where.dateCreation = {
        gte: new Date(`${parsedYear}-01-01T00:00:00.000Z`),
        lt: new Date(`${parsedYear + 1}-01-01T00:00:00.000Z`),
      };
    } else if (dateMin || dateMax) {
      where.dateCreation = {};
      if (dateMin) where.dateCreation.gte = new Date(dateMin);
      if (dateMax) where.dateCreation.lte = new Date(dateMax);
    }
    // Si year est vide ET pas de dateMin/dateMax, on affiche TOUTES les factures

    const factures = await prisma.invoice.findMany({
      where,
      orderBy: { dateCreation: "desc" },
      include: {
        client: true,
        produits: true,
        gestionnaires: {
          include: {
            gestionnaire: true,
          },
        },
      },
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
    const { userId } = await auth();
    const { clientNom, objet, produits, gestionnaireId, devise, paymentConditionPercentage, info, isTaxExempt } = await request.json();

    if (!clientNom || !objet || !produits || !produits.length) {
      return NextResponse.json(
        { error: "Données manquantes pour créer la facture." },
        { status: 400 }
      );
    }
    
    // Vérification des doublons de produits
    const productDesignations = produits.map((p: { designation: string }) => p.designation);
    const uniqueProductDesignations = new Set(productDesignations);
    if (uniqueProductDesignations.size !== productDesignations.length) {
      return NextResponse.json(
        { error: "Impossible d'ajouter le même produit plusieurs fois." },
        { status: 400 }
      );
    }


    // Utilisation d'une transaction pour garantir l'intégrité des données
    const newInvoice = await prisma.$transaction(async (tx) => {
    // 0. Récupérer la config entreprise depuis la DB
      const entreprise = await getEntrepriseConfig();
      const createdById = await safeCreatedById(tx, userId);

      // 1. Gestion du client : trouver ou créer
      let client: { id: string; nom: string; adresse: string | null; email: string | null; telephone: string | null; } | null = await tx.client.findFirst({
        where: { nom: clientNom },
      });

      if (!client) {
        client = await tx.client.create({
          data: { nom: clientNom },
        });
      }

      // 2. Calcul des totaux
      let totalHT = 0;
      for (const prod of produits) {
        const quantite = Number(prod.quantite) || 1;
        const prixUnitaire = Number(prod.prixUnitaire) || 0;
        const duree = Number(prod.duree) || 1;
        const inclureDuree = prod.includeduree ?? false;
        let montantTotalLigne = quantite * prixUnitaire;
        if (inclureDuree) {
          montantTotalLigne *= duree;
        }
        totalHT += montantTotalLigne;
      }
      const tva = isTaxExempt ? 0 : totalHT * 0.18;
      const totalTTC = totalHT + tva;

      // 3. Génération du numéro de facture
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const shortYear = year.toString().slice(-2);
      const lastInvoiceOfTheYear = await tx.invoice.findFirst({
        where: {
          numero: {
            startsWith: `RP-PRO-${shortYear}/`,
          },
        },
        orderBy: {
          numero: 'desc',
        },
      });

      let nextSequence = 1;
      if (lastInvoiceOfTheYear) {
        const lastSequence = parseInt(lastInvoiceOfTheYear.numero.split('-').pop() || '0', 10);
        nextSequence = lastSequence + 1;
      }

      const formattedMonth = month.toString().padStart(2, '0');
      const formattedSequence = nextSequence.toString().padStart(4, '0');
      const newNumero = `RP-PRO-${shortYear}/${formattedMonth}-${formattedSequence}`;

      // 4. Création de la facture
      const facture = await tx.invoice.create({
        data: {
          numero: newNumero,
          objet,
          clientId: client.id,
          statut: "Brouillon",
          totalHT,
          tva,
          totalTTC,
          resteAPayer: totalTTC, // Initialiser le reste à payer avec le total TTC
          societeNom: entreprise.nom,
          societeIFU: entreprise.ifu,
          societeAdresse: entreprise.adresse,
          devise: devise || "XOF",
          paymentConditionPercentage: paymentConditionPercentage,
          info,
          isTaxExempt: isTaxExempt || false,
          createdById,
        },
      });

      // 4. Création des lignes de produits
      await Promise.all(
        produits.map(async (p: { quantite: number; prixUnitaire: number; duree: number; includeduree: boolean; designation: string; uniteDuree: "jour" | "heure" | "mois"; }) => {
          const quantite = Number(p.quantite) || 1;
          const prixUnitaire = Number(p.prixUnitaire) || 0;
          const duree = Number(p.duree) || 1;
          const inclureDuree = p.includeduree ?? false;
          let montantTotal = quantite * prixUnitaire;
          if (inclureDuree) {
            montantTotal *= duree;
          }

          let produit = await tx.produit.findUnique({
            where: { nom: p.designation },
          });

          if (!produit) {
            produit = await tx.produit.create({
              data: {
                nom: p.designation,
                prixUnitaire: prixUnitaire,
              },
            });
          }

          await tx.invoiceProduit.create({
            data: {
              invoiceId: facture.id,
              productId: produit.id,
              designation: p.designation,
              quantite,
              prixUnitaire,
              duree,
              uniteDuree: p.uniteDuree || "jour",
              montantTotal,
              includeduree: inclureDuree,
            },
          });
        })
      );

      // 5. Association du gestionnaire (si fourni)
      if (gestionnaireId) {
        await tx.invoiceGestionnaire.create({
          data: {
            invoiceId: facture.id,
            gestionnaireId: gestionnaireId,
          },
        });
      }

      return facture;
    });

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la facture :", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.join(', ');
        return NextResponse.json(
          { error: `Unicité violée: le champ '${target}' existe déjà.` },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}
