import {
  ActionBudget,
  NatureDepense,
  Prisma,
  SourceDepense,
  StatutFactureFournisseur,
  StatutLigneBudget,
} from "@prisma/client";
import { isSameEmail } from "@/lib/budgetAuth";
import { erreurMoyenEtCaisse } from "@/lib/moyensPaiementServeur";
import { recordCashDepense, recordDepensePaiement } from "@/lib/paiements";
import { BUDGET_EPSILON, etatDepensable, getLigneDisponible, logBudget, recalculerStatutBudget } from "@/lib/budgetSuivi";
import {
  controlerPaiementCommande,
  controlerPaiementFacture,
  controlerPaiementFactureSansBudget,
  enregistrerImputations,
  majStatutCommande,
  recalculerStatutFacture,
} from "@/lib/commandeFournisseurSuivi";
import type { SavedFile } from "@/lib/uploadDemandeBudget";

type Db = Prisma.TransactionClient;

/** Erreur métier d'une dépense → 400 avec le message tel quel. */
export class DepenseError extends Error {}

/**
 * Une sortie d'argent, d'où qu'elle vienne : fiche budget (MANUEL), fiche proforma (PROFORMA) ou
 * Camptrack (CAMPTRACK).
 */
export interface EntreeDepense {
  source: SourceDepense;
  auteur: { userId: string | null; email: string; name: string | null };
  montant: number;
  dateDepense: Date;
  cashRegisterId: number;
  nomReceveur: string;
  /**
   * Code du moyen de paiement. Hors CampTrack : moyen actif, caisse visible et liée à ce moyen
   * (lib/moyensPaiementServeur.ts, erreurMoyenEtCaisse).
   */
  modePaiement: string;
  notes?: string | null;
  /** Ligne de budget payée (obligatoire si la proforma a un budget). */
  ligneBudgetId?: string | null;
  /** Budget attendu (route de la fiche budget) : la ligne doit en faire partie. */
  demandeBudgetId?: string | null;
  /** Proforma imputée (marge). Avec budget : une des proformas du budget (d'office s'il n'y en a qu'une). */
  invoiceId?: string | null;
  /**
   * Bon de commande : avance ou solde, sur une ligne de produit ou « tout le bon » (prorata).
   * Sans bon : `factureFournisseurId` seul = facture d'un prestataire interne / externe réglée
   * directement sur la ligne de budget (paiement partiel possible ; PAYEE une fois tout réglé).
   */
  commandeId?: string | null;
  nature?: NatureDepense;
  ligneCommandeId?: string | null;
  factureFournisseurId?: string | null;
  /** Pièces déjà enregistrées (fiche budget) — sinon motif d'absence, ou justifié ailleurs (Camptrack). */
  justificatifs?: SavedFile[];
  motifSansJustificatif?: string | null;
  justifieAilleurs?: boolean;
  referenceExterne?: string | null;
  /** Libellé de l'écriture de caisse ; généré s'il est absent. */
  libelle?: string | null;
  /** Méthode et référence du paiement de proforma (affichées dans la fiche proforma). */
  methode?: string | null;
  reference?: string | null;
  /**
   * Facture de prestataire payée SANS budget (aucune ligne de budget) : sortie de la caisse choisie,
   * plus la dépense sur la proforma si `invoiceId` (campagne sans budget). La facture passe « payée »
   * et garde l'écriture de caisse (FactureFournisseur.paiementCaisseId). Pas de dépense de budget.
   */
  sansBudget?: boolean;
}

/** Budgets liés à une proforma (pour la règle « avec budget, la ligne est obligatoire »). */
export async function budgetsDeLaProforma(db: Db, invoiceId: string) {
  return db.demandeBudget.findMany({
    where: { proformas: { some: { invoiceId } } },
    select: { id: true, numero: true, statut: true, clotureeAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Contrôles d'une dépense sur une ligne de budget (budget ouvert, séparation des tâches, dates,
 * ligne accordée, plafond) — verrouille la ligne. Partagé par enregistrerDepense et par le
 * rattachement d'une dépense Camptrack existante (app/api/demandes-budget/[id]/rattacher).
 */
export async function controlerLigneBudget(
  tx: Db,
  opts: { ligneBudgetId: string; demandeBudgetId?: string | null; auteurEmail: string; montant: number; dateDepense: Date }
) {
  const ligne = await tx.demandeBudgetLigne.findUnique({
    where: { id: opts.ligneBudgetId },
    include: { demandeBudget: { include: { proformas: true } } },
  });
  if (!ligne) throw new DepenseError("Ligne de budget introuvable.");
  const demande = ligne.demandeBudget;
  if (opts.demandeBudgetId && demande.id !== opts.demandeBudgetId) throw new DepenseError("Cette ligne n'appartient pas à ce budget.");
  // Budget ouvert, et budget signé joint s'il est exigé (lib/budgetSuivi.ts, etatDepensable).
  const etat = await etatDepensable(tx, demande);
  if (!etat.depensable) throw new DepenseError(etat.motif!);
  if (isSameEmail(demande.validatedByEmail, opts.auteurEmail)) {
    throw new DepenseError("Vous avez validé ce budget : ses dépenses doivent être enregistrées par une autre personne (séparation des tâches).");
  }
  const UN_JOUR = 24 * 3600 * 1000;
  if (opts.dateDepense.getTime() > Date.now() + UN_JOUR) throw new DepenseError("La date de la dépense ne peut pas être dans le futur.");
  if (demande.validatedAt && opts.dateDepense.getTime() < demande.validatedAt.getTime() - UN_JOUR) {
    throw new DepenseError(`La date de la dépense est antérieure à la validation du budget (${demande.validatedAt.toLocaleDateString("fr-FR")}).`);
  }
  if (ligne.statutValidation !== StatutLigneBudget.ACCORDEE) {
    throw new DepenseError(
      ligne.statutValidation === StatutLigneBudget.RETIREE
        ? "Cette ligne a été retirée du budget."
        : "Cette ligne n'est pas encore accordée : aucune dépense possible avant sa validation."
    );
  }
  if (isSameEmail(ligne.decideParEmail, opts.auteurEmail)) {
    throw new DepenseError("Vous avez accordé cette ligne : ses dépenses doivent être enregistrées par une autre personne.");
  }
  // Verrou sur la ligne : deux dépenses simultanées ne peuvent pas dépasser le plafond ensemble.
  await tx.$queryRaw`SELECT id FROM "DemandeBudgetLigne" WHERE id = ${ligne.id} FOR UPDATE`;
  const avant = await getLigneDisponible(tx, ligne);
  if (opts.montant > avant.reste + BUDGET_EPSILON) {
    throw new DepenseError(
      `Budget de la ligne « ${ligne.designation} » atteint : il reste ${Math.max(avant.reste, 0).toLocaleString("fr-FR")} FCFA. Demandez un dépassement pour aller au-delà.`
    );
  }
  return { ligne, demande, avant };
}

/**
 * Enregistre UNE sortie d'argent et met tout à jour dans la même transaction :
 * - avec ligne de budget : contrôles du budget (ligne accordée, plafond, séparation des tâches,
 *   dates), écriture DEPENSE dans la caisse choisie (solde contrôlé), dépense imputée à la proforma
 *   du budget, BudgetDepense, historique et statut du budget ;
 * - sans ligne de budget : seulement si la proforma n'a AUCUN budget (campagne sans budget) —
 *   écriture de caisse + dépense sur la proforma ; ou facture de prestataire payée `sansBudget`
 *   (aucune proforma) — écriture de caisse seule ;
 * - avec bon de commande (les deux cas) : contrôles du BC, imputation sur la ligne de produit (ou
 *   prorata), facture PAYEE au solde, bon PAYEE quand il est entièrement payé.
 * À appeler dans une transaction Prisma.
 */
export async function enregistrerDepense(tx: Db, e: EntreeDepense) {
  const nature = e.nature ?? NatureDepense.NORMALE;
  if (!(e.montant > 0)) throw new DepenseError("Le montant doit être supérieur à 0.");
  if (nature !== NatureDepense.NORMALE && !e.commandeId) {
    throw new DepenseError("Choisissez le bon de commande concerné par cette avance ou ce solde.");
  }
  // Moyen de paiement et caisse : la caisse doit être visible et liée au moyen choisi. CampTrack
  // choisit lui-même sa caisse : il n'est pas soumis à cette règle.
  if (e.source !== SourceDepense.CAMPTRACK) {
    const erreur = await erreurMoyenEtCaisse(tx, e.modePaiement, e.cashRegisterId);
    if (erreur) throw new DepenseError(erreur);
  }

  // ── 1. Ligne de budget (ou campagne sans budget) ───────────────────────────────────────────
  let ligne: Prisma.DemandeBudgetLigneGetPayload<{ include: { demandeBudget: { include: { proformas: true } } } }> | null = null;
  let avant: Awaited<ReturnType<typeof getLigneDisponible>> | null = null;
  let invoiceId: string | null = e.invoiceId ?? null;

  if (e.ligneBudgetId) {
    const controle = await controlerLigneBudget(tx, {
      ligneBudgetId: e.ligneBudgetId,
      demandeBudgetId: e.demandeBudgetId,
      auteurEmail: e.auteur.email,
      montant: e.montant,
      dateDepense: e.dateDepense,
    });
    ligne = controle.ligne;
    avant = controle.avant;
    const demande = controle.demande;
    // Proforma imputée : une des proformas du budget (d'office s'il n'y en a qu'une).
    if (demande.proformas.length > 0) {
      invoiceId = invoiceId ?? (demande.proformas.length === 1 ? demande.proformas[0].invoiceId : null);
      if (!invoiceId) throw new DepenseError("Choisissez la proforma à laquelle imputer cette dépense.");
      if (!demande.proformas.some((p) => p.invoiceId === invoiceId)) throw new DepenseError("Cette proforma n'est pas liée à ce budget.");
    } else {
      invoiceId = null;
    }
  } else if (invoiceId) {
    const budgets = await budgetsDeLaProforma(tx, invoiceId);
    if (budgets.length > 0) {
      throw new DepenseError(
        `Cette campagne a un budget (${budgets.map((b) => b.numero).join(", ")}) : la dépense doit être enregistrée sur une de ses lignes.`
      );
    }
  } else if (!e.sansBudget) {
    throw new DepenseError("Choisissez la ligne de budget de cette dépense.");
  }

  // ── 2. Bon de commande ──────────────────────────────────────────────────────────────────────
  const paiementCommande = e.commandeId
    ? await controlerPaiementCommande(tx, {
        commandeId: e.commandeId,
        ligneBudgetId: ligne?.id ?? null,
        invoiceId,
        nature,
        montant: e.montant,
        factureFournisseurId: e.factureFournisseurId,
        ligneCommandeId: e.ligneCommandeId,
      })
    : null;

  // Facture de prestataire interne / externe, sans bon de commande : réglée sur la ligne de budget.
  let paiementFacture: Awaited<ReturnType<typeof controlerPaiementFacture>> | null = null;
  let factureSansBudget: Awaited<ReturnType<typeof controlerPaiementFactureSansBudget>> | null = null;
  if (e.factureFournisseurId && !e.commandeId) {
    if (ligne) {
      paiementFacture = await controlerPaiementFacture(tx, { factureFournisseurId: e.factureFournisseurId, ligneBudgetId: ligne.id, montant: e.montant });
    } else if (e.sansBudget) {
      factureSansBudget = await controlerPaiementFactureSansBudget(tx, { factureFournisseurId: e.factureFournisseurId, montant: e.montant });
    } else {
      throw new DepenseError("Une facture de prestataire se règle sur une ligne de budget.");
    }
  }

  // ── 3. Sortie de caisse (+ dépense sur la proforma) ─────────────────────────────────────────
  const demande = ligne?.demandeBudget ?? null;
  const libelle =
    e.libelle ||
    (paiementCommande
      ? `${demande ? `Budget ${demande.numero} — ` : ""}${nature === NatureDepense.SOLDE ? "Solde" : "Avance"} BC ${paiementCommande.commande.numero} — ${e.nomReceveur}`
      : `${demande ? `Budget ${demande.numero} — ${ligne!.designation}` : "Dépense"} — ${e.nomReceveur}`);

  let paiement: Prisma.PaiementGetPayload<object> | null = null;
  let cashJournalEntry: Prisma.CashJournalGetPayload<object>;
  if (invoiceId) {
    const r = await recordDepensePaiement(tx, {
      invoiceId,
      cashRegisterId: e.cashRegisterId,
      montant: e.montant,
      libelle,
      date_operation: e.dateDepense,
      methode: e.methode ?? e.modePaiement,
      reference: e.reference ?? demande?.numero ?? undefined,
      notes: e.notes ?? undefined,
      createdById: e.auteur.userId,
      auteur: { email: e.auteur.email, nom: e.source === SourceDepense.CAMPTRACK ? "CampTrack" : e.auteur.name },
    });
    paiement = r.paiement;
    cashJournalEntry = r.cashJournalEntry;
  } else {
    cashJournalEntry = await recordCashDepense(tx, {
      cashRegisterId: e.cashRegisterId,
      montant: e.montant,
      libelle,
      date_operation: e.dateDepense,
      createdById: e.auteur.userId,
    });
  }

  // ── 4. Dépense de budget ────────────────────────────────────────────────────────────────────
  const justificatifs = e.justificatifs ?? [];
  let budgetDepense: Prisma.BudgetDepenseGetPayload<object> | null = null;
  if (ligne && demande) {
    budgetDepense = await tx.budgetDepense.create({
      data: {
        demandeBudgetId: demande.id,
        ligneId: ligne.id,
        montant: e.montant,
        dateDepense: e.dateDepense,
        nomReceveur: e.nomReceveur,
        modePaiement: e.modePaiement,
        notes: e.notes ?? null,
        cashRegisterId: e.cashRegisterId,
        cashJournalEntryId: cashJournalEntry.id,
        invoiceId,
        commandeId: paiementCommande?.commande.id ?? null,
        nature: paiementCommande ? nature : NatureDepense.NORMALE,
        factureFournisseurId: paiementCommande?.facture?.id ?? paiementFacture?.facture.id ?? null,
        sansJustificatif: justificatifs.length === 0 && !e.justifieAilleurs,
        motifSansJustificatif: justificatifs.length === 0 && !e.justifieAilleurs ? e.motifSansJustificatif ?? null : null,
        source: e.source,
        referenceExterne: e.referenceExterne ?? null,
        createdByEmail: e.auteur.email,
      },
    });
    if (justificatifs.length > 0) {
      await tx.demandeBudgetAttachment.createMany({
        data: justificatifs.map((f) => ({ demandeBudgetId: demande.id, depenseId: budgetDepense!.id, kind: "PREUVE_PAIEMENT" as const, ...f })),
      });
    }
  }

  if (paiementFacture) await recalculerStatutFacture(tx, paiementFacture.facture.id);
  // Payée sans budget : réglée en une fois, elle garde l'écriture de caisse qui l'a payée.
  if (factureSansBudget) {
    await tx.factureFournisseur.update({
      where: { id: factureSansBudget.facture.id },
      data: { status: StatutFactureFournisseur.PAYEE, paiementCaisseId: cashJournalEntry.id },
    });
  }

  // ── 5. Bon de commande : imputations, facture, statut ───────────────────────────────────────
  if (paiementCommande) {
    await enregistrerImputations(tx, {
      commandeId: paiementCommande.commande.id,
      repartition: paiementCommande.repartition,
      cashJournalEntryId: cashJournalEntry.id,
      nature,
      factureFournisseurId: paiementCommande.facture?.id ?? null,
    });
    if (paiementCommande.facture) {
      await tx.factureFournisseur.update({
        where: { id: paiementCommande.facture.id },
        // Solde sans dépense de budget (bon sans ligne) : la facture garde l'écriture de caisse.
        data: { status: StatutFactureFournisseur.PAYEE, ...(budgetDepense ? {} : { paiementCaisseId: cashJournalEntry.id }) },
      });
    }
    await majStatutCommande(tx, paiementCommande.commande.id);
  }

  // ── 6. Historique et statut du budget ───────────────────────────────────────────────────────
  if (ligne && demande) {
    await logBudget(tx, {
      demandeBudgetId: demande.id,
      action: ActionBudget.DEPENSE,
      auteurEmail: e.auteur.email,
      auteurNom: e.auteur.name,
      montant: e.montant,
      details: [
        ligne.designation,
        paiementCommande ? `${nature === NatureDepense.SOLDE ? "solde" : "avance"} du BC ${paiementCommande.commande.numero}` : null,
        paiementFacture ? `facture ${paiementFacture.facture.reference} (${paiementFacture.facture.fournisseur.entreprise})` : null,
        e.nomReceveur,
        `caisse n° ${e.cashRegisterId}, écriture n° ${cashJournalEntry.id}`,
        e.source === SourceDepense.CAMPTRACK ? `Camptrack${e.referenceExterne ? ` (${e.referenceExterne})` : ""}` : null,
        e.source === SourceDepense.PROFORMA ? "saisie depuis la proforma" : null,
        justificatifs.length === 0 && !e.justifieAilleurs ? `SANS JUSTIFICATIF (${e.motifSansJustificatif ?? "—"})` : null,
      ]
        .filter(Boolean)
        .join(" — "),
    });
    await recalculerStatutBudget(tx, demande.id, { datePaiement: e.dateDepense, nomReceveur: e.nomReceveur });
  }

  return { cashJournalEntry, paiement, budgetDepense, ligne, demande, avant, commande: paiementCommande?.commande ?? null };
}
