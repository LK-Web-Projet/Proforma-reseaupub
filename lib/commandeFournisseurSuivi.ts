import { NatureDepense, Prisma, StatutCommandeFournisseur, StatutDemandeBudget, StatutFactureFournisseur } from "@prisma/client";
import { BUDGET_EPSILON, getLigneDisponible } from "@/lib/budgetSuivi";
import { etatLiasse, partsLignesCommande, payeSurCommande, repartirAuProrata } from "@/lib/commandeFournisseurLiasse";
import { exigeBonDeCommande } from "@/lib/typeFournisseur";

type Db = Prisma.TransactionClient;

/** Erreur métier d'un paiement sur bon de commande → 400 avec le message tel quel. */
export class PaiementCommandeError extends Error {}

const fmt = (n: number) => `${Math.max(n, 0).toLocaleString("fr-FR")} FCFA`;

/**
 * Contrôles d'une avance ou d'un solde sur un bon de commande (procédure, section 4), à appeler
 * dans la transaction de la dépense, APRÈS les contrôles de la ligne de budget éventuelle :
 * - avec budget : le BC finance CETTE ligne de budget ; sans budget (campagne sans budget) : le BC
 *   n'est rattaché à aucune ligne de budget et il est lié à la proforma de la dépense ;
 * - le BC est validé (signé par la DG) ou livré ; AVANCE : BC signé joint ; SOLDE : liasse complète
 *   et facture fournisseur du BC choisie ;
 * - le montant ne dépasse ni le reste du BC, ni celui de la ligne de produit visée ; sans ligne de
 *   produit (« tout le bon »), il est réparti au prorata du reste de chaque ligne.
 * Le payé vient des imputations (ImputationCommande), quelle que soit l'origine du paiement.
 * Verrouille le BC (deux paiements simultanés ne peuvent pas dépasser son montant ensemble).
 */
export async function controlerPaiementCommande(
  tx: Db,
  opts: {
    commandeId: string;
    ligneBudgetId: string | null;
    invoiceId?: string | null;
    nature: NatureDepense;
    montant: number;
    factureFournisseurId?: string | null;
    ligneCommandeId?: string | null;
  }
) {
  if (opts.nature === NatureDepense.NORMALE) {
    throw new PaiementCommandeError("Un paiement sur bon de commande est une avance ou un solde.");
  }
  await tx.$queryRaw`SELECT id FROM "CommandeFournisseur" WHERE id = ${opts.commandeId} FOR UPDATE`;
  const commande = await tx.commandeFournisseur.findUnique({
    where: { id: opts.commandeId },
    include: {
      documents: { select: { kind: true } },
      factures: { select: { id: true, reference: true, pieceJointe: true, status: true } },
      lignes: { select: { id: true, designation: true, prixTotal: true }, orderBy: { id: "asc" } },
      imputations: { select: { ligneCommandeId: true, montant: true, annuleeAt: true } },
      proformas: { select: { invoiceId: true } },
      ligneBudget: { select: { designation: true, demandeBudget: { select: { numero: true } } } },
    },
  });
  if (!commande) throw new PaiementCommandeError("Bon de commande introuvable.");
  if (opts.ligneBudgetId) {
    if (commande.ligneBudgetId !== opts.ligneBudgetId) {
      throw new PaiementCommandeError(`Le bon de commande ${commande.numero} ne finance pas cette ligne de budget.`);
    }
  } else {
    if (commande.ligneBudgetId) {
      throw new PaiementCommandeError(
        `Le bon de commande ${commande.numero} est financé par le budget ${commande.ligneBudget?.demandeBudget.numero} (ligne « ${commande.ligneBudget?.designation} ») : payez-le depuis ce budget.`
      );
    }
    if (opts.invoiceId && !commande.proformas.some((p) => p.invoiceId === opts.invoiceId)) {
      throw new PaiementCommandeError(`Le bon de commande ${commande.numero} n'est pas lié à cette proforma.`);
    }
  }
  if (commande.statut !== StatutCommandeFournisseur.VALIDEE && commande.statut !== StatutCommandeFournisseur.LIVREE) {
    throw new PaiementCommandeError(
      commande.statut === StatutCommandeFournisseur.PAYEE
        ? `Le bon de commande ${commande.numero} est déjà entièrement payé.`
        : `Le bon de commande ${commande.numero} n'est pas validé : il doit être signé par la DG avant tout paiement.`
    );
  }

  const liasse = etatLiasse(commande.documents, commande.factures);
  if (!liasse.bcSigne) {
    throw new PaiementCommandeError(`Joignez d'abord le scan du bon de commande ${commande.numero} signé par la DG.`);
  }
  let facture: { id: string } | null = null;
  if (opts.nature === NatureDepense.SOLDE) {
    // Liasse complète (bordereau ou attestation + rapport) exigée par défaut ; réglable dans
    // Paramètres → Rôles. La facture du bon reste exigée dans tous les cas (ci-dessous).
    const config = await tx.entrepriseConfig.findUnique({ where: { id: "singleton" }, select: { liasseExigeePourSolde: true } });
    const liasseExigee = config?.liasseExigeePourSolde ?? true;
    if (liasseExigee && !liasse.complete) {
      throw new PaiementCommandeError(
        `Solde impossible : la liasse du bon de commande ${commande.numero} est incomplète (manque : ${liasse.manquantes.join(", ")}).`
      );
    }
    if (!opts.factureFournisseurId) throw new PaiementCommandeError("Choisissez la facture fournisseur réglée par ce solde.");
    const f = commande.factures.find((x) => x.id === opts.factureFournisseurId);
    if (!f) throw new PaiementCommandeError("Cette facture n'est pas rattachée à ce bon de commande.");
    if (f.status !== StatutFactureFournisseur.EN_ATTENTE) {
      throw new PaiementCommandeError(`La facture ${f.reference} n'est pas en attente de paiement.`);
    }
    facture = { id: f.id };
  }

  const reste = Number(commande.montantNet) - payeSurCommande(commande.imputations);
  if (opts.montant > reste + BUDGET_EPSILON) {
    throw new PaiementCommandeError(`Montant supérieur au reste du bon de commande ${commande.numero} : il reste ${fmt(reste)}.`);
  }

  // Ligne(s) de produit imputée(s).
  const parts = partsLignesCommande(commande);
  let repartition: { ligneCommandeId: string; montant: number }[];
  if (opts.ligneCommandeId) {
    const part = parts.find((p) => p.id === opts.ligneCommandeId);
    if (!part) throw new PaiementCommandeError("Cette ligne de produit n'appartient pas au bon de commande.");
    if (opts.montant > part.reste + BUDGET_EPSILON) {
      throw new PaiementCommandeError(`Montant supérieur au reste de la ligne « ${part.designation} » du bon : il reste ${fmt(part.reste)}.`);
    }
    repartition = [{ ligneCommandeId: part.id, montant: opts.montant }];
  } else {
    repartition = repartirAuProrata(opts.montant, parts);
    if (repartition.length === 0) throw new PaiementCommandeError(`Le bon de commande ${commande.numero} n'a plus de reste à payer.`);
  }
  return { commande, facture, liasse, reste, repartition };
}

/** Enregistre les imputations d'un paiement (une par ligne de produit) sur son écriture de caisse. */
export async function enregistrerImputations(
  tx: Db,
  opts: {
    commandeId: string;
    repartition: { ligneCommandeId: string; montant: number }[];
    cashJournalEntryId: number;
    nature: NatureDepense;
    factureFournisseurId?: string | null;
  }
) {
  await tx.imputationCommande.createMany({
    data: opts.repartition.map((r) => ({
      commandeId: opts.commandeId,
      ligneCommandeId: r.ligneCommandeId,
      cashJournalEntryId: opts.cashJournalEntryId,
      montant: r.montant,
      nature: opts.nature,
      factureFournisseurId: opts.factureFournisseurId ?? null,
    })),
  });
}

/**
 * Statut « Payée » automatique : un bon validé ou livré dont le reste est nul passe PAYEE ; un bon
 * PAYEE qui retrouve un reste (paiement annulé) revient à LIVREE s'il a son bordereau ou son
 * attestation de service fait, sinon à VALIDEE.
 */
export async function majStatutCommande(tx: Db, commandeId: string) {
  const c = await tx.commandeFournisseur.findUnique({
    where: { id: commandeId },
    select: {
      statut: true,
      montantNet: true,
      imputations: { select: { montant: true, annuleeAt: true } },
      documents: { select: { kind: true } },
    },
  });
  if (!c) return;
  const reste = Number(c.montantNet) - payeSurCommande(c.imputations);
  const solde = reste <= BUDGET_EPSILON;
  if (solde && (c.statut === StatutCommandeFournisseur.VALIDEE || c.statut === StatutCommandeFournisseur.LIVREE)) {
    await tx.commandeFournisseur.update({ where: { id: commandeId }, data: { statut: StatutCommandeFournisseur.PAYEE } });
  } else if (!solde && c.statut === StatutCommandeFournisseur.PAYEE) {
    const livree = etatLiasse(c.documents).livraison;
    await tx.commandeFournisseur.update({
      where: { id: commandeId },
      data: { statut: livree ? StatutCommandeFournisseur.LIVREE : StatutCommandeFournisseur.VALIDEE },
    });
  }
}

/**
 * Annulation d'un paiement (contre-écriture) : ses imputations sont annulées, la facture qu'il
 * soldait redevient à payer et le bon retrouve son statut (PAYEE → LIVREE / VALIDEE).
 */
export async function annulerImputations(tx: Db, cashJournalEntryId: number) {
  const imputations = await tx.imputationCommande.findMany({
    where: { cashJournalEntryId, annuleeAt: null },
    select: { commandeId: true, factureFournisseurId: true },
  });
  if (imputations.length === 0) return;
  await tx.imputationCommande.updateMany({ where: { cashJournalEntryId, annuleeAt: null }, data: { annuleeAt: new Date() } });
  for (const factureId of new Set(imputations.map((i) => i.factureFournisseurId).filter(Boolean) as string[])) {
    await libererFactureApresAnnulation(tx, factureId);
  }
  for (const commandeId of new Set(imputations.map((i) => i.commandeId))) {
    await majStatutCommande(tx, commandeId);
  }
}

/** Après l'annulation d'une dépense : la facture qu'elle soldait redevient à payer. */
export async function libererFactureApresAnnulation(tx: Db, factureFournisseurId: string | null | undefined) {
  if (!factureFournisseurId) return;
  const encorePayee = await tx.imputationCommande.count({ where: { factureFournisseurId, annuleeAt: null } });
  if (encorePayee === 0) {
    await tx.factureFournisseur.update({
      where: { id: factureFournisseurId },
      data: { status: StatutFactureFournisseur.EN_ATTENTE },
    });
  }
}

/**
 * Ligne de budget qui financera un bon de commande : elle doit exister, ne pas être retirée, et
 * son budget ne pas être rejeté ni clôturé. Renvoie le motif du refus, ou null.
 */
export async function refusLigneBudgetCommande(db: Db, ligneBudgetId: string | null | undefined): Promise<string | null> {
  if (!ligneBudgetId) return null;
  const ligne = await db.demandeBudgetLigne.findUnique({
    where: { id: ligneBudgetId },
    select: { statutValidation: true, demandeBudget: { select: { statut: true, clotureeAt: true } } },
  });
  if (!ligne) return "Ligne de budget introuvable.";
  if (ligne.statutValidation === "RETIREE") return "Cette ligne a été retirée de son budget.";
  if (ligne.demandeBudget.statut === "REJETEE" || ligne.demandeBudget.clotureeAt) {
    return "Le budget de cette ligne est rejeté ou clôturé.";
  }
  return null;
}

/**
 * Facture d'un bon de commande : son montant est celui du bon (montant net, à 1 F près) et un bon n'a
 * qu'une facture active (non annulée). Renvoie le motif de refus, sinon null. Les avances déjà
 * versées sont déduites au paiement (on ne paie que le reste).
 */
export async function refusMontantFactureCommande(
  db: Db,
  opts: { commandeId: string; montant: number; factureIdExclu?: string | null }
): Promise<string | null> {
  const commande = await db.commandeFournisseur.findUnique({
    where: { id: opts.commandeId },
    select: {
      numero: true,
      montantNet: true,
      factures: { where: { status: { not: StatutFactureFournisseur.ANNULEE } }, select: { id: true, reference: true } },
    },
  });
  if (!commande) return "Bon de commande introuvable.";
  const autre = commande.factures.find((f) => f.id !== opts.factureIdExclu);
  if (autre) {
    return `Le bon de commande ${commande.numero} a déjà une facture (${autre.reference}). Annulez-la d'abord si elle doit être remplacée.`;
  }
  if (Math.abs(opts.montant - Number(commande.montantNet)) > 1) {
    return `Le montant de la facture (${fmt(opts.montant)}) doit être celui du bon de commande ${commande.numero} : ${fmt(Number(commande.montantNet))}.`;
  }
  return null;
}

const STATUTS_BUDGET_OUVERT = ["VALIDEE", "EN_COURS", "VALIDATION_PARTIELLE"];
const STATUTS_COMMANDE_ENGAGEE: StatutCommandeFournisseur[] = [
  StatutCommandeFournisseur.BROUILLON,
  StatutCommandeFournisseur.VALIDEE,
  StatutCommandeFournisseur.LIVREE,
];

/**
 * Engagement d'une ligne de budget : plafond, consommé (dépenses), et ce qui reste à payer sur ses
 * bons de commande en cours (brouillon, validés, livrés), hors `commandeIdExclu`. Le payé des bons
 * est déjà dans le consommé. `reste` = ce qui peut encore être engagé par un nouveau bon.
 */
export async function engagementLigne(db: Db, ligneBudgetId: string, commandeIdExclu?: string | null) {
  const ligne = await db.demandeBudgetLigne.findUniqueOrThrow({
    where: { id: ligneBudgetId },
    select: { id: true, montant: true, montantAccorde: true, statutValidation: true },
  });
  const dispo = await getLigneDisponible(db, ligne);
  const commandes = await db.commandeFournisseur.findMany({
    where: { ligneBudgetId, statut: { in: STATUTS_COMMANDE_ENGAGEE }, ...(commandeIdExclu ? { id: { not: commandeIdExclu } } : {}) },
    select: { montantNet: true, imputations: { where: { annuleeAt: null }, select: { montant: true } } },
  });
  const engage = commandes.reduce(
    (s, c) => s + Math.max(Number(c.montantNet) - c.imputations.reduce((a, i) => a + Number(i.montant), 0), 0),
    0
  );
  return { plafond: dispo.plafond, consomme: dispo.consomme, engage, reste: dispo.reste - engage };
}

/**
 * Bon de commande rattaché à une ligne ACCORDÉE d'un budget ouvert : il est validé d'office (la
 * ligne accordée vaut accord de dépense). Le scan du BC signé reste à joindre : sans lui, aucun
 * paiement (controlerPaiementCommande). Refus si le bon dépasse ce qui reste à engager sur la ligne.
 * Ligne non accordée ou budget pas ouvert : le bon reste en brouillon (circuit de validation par la DG).
 */
export async function validationAutomatiqueCommande(
  db: Db,
  opts: { ligneBudgetId: string | null | undefined; montantNet: number; commandeIdExclu?: string | null }
): Promise<{ valider: boolean; refus: string | null }> {
  if (!opts.ligneBudgetId) return { valider: false, refus: null };
  const ligne = await db.demandeBudgetLigne.findUnique({
    where: { id: opts.ligneBudgetId },
    select: { statutValidation: true, designation: true, demandeBudget: { select: { statut: true, clotureeAt: true } } },
  });
  if (!ligne || ligne.statutValidation !== "ACCORDEE") return { valider: false, refus: null };
  if (!STATUTS_BUDGET_OUVERT.includes(ligne.demandeBudget.statut) || ligne.demandeBudget.clotureeAt) return { valider: false, refus: null };
  const e = await engagementLigne(db, opts.ligneBudgetId, opts.commandeIdExclu);
  if (opts.montantNet > e.reste + BUDGET_EPSILON) {
    return {
      valider: false,
      refus:
        `Ce bon de commande (${fmt(opts.montantNet)}) dépasse ce qui reste à engager sur la ligne « ${ligne.designation} » : ${fmt(e.reste)} ` +
        `(déjà dépensé ${fmt(e.consomme)}, autres bons en cours ${fmt(e.engage)}). Réduisez le bon ou demandez un dépassement.`,
    };
  }
  return { valider: true, refus: null };
}

/** Une ligne de budget proposée pour financer un bon de commande, avec ce qui reste à engager. */
export interface LigneBudgetCommande {
  id: string;
  designation: string;
  budgetId: string;
  budgetNumero: string;
  budgetType: string;
  plafond: number;
  consomme: number;
  engage: number;
  reste: number;
}

/** Budgets d'une proforma qui comptent pour ses bons de commande : tous ceux qui ne sont pas rejetés. */
async function budgetsDeLaProforma(db: Db, proformaId: string) {
  return db.demandeBudget.findMany({
    where: { proformas: { some: { invoiceId: proformaId } }, statut: { not: "REJETEE" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, numero: true, statut: true, clotureeAt: true },
  });
}

/**
 * Lignes de budget proposées pour un bon de commande, selon sa proforma (une seule par bon) :
 * - la proforma a un budget (`aBudget`) → uniquement les lignes ACCORDÉES de ce(s) budget(s) ouvert(s),
 *   et la ligne est obligatoire ;
 * - sinon (pas de proforma, ou proforma sans budget) → les lignes accordées des budgets ouverts qui ne
 *   sont liés à aucune proforma (mensuel, ponctuel…), au choix.
 * `reste` = ce qui peut encore être engagé (plafond − dépensé − autres bons en cours, hors `commandeIdExclu`).
 */
export async function lignesBudgetPourCommande(
  db: Db,
  opts: { proformaId?: string | null; commandeIdExclu?: string | null }
): Promise<{ aBudget: boolean; budgets: { id: string; numero: string; statut: string; ouvert: boolean }[]; lignes: LigneBudgetCommande[] }> {
  const budgetsProforma = opts.proformaId ? await budgetsDeLaProforma(db, opts.proformaId) : [];
  const aBudget = budgetsProforma.length > 0;
  const ouvert = (b: { statut: string; clotureeAt: Date | null }) => STATUTS_BUDGET_OUVERT.includes(b.statut) && !b.clotureeAt;

  const budgets = await db.demandeBudget.findMany({
    where: aBudget
      ? { id: { in: budgetsProforma.filter(ouvert).map((b) => b.id) } }
      : { statut: { in: STATUTS_BUDGET_OUVERT as StatutDemandeBudget[] }, clotureeAt: null, proformas: { none: {} } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      numero: true,
      type: true,
      lignes: { where: { statutValidation: "ACCORDEE" }, orderBy: { designation: "asc" }, select: { id: true, designation: true } },
    },
  });

  const lignes: LigneBudgetCommande[] = await Promise.all(
    budgets.flatMap((b) =>
      b.lignes.map(async (l) => {
        const e = await engagementLigne(db, l.id, opts.commandeIdExclu);
        return { id: l.id, designation: l.designation, budgetId: b.id, budgetNumero: b.numero, budgetType: b.type, plafond: e.plafond, consomme: e.consomme, engage: e.engage, reste: Math.max(e.reste, 0) };
      })
    )
  );
  return {
    aBudget,
    budgets: budgetsProforma.map((b) => ({ id: b.id, numero: b.numero, statut: b.statut, ouvert: ouvert(b) })),
    lignes,
  };
}

/**
 * Cohérence entre la proforma d'un bon de commande et la ligne de budget qui le finance :
 * - proforma liée à un budget (non rejeté) → la ligne est obligatoire et doit appartenir à ce budget ;
 * - ligne d'un budget lié à une proforma → le bon doit être associé à cette proforma ;
 * - proforma sans budget, ou pas de proforma → ligne facultative (budget sans proforma : mensuel…).
 * Renvoie le motif du refus, ou null.
 */
export async function refusCoherenceLigneProforma(
  db: Db,
  opts: { ligneBudgetId: string | null | undefined; proformaId: string | null | undefined }
): Promise<string | null> {
  const budgetsProforma = opts.proformaId ? await budgetsDeLaProforma(db, opts.proformaId) : [];
  const numeros = budgetsProforma.map((b) => b.numero).join(", ");
  if (!opts.ligneBudgetId) {
    return budgetsProforma.length
      ? `Cette proforma a un budget (${numeros}) : choisissez la ligne de ce budget qui finance le bon de commande.`
      : null;
  }
  const ligne = await db.demandeBudgetLigne.findUnique({
    where: { id: opts.ligneBudgetId },
    select: {
      designation: true,
      demandeBudgetId: true,
      demandeBudget: { select: { numero: true, proformas: { select: { invoiceId: true, invoice: { select: { numero: true } } } } } },
    },
  });
  if (!ligne) return "Ligne de budget introuvable.";
  if (budgetsProforma.length) {
    return budgetsProforma.some((b) => b.id === ligne.demandeBudgetId)
      ? null
      : `La ligne « ${ligne.designation} » n'appartient pas au budget de la proforma de ce bon (${numeros}) : choisissez une ligne de ce budget.`;
  }
  const proformasDuBudget = ligne.demandeBudget.proformas;
  if (proformasDuBudget.length) {
    const p = proformasDuBudget.map((x) => x.invoice.numero).join(", ");
    return `La ligne « ${ligne.designation} » appartient au budget ${ligne.demandeBudget.numero} de la proforma ${p} : associez le bon de commande à cette proforma.`;
  }
  return null;
}

/**
 * Prochain numéro de bon de commande, par année : BCF-AAAA-NNNN (suit le plus grand numéro de
 * l'année, y compris ceux attribués par l'ancien compteur global). À appeler dans la transaction
 * de création ; la contrainte d'unicité protège d'un doublon simultané (l'appelant réessaie).
 */
export async function prochainNumeroCommande(db: Db, annee = new Date().getFullYear()): Promise<string> {
  const prefixe = `BCF-${annee}-`;
  const existants = await db.commandeFournisseur.findMany({
    where: { numero: { startsWith: prefixe } },
    select: { numero: true },
  });
  const max = existants.reduce((m, c) => Math.max(m, Number(c.numero.slice(prefixe.length)) || 0), 0);
  return `${prefixe}${String(max + 1).padStart(4, "0")}`;
}

export { TRANSITIONS_COMMANDE } from "@/lib/commandeFournisseurLiasse";

/**
 * Paiement direct d'une facture de prestataire interne / externe (sans bon de commande) depuis une
 * ligne de budget : facture en attente, pas liée à un bon (sinon : solde du bon), pas d'un
 * « Fournisseur » (bon de commande obligatoire), rattachée à cette ligne ou à aucune, et le montant
 * ne dépasse pas ce qui reste à régler. Verrouille la facture.
 */
export async function controlerPaiementFacture(
  tx: Db,
  opts: { factureFournisseurId: string; ligneBudgetId: string; montant: number }
) {
  await tx.$queryRaw`SELECT id FROM "FactureFournisseur" WHERE id = ${opts.factureFournisseurId} FOR UPDATE`;
  const facture = await tx.factureFournisseur.findUnique({
    where: { id: opts.factureFournisseurId },
    include: {
      fournisseur: { select: { entreprise: true, typeFournisseur: true } },
      commande: { select: { numero: true } },
      depenses: { where: { annuleeAt: null }, select: { montant: true } },
    },
  });
  if (!facture) throw new PaiementCommandeError("Facture introuvable.");
  if (facture.commande) {
    throw new PaiementCommandeError(`La facture ${facture.reference} répond au bon de commande ${facture.commande.numero} : réglez-la par le solde de ce bon.`);
  }
  if (exigeBonDeCommande(facture.fournisseur.typeFournisseur)) {
    throw new PaiementCommandeError(`${facture.fournisseur.entreprise} est un fournisseur : ses factures se règlent par le solde d'un bon de commande.`);
  }
  if (facture.status !== StatutFactureFournisseur.EN_ATTENTE) {
    throw new PaiementCommandeError(`La facture ${facture.reference} n'est pas en attente de paiement.`);
  }
  if (facture.ligneBudgetId && facture.ligneBudgetId !== opts.ligneBudgetId) {
    throw new PaiementCommandeError(`La facture ${facture.reference} est rattachée à une autre ligne de budget.`);
  }
  const reste = Number(facture.montant) - facture.depenses.reduce((s, d) => s + Number(d.montant), 0);
  if (opts.montant > reste + BUDGET_EPSILON) {
    throw new PaiementCommandeError(`Montant supérieur à ce qui reste à régler sur la facture ${facture.reference} : ${fmt(reste)}.`);
  }
  return { facture, reste };
}

/**
 * Statut d'une facture de prestataire réglée directement par des dépenses de budget (sans bon) :
 * PAYEE quand la somme des dépenses non annulées atteint son montant, EN_ATTENTE sinon.
 * (Une facture liée à un bon suit l'imputation du solde : voir libererFactureApresAnnulation.)
 */
export async function recalculerStatutFacture(tx: Db, factureFournisseurId: string) {
  const f = await tx.factureFournisseur.findUnique({
    where: { id: factureFournisseurId },
    select: { montant: true, status: true, commandeId: true, depenses: { where: { annuleeAt: null }, select: { montant: true } } },
  });
  if (!f || f.commandeId || f.status === StatutFactureFournisseur.ANNULEE) return;
  const paye = f.depenses.reduce((s, d) => s + Number(d.montant), 0);
  const statut = paye >= Number(f.montant) - BUDGET_EPSILON ? StatutFactureFournisseur.PAYEE : StatutFactureFournisseur.EN_ATTENTE;
  if (statut !== f.status) await tx.factureFournisseur.update({ where: { id: factureFournisseurId }, data: { status: statut } });
}

/**
 * Factures de prestataires internes / externes (sans bon de commande) encore à régler, payables sur
 * ces lignes de budget : rattachées à l'une d'elles, ou à aucune ligne. Avec ce qui reste à régler.
 */
export async function facturesPrestatairesPayables(db: Db, ligneIds: string[]) {
  const factures = await db.factureFournisseur.findMany({
    where: {
      status: StatutFactureFournisseur.EN_ATTENTE,
      commandeId: null,
      OR: [{ ligneBudgetId: null }, { ligneBudgetId: { in: ligneIds } }],
      fournisseur: { OR: [{ typeFournisseur: null }, { typeFournisseur: { not: "Fournisseur" } }] },
    },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      reference: true,
      montant: true,
      date: true,
      ligneBudgetId: true,
      fournisseur: { select: { entreprise: true, typeFournisseur: true } },
      depenses: { where: { annuleeAt: null }, select: { montant: true } },
    },
  });
  return factures.map(({ depenses, ...f }) => ({
    ...f,
    montant: Number(f.montant),
    reste: Math.max(Number(f.montant) - depenses.reduce((s, d) => s + Number(d.montant), 0), 0),
  }));
}
