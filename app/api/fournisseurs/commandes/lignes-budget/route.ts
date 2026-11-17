import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePage } from "@/lib/authz";
import { lignesBudgetPourCommande } from "@/lib/commandeFournisseurSuivi";

/**
 * GET /api/fournisseurs/commandes/lignes-budget?proformaId=…&commandeId=…
 * Lignes de budget proposées pour financer un bon de commande, selon SA proforma (une seule par bon) :
 * - `aBudget: true` → lignes accordées du budget de la proforma, ligne OBLIGATOIRE ;
 * - `aBudget: false` → lignes des budgets sans proforma (mensuel, ponctuel…), au choix.
 * Chaque ligne porte ce qui reste à engager (`reste`). `commandeId` : bon en cours de modification
 * (son propre montant n'est pas compté comme engagé).
 */
export async function GET(request: Request) {
  const refusPage = await requirePage("fournisseurs");
  if (refusPage) return refusPage;
  const { searchParams } = new URL(request.url);
  try {
    const resultat = await lignesBudgetPourCommande(prisma, {
      proformaId: searchParams.get("proformaId") || null,
      commandeIdExclu: searchParams.get("commandeId") || null,
    });
    return NextResponse.json(resultat);
  } catch (error) {
    console.error("Erreur lors du chargement des lignes de budget pour un bon de commande:", error);
    return NextResponse.json({ error: "Impossible de charger les lignes de budget." }, { status: 500 });
  }
}
