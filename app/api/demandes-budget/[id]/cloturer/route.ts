import { NextResponse } from "next/server";
import { ActionBudget, StatutDemandeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getBudgetTotaux, logBudget } from "@/lib/budgetSuivi";
import { requireBudgetUser } from "@/lib/budgetAuth";

// POST /api/demandes-budget/[id]/cloturer — clôt un budget partiellement consommé (ex. fin de
// mois) : il passe à PAYEE, plus aucune dépense ne peut y être imputée, le reste est figé.
// Réservé au comptable (canPay) et à l'admin (canValidateMensuel).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canPay && !caps.canValidateMensuel) {
    return NextResponse.json({ error: "Réservé au comptable ou à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== StatutDemandeBudget.VALIDEE && existing.statut !== StatutDemandeBudget.EN_COURS) {
      return NextResponse.json({ error: "Seul un budget validé ou en cours peut être clôturé." }, { status: 400 });
    }

    const demande = await prisma.$transaction(async (tx) => {
      const { consomme, plafond } = await getBudgetTotaux(tx, id);
      const updated = await tx.demandeBudget.update({
        where: { id },
        data: { statut: StatutDemandeBudget.PAYEE, clotureeAt: new Date(), clotureeParEmail: caps.email },
      });
      await logBudget(tx, {
        demandeBudgetId: id,
        action: ActionBudget.CLOTURE,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        montant: consomme,
        details: `Consommé ${consomme.toLocaleString("fr-FR")} / ${plafond.toLocaleString("fr-FR")} FCFA — reste figé : ${Math.max(plafond - consomme, 0).toLocaleString("fr-FR")} FCFA`,
      });
      return updated;
    });

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la clôture de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
