import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { requirePage } from "@/lib/authz";
import { toPeriodeMois } from "@/lib/budgetSchema";
import { BudgetCollectifError, membresDepartements, mensuelDuMois, ouvrirBudgetCollectif } from "@/lib/budgetCollectifServeur";
import { sendBudgetCollectifInvitation } from "@/lib/email/demandeBudget";

/** GET /api/demandes-budget/collectif?mois=yyyy-MM — budget mensuel déjà ouvert pour ce mois (un seul par mois). */
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const refusPage = await requirePage("budget");
  if (refusPage) return refusPage;
  const periode = toPeriodeMois(new URL(request.url).searchParams.get("mois") ?? undefined);
  if (!periode) return NextResponse.json({ existant: null });
  return NextResponse.json({ existant: await mensuelDuMois(prisma, periode) });
}

/**
 * POST /api/demandes-budget/collectif — ouvrir un budget collectif en préparation (JSON : type MENSUEL
 * ou CAMPAGNE, periodeMois, proformaId, contexteMotivation, departementIds, dateLimiteSaisie). Les
 * membres des départements invités sont prévenus.
 */
export async function POST(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const refusPage = await requirePage("budget");
  if (refusPage) return refusPage;
  try {
    const corps = await request.json();
    const r = await prisma.$transaction((tx) => ouvrirBudgetCollectif(tx, caps, corps), { timeout: 30000 });
    const to = await membresDepartements(prisma, r.departementIds, [caps.email]);
    sendBudgetCollectifInvitation(r.demande, { to, departements: r.noms, auteur: caps.name || caps.email }).catch((err) =>
      console.error("Erreur lors de l'envoi des invitations au budget collectif :", err)
    );
    return NextResponse.json({ id: r.demande.id, numero: r.demande.numero }, { status: 201 });
  } catch (error) {
    if (error instanceof BudgetCollectifError) return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
    console.error("Erreur lors de l'ouverture d'un budget collectif :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
