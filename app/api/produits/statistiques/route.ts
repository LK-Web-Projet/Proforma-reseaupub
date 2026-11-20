import { requireAnyPage } from "@/lib/authz";
import { NextResponse } from "next/server";
import { StatusFacture } from "@prisma/client";
import prisma from "@/lib/prisma";

// Mêmes taux et mêmes statuts "CA réalisé" que app/api/statistiques/route.ts (topProducts).
const EXCHANGE_RATES: Record<string, number> = { EUR: 655.957, USD: 615, XOF: 1 };
const REVENUE_STATUSES: StatusFacture[] = [StatusFacture.Valider, StatusFacture.Payer, StatusFacture.Solde];

// GET /api/produits/statistiques - Agrégat par produit : quantité vendue, CA réalisé (XOF), nombre de factures
export async function GET() {
  const refusAcces = await requireAnyPage(["produits"]);
  if (refusAcces) return refusAcces;
  try {
    const [produits, lignes] = await Promise.all([
      prisma.produit.findMany({ orderBy: { nom: "asc" } }),
      prisma.invoiceProduit.findMany({
        where: { invoice: { statut: { in: REVENUE_STATUSES } } },
        select: {
          productId: true,
          invoiceId: true,
          quantite: true,
          montantTotal: true,
          invoice: { select: { devise: true } },
        },
      }),
    ]);

    const parProduit = new Map<string, { quantiteVendue: number; montantTotal: number; factureIds: Set<string> }>();
    for (const ligne of lignes) {
      const rate = EXCHANGE_RATES[ligne.invoice.devise] ?? 1;
      const current = parProduit.get(ligne.productId) ?? {
        quantiteVendue: 0,
        montantTotal: 0,
        factureIds: new Set<string>(),
      };
      current.quantiteVendue += ligne.quantite;
      current.montantTotal += Number(ligne.montantTotal) * rate;
      current.factureIds.add(ligne.invoiceId);
      parProduit.set(ligne.productId, current);
    }

    const resultat = produits.map((produit) => {
      const agg = parProduit.get(produit.id);
      return {
        id: produit.id,
        nom: produit.nom,
        actif: produit.actif,
        prixUnitaire: Number(produit.prixUnitaire),
        quantiteVendue: agg?.quantiteVendue ?? 0,
        montantTotal: Math.round(agg?.montantTotal ?? 0),
        nombreFactures: agg?.factureIds.size ?? 0,
      };
    });

    return NextResponse.json(resultat);
  } catch (error) {
    console.error("Erreur lors du calcul des statistiques produits :", error);
    return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
  }
}
