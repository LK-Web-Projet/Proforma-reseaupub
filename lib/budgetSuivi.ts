import { ActionBudget, Prisma, StatutDemandeBudget, StatutDepassement } from "@prisma/client";

type Db = Prisma.TransactionClient;

// Tolérance d'arrondi sur les comparaisons de montants (Decimal 2 décimales).
export const BUDGET_EPSILON = 0.005;

/**
 * Plafond, consommé et reste d'une ligne de budget — toujours recalculés, jamais stockés :
 * - plafond  = montant prévu + Σ dépassements APPROUVÉS ;
 * - consommé = Σ dépenses NON annulées.
 */
export async function getLigneDisponible(db: Db, ligne: { id: string; montant: Prisma.Decimal | number }) {
  const [consomme, depassements] = await Promise.all([
    db.budgetDepense.aggregate({ where: { ligneId: ligne.id, annuleeAt: null }, _sum: { montant: true } }),
    db.budgetDepassement.aggregate({ where: { ligneId: ligne.id, statut: StatutDepassement.APPROUVE }, _sum: { montant: true } }),
  ]);
  const plafond = Number(ligne.montant) + Number(depassements._sum.montant ?? 0);
  const consommeNum = Number(consomme._sum.montant ?? 0);
  return { plafond, consomme: consommeNum, reste: plafond - consommeNum };
}

/** Totaux d'un budget entier : plafond (prévu + dépassements approuvés) et consommé actif. */
export async function getBudgetTotaux(db: Db, demandeBudgetId: string) {
  const [demande, consomme, depassements] = await Promise.all([
    db.demandeBudget.findUnique({ where: { id: demandeBudgetId }, select: { montantTotal: true } }),
    db.budgetDepense.aggregate({ where: { demandeBudgetId, annuleeAt: null }, _sum: { montant: true } }),
    db.budgetDepassement.aggregate({ where: { demandeBudgetId, statut: StatutDepassement.APPROUVE }, _sum: { montant: true } }),
  ]);
  return {
    plafond: Number(demande?.montantTotal ?? 0) + Number(depassements._sum.montant ?? 0),
    consomme: Number(consomme._sum.montant ?? 0),
  };
}

/**
 * Recalcule le statut d'un budget ouvert après une dépense, une annulation ou un dépassement :
 * PAYEE si toutes les lignes sont soldées, EN_COURS s'il reste au moins une dépense active,
 * sinon VALIDEE. Un budget clôturé manuellement (clotureeAt) n'est jamais rouvert, et les
 * statuts hors circuit de dépense (SOUMISE, REJETEE) ne sont pas touchés.
 */
export async function recalculerStatutBudget(db: Db, demandeBudgetId: string, opts: { datePaiement?: Date; nomReceveur?: string } = {}) {
  const demande = await db.demandeBudget.findUnique({ where: { id: demandeBudgetId }, include: { lignes: true } });
  if (!demande || demande.clotureeAt) return demande?.statut ?? null;
  const ouverts: StatutDemandeBudget[] = [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.EN_COURS, StatutDemandeBudget.PAYEE];
  if (!ouverts.includes(demande.statut)) return demande.statut;

  const [consommes, depassements] = await Promise.all([
    db.budgetDepense.groupBy({ by: ["ligneId"], where: { demandeBudgetId, annuleeAt: null }, _sum: { montant: true } }),
    db.budgetDepassement.groupBy({ by: ["ligneId"], where: { demandeBudgetId, statut: StatutDepassement.APPROUVE }, _sum: { montant: true } }),
  ]);
  if (consommes.length === 0) {
    // Ancienne demande payée hors suivi par dépenses : on ne la rouvre pas.
    if (demande.statut === StatutDemandeBudget.PAYEE) return demande.statut;
    if (demande.statut !== StatutDemandeBudget.VALIDEE) {
      await db.demandeBudget.update({ where: { id: demandeBudgetId }, data: { statut: StatutDemandeBudget.VALIDEE } });
    }
    return StatutDemandeBudget.VALIDEE;
  }

  const toutSolde = demande.lignes.every((l) => {
    const plafond = Number(l.montant) + Number(depassements.find((d) => d.ligneId === l.id)?._sum.montant ?? 0);
    const consomme = Number(consommes.find((c) => c.ligneId === l.id)?._sum.montant ?? 0);
    return consomme >= plafond - BUDGET_EPSILON;
  });
  const statut = toutSolde ? StatutDemandeBudget.PAYEE : StatutDemandeBudget.EN_COURS;
  if (statut !== demande.statut || (toutSolde && opts.datePaiement)) {
    await db.demandeBudget.update({
      where: { id: demandeBudgetId },
      data: toutSolde && opts.datePaiement
        ? { statut, datePaiement: opts.datePaiement, nomReceveur: opts.nomReceveur }
        : { statut },
    });
  }
  return statut;
}

/** Ajoute une ligne au journal d'audit du budget (jamais modifiée ensuite). */
export function logBudget(
  db: Db,
  entry: {
    demandeBudgetId: string;
    action: ActionBudget;
    auteurEmail: string;
    auteurNom?: string | null;
    details?: string | null;
    montant?: number | null;
  }
) {
  return db.budgetHistorique.create({
    data: {
      demandeBudgetId: entry.demandeBudgetId,
      action: entry.action,
      auteurEmail: entry.auteurEmail,
      auteurNom: entry.auteurNom ?? null,
      details: entry.details ?? null,
      montant: entry.montant ?? null,
    },
  });
}

/** Seuils d'alerte de consommation franchis par une dépense (80 % et 100 % du plafond de la ligne). */
export function seuilsFranchis(avant: number, apres: number, plafond: number): (80 | 100)[] {
  if (plafond <= 0) return [];
  const pctAvant = (avant / plafond) * 100;
  const pctApres = (apres / plafond) * 100;
  const seuils: (80 | 100)[] = [];
  if (pctAvant < 80 && pctApres >= 80 && pctApres < 99.999) seuils.push(80);
  if (pctAvant < 99.999 && pctApres >= 99.999) seuils.push(100);
  return seuils;
}
