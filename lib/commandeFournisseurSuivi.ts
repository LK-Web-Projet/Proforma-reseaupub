import { NatureDepense, Prisma, StatutCommandeFournisseur, StatutFactureFournisseur } from "@prisma/client";
import { BUDGET_EPSILON } from "@/lib/budgetSuivi";
import { etatLiasse, payeSurCommande } from "@/lib/commandeFournisseurLiasse";

type Db = Prisma.TransactionClient;

/** Erreur métier d'un paiement sur bon de commande → 400 avec le message tel quel. */
export class PaiementCommandeError extends Error {}

const fmt = (n: number) => `${Math.max(n, 0).toLocaleString("fr-FR")} FCFA`;

/**
 * Contrôles d'une avance ou d'un solde sur un bon de commande (procédure, section 4), à appeler
 * dans la transaction de la dépense de budget, APRÈS les contrôles de la ligne :
 * - le BC finance cette ligne de budget, il est validé (signé par la DG) ou livré ;
 * - AVANCE : BC signé joint ; SOLDE : liasse complète et facture fournisseur du BC choisie ;
 * - le montant ne dépasse pas le reste du BC (montant net − paiements non annulés).
 * Verrouille le BC (deux paiements simultanés ne peuvent pas dépasser son montant ensemble).
 */
export async function controlerPaiementCommande(
  tx: Db,
  opts: { commandeId: string; ligneId: string; nature: NatureDepense; montant: number; factureFournisseurId?: string | null }
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
      depenses: { select: { montant: true, annuleeAt: true } },
    },
  });
  if (!commande) throw new PaiementCommandeError("Bon de commande introuvable.");
  if (commande.ligneBudgetId !== opts.ligneId) {
    throw new PaiementCommandeError(`Le bon de commande ${commande.numero} ne finance pas cette ligne de budget.`);
  }
  if (commande.statut !== StatutCommandeFournisseur.VALIDEE && commande.statut !== StatutCommandeFournisseur.LIVREE) {
    throw new PaiementCommandeError(
      `Le bon de commande ${commande.numero} n'est pas validé : il doit être signé par la DG avant tout paiement.`
    );
  }

  const liasse = etatLiasse(commande.documents, commande.factures);
  if (!liasse.bcSigne) {
    throw new PaiementCommandeError(`Joignez d'abord le scan du bon de commande ${commande.numero} signé par la DG.`);
  }
  let facture: { id: string } | null = null;
  if (opts.nature === NatureDepense.SOLDE) {
    if (!liasse.complete) {
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

  const reste = Number(commande.montantNet) - payeSurCommande(commande.depenses);
  if (opts.montant > reste + BUDGET_EPSILON) {
    throw new PaiementCommandeError(`Montant supérieur au reste du bon de commande ${commande.numero} : il reste ${fmt(reste)}.`);
  }
  return { commande, facture, liasse, reste };
}

/** Après l'annulation d'une dépense : la facture qu'elle soldait redevient à payer. */
export async function libererFactureApresAnnulation(tx: Db, factureFournisseurId: string | null | undefined) {
  if (!factureFournisseurId) return;
  const encorePayee = await tx.budgetDepense.count({ where: { factureFournisseurId, annuleeAt: null } });
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
