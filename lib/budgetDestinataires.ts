import prisma from "@/lib/prisma";

// Destinataires des notifications selon les droits cochés sur les rôles. Module volontairement
// SANS dépendance à Clerk : il est chargé par la minuterie interne (lib/taches/planificateur.ts,
// démarrée par instrumentation.ts), où l'import de @clerk/nextjs échoue en production (voir
// next.config.ts). Réexporté par lib/budgetAuth.ts pour les appelants existants.

export type BudgetFlag = "canValidateBudgetMensuel" | "canValidateBudget" | "canPayBudget" | "canSaisirCaisse";

/** Emails des utilisateurs actifs dont le rôle porte le droit demandé (destinataires des notifications). */
export async function getBudgetRecipients(flag: BudgetFlag): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { active: true, role: { [flag]: true } },
    select: { email: true },
  });
  return Array.from(new Set(users.map((u) => u.email)));
}
