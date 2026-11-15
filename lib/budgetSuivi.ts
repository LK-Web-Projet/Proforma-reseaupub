import { ActionBudget, Prisma, StatutDemandeBudget, StatutDepassement, StatutLigneBudget } from "@prisma/client";

type Db = Prisma.TransactionClient;

// Tolérance d'arrondi sur les comparaisons de montants (Decimal 2 décimales).
export const BUDGET_EPSILON = 0.005;

type LigneMontants = {
  montant: Prisma.Decimal | number;
  montantAccorde: Prisma.Decimal | number | null;
  statutValidation: StatutLigneBudget | string;
};

/**
 * Montant ACCORDÉ d'une ligne — base de tout plafond de dépense. Une ligne en attente, à
 * corriger ou retirée n'a aucun plafond (0) ; une ligne accordée vaut le montant accordé par le
 * valideur, ou le montant demandé s'il l'a accordée telle quelle. Le champ `montant` reste le
 * montant DEMANDÉ (validation ligne par ligne, voir app/api/demandes-budget/[id]/lignes/).
 */
export function montantAccordeLigne(l: LigneMontants): number {
  if (l.statutValidation !== StatutLigneBudget.ACCORDEE) return 0;
  return Number(l.montantAccorde ?? l.montant);
}

/**
 * Plafond, consommé et reste d'une ligne de budget — toujours recalculés, jamais stockés :
 * - plafond  = montant accordé + Σ dépassements APPROUVÉS ;
 * - consommé = Σ dépenses NON annulées.
 */
export async function getLigneDisponible(db: Db, ligne: LigneMontants & { id: string }) {
  const [consomme, depassements] = await Promise.all([
    db.budgetDepense.aggregate({ where: { ligneId: ligne.id, annuleeAt: null }, _sum: { montant: true } }),
    db.budgetDepassement.aggregate({ where: { ligneId: ligne.id, statut: StatutDepassement.APPROUVE }, _sum: { montant: true } }),
  ]);
  const plafond = montantAccordeLigne(ligne) + Number(depassements._sum.montant ?? 0);
  const consommeNum = Number(consomme._sum.montant ?? 0);
  return { plafond, consomme: consommeNum, reste: plafond - consommeNum };
}

/** Totaux d'un budget entier : plafond (Σ accordé + dépassements approuvés) et consommé actif. */
export async function getBudgetTotaux(db: Db, demandeBudgetId: string) {
  const [lignes, consomme, depassements] = await Promise.all([
    db.demandeBudgetLigne.findMany({ where: { demandeBudgetId }, select: { montant: true, montantAccorde: true, statutValidation: true } }),
    db.budgetDepense.aggregate({ where: { demandeBudgetId, annuleeAt: null }, _sum: { montant: true } }),
    db.budgetDepassement.aggregate({ where: { demandeBudgetId, statut: StatutDepassement.APPROUVE }, _sum: { montant: true } }),
  ]);
  return {
    plafond: lignes.reduce((s, l) => s + montantAccordeLigne(l), 0) + Number(depassements._sum.montant ?? 0),
    consomme: Number(consomme._sum.montant ?? 0),
  };
}

/**
 * Recalcule le statut d'un budget ouvert après une dépense, une annulation ou un dépassement :
 * PAYEE si toutes les lignes ACCORDÉES sont soldées, EN_COURS s'il reste au moins une dépense
 * active, sinon VALIDEE. Un budget clôturé (clotureeAt) n'est jamais rouvert ; les statuts hors
 * circuit de dépense (SOUMISE, REJETEE) et VALIDATION_PARTIELLE (géré par majStatutApresDecision
 * tant que des lignes restent à décider) ne sont pas touchés.
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

  const toutSolde = demande.lignes
    .filter((l) => l.statutValidation === StatutLigneBudget.ACCORDEE)
    .every((l) => {
      const plafond = montantAccordeLigne(l) + Number(depassements.find((d) => d.ligneId === l.id)?._sum.montant ?? 0);
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
 * Budget de campagne : il est imprimé, signé en papier par la DG, puis validé sur la plateforme
 * avec le scan signé en pièce jointe (procédure de paiement, section 4). Renvoie le motif de refus
 * si ce scan manque, sinon null. Les autres types de budget ne sont pas concernés.
 */
export async function refusBudgetSigneManquant(
  db: Db,
  demande: { id: string; type: string }
): Promise<string | null> {
  if (demande.type !== "CAMPAGNE") return null;
  const nb = await db.demandeBudgetAttachment.count({
    where: { demandeBudgetId: demande.id, kind: "BUDGET_SIGNE", depenseId: null },
  });
  return nb > 0
    ? null
    : "Budget de campagne : imprimez-le, faites-le signer par la DG, puis joignez le scan signé (document « Budget signé ») avant de le valider.";
}

export type ResultatDecision = { statut: StatutDemandeBudget; devenuValide: boolean; devenuRejete: boolean };

/**
 * Met à jour le statut d'un budget après une décision sur une ligne (accorder, demander une
 * correction), une correction ou un retrait par le demandeur, ou un « tout valider » :
 * - toutes les lignes retirées → REJETEE ;
 * - plus aucune ligne EN_ATTENTE ni A_CORRIGER → VALIDEE (puis EN_COURS / PAYEE si des dépenses
 *   ont déjà été faites pendant la validation partielle) ;
 * - au moins une ligne accordée et d'autres en cours → VALIDATION_PARTIELLE ;
 * - aucune accordée → reste SOUMISE.
 * Recalcule aussi montantTotal (demandé) = Σ montants demandés des lignes non retirées.
 */
export async function majStatutApresDecision(
  db: Db,
  demandeBudgetId: string,
  auteur: { email: string; name?: string | null }
): Promise<ResultatDecision | null> {
  const demande = await db.demandeBudget.findUnique({ where: { id: demandeBudgetId }, include: { lignes: true } });
  if (!demande) return null;
  const enDecision: StatutDemandeBudget[] = [StatutDemandeBudget.SOUMISE, StatutDemandeBudget.VALIDATION_PARTIELLE];
  if (!enDecision.includes(demande.statut)) return { statut: demande.statut, devenuValide: false, devenuRejete: false };

  const actives = demande.lignes.filter((l) => l.statutValidation !== StatutLigneBudget.RETIREE);
  const montantTotal = actives.reduce((s, l) => s + Number(l.montant), 0);

  if (actives.length === 0) {
    await db.demandeBudget.update({
      where: { id: demandeBudgetId },
      data: {
        statut: StatutDemandeBudget.REJETEE,
        rejectionReason: "Toutes les lignes ont été retirées du budget.",
        validatedByEmail: auteur.email,
        validatedAt: new Date(),
      },
    });
    await logBudget(db, { demandeBudgetId, action: ActionBudget.REJET, auteurEmail: auteur.email, auteurNom: auteur.name, details: "Toutes les lignes ont été retirées du budget." });
    return { statut: StatutDemandeBudget.REJETEE, devenuValide: false, devenuRejete: true };
  }

  const resteADecider = actives.some(
    (l) => l.statutValidation === StatutLigneBudget.EN_ATTENTE || l.statutValidation === StatutLigneBudget.A_CORRIGER
  );
  const auMoinsUneAccordee = actives.some((l) => l.statutValidation === StatutLigneBudget.ACCORDEE);

  if (!resteADecider) {
    await db.demandeBudget.update({
      where: { id: demandeBudgetId },
      data: { statut: StatutDemandeBudget.VALIDEE, montantTotal, validatedByEmail: auteur.email, validatedAt: new Date() },
    });
    const totaux = await getBudgetTotaux(db, demandeBudgetId);
    await logBudget(db, {
      demandeBudgetId,
      action: ActionBudget.VALIDATION,
      auteurEmail: auteur.email,
      auteurNom: auteur.name,
      montant: totaux.plafond,
      details: `Toutes les lignes sont décidées — accordé ${totaux.plafond.toLocaleString("fr-FR")} FCFA sur ${montantTotal.toLocaleString("fr-FR")} FCFA demandés`,
    });
    const statut = (await recalculerStatutBudget(db, demandeBudgetId)) ?? StatutDemandeBudget.VALIDEE;
    return { statut, devenuValide: true, devenuRejete: false };
  }

  const statut = auMoinsUneAccordee ? StatutDemandeBudget.VALIDATION_PARTIELLE : StatutDemandeBudget.SOUMISE;
  if (statut !== demande.statut || Number(demande.montantTotal) !== montantTotal) {
    await db.demandeBudget.update({ where: { id: demandeBudgetId }, data: { statut, montantTotal } });
  }
  return { statut, devenuValide: false, devenuRejete: false };
}

/**
 * À la clôture d'un budget en validation partielle, les lignes encore en attente ou à corriger
 * sont retirées (avec trace) : seules les lignes accordées restent dans le budget clôturé.
 */
export async function retirerLignesNonAccordees(db: Db, demandeBudgetId: string, auteurEmail: string) {
  const lignes = await db.demandeBudgetLigne.findMany({
    where: { demandeBudgetId, statutValidation: { in: [StatutLigneBudget.EN_ATTENTE, StatutLigneBudget.A_CORRIGER] } },
  });
  for (const l of lignes) {
    await db.demandeBudgetLigne.update({
      where: { id: l.id },
      data: { statutValidation: StatutLigneBudget.RETIREE, decideParEmail: auteurEmail, decideAt: new Date(), motifDecision: "Budget clôturé" },
    });
    await logBudget(db, { demandeBudgetId, action: ActionBudget.LIGNE_RETIREE, auteurEmail, montant: Number(l.montant), details: `${l.designation} — retirée : budget clôturé` });
  }
  return lignes.length;
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
      statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.EN_COURS, StatutDemandeBudget.VALIDATION_PARTIELLE] },
      clotureeAt: null,
    },
    select: { id: true, numero: true },
  });

  const clotures: string[] = [];
  for (const b of echus) {
    // updateMany conditionnel : si deux appels se croisent, un seul clôture et journalise.
    const res = await db.demandeBudget.updateMany({
      where: { id: b.id, clotureeAt: null, statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.EN_COURS, StatutDemandeBudget.VALIDATION_PARTIELLE] } },
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
    await retirerLignesNonAccordees(db, b.id, "système");
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
