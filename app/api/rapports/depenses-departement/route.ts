import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget } from "@/lib/budgetAuth";
import { chargerRapportDepensesDepartement, periodeRapport } from "@/lib/depensesDepartementServeur";

/**
 * GET /api/rapports/depenses-departement?from=yyyy-MM&to=yyyy-MM — dépenses réelles par département,
 * comptées dans le mois où l'argent est sorti (voir lib/depensesDepartement.ts). Par défaut les 6
 * derniers mois, 24 au plus. Le mois qui précède `from` est chargé aussi, pour la comparaison.
 * Réservé aux rôles du circuit budget, comme le suivi budgétaire.
 */
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!isImpliqueBudget(caps)) {
    return NextResponse.json({ error: "Rapport réservé aux rôles du circuit budget." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { from, to } = periodeRapport(searchParams.get("from"), searchParams.get("to"));
    return NextResponse.json(await chargerRapportDepensesDepartement(prisma, from, to));
  } catch (error) {
    console.error("Erreur lors du rapport des dépenses par département :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
