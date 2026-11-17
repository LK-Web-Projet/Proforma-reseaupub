import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { cloturerBudgetsMensuelsEchus, JOURS_GRACE_CLOTURE_MENSUELLE } from "@/lib/budgetSuivi";

/**
 * POST /api/integration/budgets/cloture-mensuelle — clôture les budgets mensuels dont le mois
 * est terminé depuis plus de JOURS_GRACE_CLOTURE_MENSUELLE jours. À appeler une fois par jour
 * par une tâche planifiée du serveur (cron), avec `Authorization: Bearer <INTEGRATION_API_KEY>`.
 * La même clôture est aussi déclenchée à l'ouverture de la liste des budgets et avant chaque
 * dépense : cette route n'est qu'un filet de sécurité, l'opération est idempotente.
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  try {
    const clotures = await cloturerBudgetsMensuelsEchus(prisma);
    return NextResponse.json({ clotures, nombre: clotures.length, delaiGraceJours: JOURS_GRACE_CLOTURE_MENSUELLE });
  } catch (error) {
    console.error("Erreur lors de la clôture automatique des budgets mensuels:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
