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

/**
 * À la clôture d'un budget, ses dépassements encore en attente n'ont plus d'objet : ils sont
 * refusés automatiquement (avec trace), plutôt que de rester affichés avec des boutons qui échouent.
 */
export async function refuserDepassementsEnAttente(db: Db, demandeBudgetId: string, auteurEmail: string) {
  const enAttente = await db.budgetDepassement.findMany({
    where: { demandeBudgetId, statut: StatutDepassement.EN_ATTENTE },
    include: { ligne: { select: { designation: true } } },
  });
  for (const d of enAttente) {
    await db.budgetDepassement.update({
      where: { id: d.id },
      data: { statut: StatutDepassement.REJETE, decideParEmail: auteurEmail, decideAt: new Date(), motifRejet: "Budget clôturé" },
    });
    await logBudget(db, {
      demandeBudgetId,
      action: ActionBudget.DEPASSEMENT_REJETE,
      auteurEmail,
      montant: Number(d.montant),
      details: `${d.ligne.designation} — refusé automatiquement : budget clôturé`,
    });
  }
  return enAttente.length;
}

/**
 * Un seul budget mensuel par service et par mois : renvoie le numéro du budget déjà existant
 * (hors demandes rejetées, qui seront corrigées et resoumises) ou null s'il n'y en a pas.
 */
export async function budgetMensuelExistant(
  db: Db,
  { departement, periodeMois, excludeId }: { departement: string; periodeMois: Date; excludeId?: string }
): Promise<string | null> {
  const debut = new Date(Date.UTC(periodeMois.getUTCFullYear(), periodeMois.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(periodeMois.getUTCFullYear(), periodeMois.getUTCMonth() + 1, 1));
  const existant = await db.demandeBudget.findFirst({
    where: {
      type: "MENSUEL",
      departement: { equals: departement, mode: "insensitive" },
      periodeMois: { gte: debut, lt: fin },
      statut: { not: StatutDemandeBudget.REJETEE },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { numero: true },
  });
  return existant?.numero ?? null;
}

// Délai de grâce après la fin du mois avant la clôture automatique d'un budget mensuel :
// laisse le temps d'enregistrer les dernières dépenses (reçus arrivés en retard).
export const JOURS_GRACE_CLOTURE_MENSUELLE = 5;

/**
 * Clôture automatique des budgets mensuels dont le mois est terminé depuis plus de
 * JOURS_GRACE_CLOTURE_MENSUELLE jours (statut VALIDEE ou EN_COURS → PAYEE, reste figé).
 * Idempotente : appelée à l'ouverture de la liste des budgets, avant chaque dépense, et par la
 * route planifiable /api/cron/budgets-cloture. Renvoie les numéros clôturés.
 */
export async function cloturerBudgetsMensuelsEchus(db: Db, now = new Date()): Promise<string[]> {
  // Mois dont la fin + délai de grâce est dépassée : periodeMois < 1er du mois de (now - grâce).
  const reference = new Date(now.getTime() - JOURS_GRACE_CLOTURE_MENSUELLE * 24 * 3600 * 1000);
  const limite = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));

  const echus = await db.demandeBudget.findMany({
    where: {
      type: "MENSUEL",
      periodeMois: { lt: limite },
      statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.EN_COURS] },
      clotureeAt: null,
    },
    select: { id: true, numero: true },
  });

  const clotures: string[] = [];
  for (const b of echus) {
    // updateMany conditionnel : si deux appels se croisent, un seul clôture et journalise.
    const res = await db.demandeBudget.updateMany({
      where: { id: b.id, clotureeAt: null, statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.EN_COURS] } },
      data: { statut: StatutDemandeBudget.PAYEE, clotureeAt: now, clotureeParEmail: "clôture automatique" },
    });
    if (res.count === 0) continue;
    const { consomme, plafond } = await getBudgetTotaux(db, b.id);
    await logBudget(db, {
      demandeBudgetId: b.id,
      action: ActionBudget.CLOTURE,
      auteurEmail: "système",
      auteurNom: "Clôture automatique (fin de mois)",
      montant: consomme,
      details: `Consommé ${consomme.toLocaleString("fr-FR")} / ${plafond.toLocaleString("fr-FR")} FCFA — reste figé : ${Math.max(plafond - consomme, 0).toLocaleString("fr-FR")} FCFA`,
    });
    await refuserDepassementsEnAttente(db, b.id, "système");
    clotures.push(b.numero);
  }
  return clotures;
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
