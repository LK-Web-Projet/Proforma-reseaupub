/**
 * Statut d'une facture de prestataire changé à la main : qui peut faire quoi. Utilisable à l'écran
 * comme sur le serveur (aucun accès à la base ici ; les contrôles sur les paiements sont dans
 * lib/factureStatutServeur.ts).
 *
 * - « Payée » sans paiement (réglée hors plateforme) : droit « Marquer une facture payée sans
 *   paiement », seulement pour une facture liée à aucun bon de commande ni ligne de budget ; moyen de
 *   paiement, date et preuve obligatoires ; aucune sortie de caisse.
 * - En attente → Annulée : droit « Annuler une facture ».
 * - Depuis « Payée » ou « Annulée » (Payée ↔ Annulée, retour en attente) : droit « Changer librement
 *   le statut » (administrateur).
 * - Une facture réglée (en tout ou partie) par une dépense de budget suit ses paiements : aucun
 *   changement à la main, il faut d'abord annuler la dépense.
 */

export type StatutFacture = "EN_ATTENTE" | "PAYEE" | "ANNULEE";

export const STATUTS_FACTURE: StatutFacture[] = ["EN_ATTENTE", "PAYEE", "ANNULEE"];

export const LIBELLES_STATUT_FACTURE: Record<StatutFacture, string> = {
  EN_ATTENTE: "En attente",
  PAYEE: "Payée",
  ANNULEE: "Annulée",
};

export const DROIT_PAYEE_HORS_PLATEFORME = "fournisseurs.facturePayeeHorsPlateforme";
export const DROIT_STATUT_LIBRE = "fournisseurs.factureStatutLibre";
export const DROIT_ANNULER_FACTURE = "fournisseurs.factureAnnuler";

export function isStatutFacture(value: unknown): value is StatutFacture {
  return typeof value === "string" && (STATUTS_FACTURE as string[]).includes(value);
}

/** Droits permettant de passer de `actuel` à `cible` (l'un d'eux suffit) ; [] = rien à faire. */
export function droitsTransitionFacture(actuel: StatutFacture, cible: StatutFacture): string[] {
  if (actuel === cible) return [];
  if (actuel === "EN_ATTENTE") {
    return cible === "PAYEE" ? [DROIT_PAYEE_HORS_PLATEFORME, DROIT_STATUT_LIBRE] : [DROIT_ANNULER_FACTURE, DROIT_STATUT_LIBRE];
  }
  return [DROIT_STATUT_LIBRE];
}

/** Facture rattachée à un bon de commande ou à une ligne de budget : payée seulement par son paiement. */
export function factureLieeAuBudget(f: { commandeId?: string | null; ligneBudgetId?: string | null }): boolean {
  return !!f.commandeId || !!f.ligneBudgetId;
}

export interface TransitionFacture {
  statut: StatutFacture;
  /** Possible pour cet utilisateur et cette facture. */
  possible: boolean;
  /** Pourquoi c'est impossible (affiché à côté du choix). */
  raison?: string;
}

/**
 * Changements de statut proposés à l'écran pour une facture (le serveur refait tous les contrôles,
 * notamment celui des dépenses qui la règlent).
 */
export function transitionsFacture(
  f: { status: StatutFacture; commandeId?: string | null; ligneBudgetId?: string | null },
  peut: (cle: string) => boolean
): TransitionFacture[] {
  return STATUTS_FACTURE.filter((s) => s !== f.status).map((statut) => {
    const droits = droitsTransitionFacture(f.status, statut);
    if (!droits.some(peut)) return { statut, possible: false, raison: "droit manquant" };
    if (statut === "PAYEE" && factureLieeAuBudget(f)) return { statut, possible: false, raison: "par le budget" };
    return { statut, possible: true };
  });
}

/** Vrai si l'utilisateur peut changer le statut de cette facture d'une façon ou d'une autre. */
export function peutChangerStatutFacture(
  f: { status: StatutFacture; commandeId?: string | null; ligneBudgetId?: string | null },
  peut: (cle: string) => boolean
): boolean {
  return transitionsFacture(f, peut).some((t) => t.possible);
}
