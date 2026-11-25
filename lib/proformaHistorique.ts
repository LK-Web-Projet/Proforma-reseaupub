/**
 * Historique d'une proforma : codes et libellés des actions (aucun accès à la base : utilisable à
 * l'écran). L'écriture se fait par journaliserProforma (lib/proformaHistoriqueServeur.ts).
 */

export const ACTIONS_PROFORMA = {
  CREATION: { libelle: "Création", couleur: "bg-slate-100 text-slate-700" },
  MODIFICATION: { libelle: "Modification", couleur: "bg-blue-50 text-blue-700" },
  STATUT: { libelle: "Statut", couleur: "bg-indigo-50 text-indigo-700" },
  ENCAISSEMENT: { libelle: "Encaissement", couleur: "bg-green-50 text-green-700" },
  DEPENSE: { libelle: "Dépense", couleur: "bg-red-50 text-red-700" },
  DEPENSE_ANNULEE: { libelle: "Dépense annulée", couleur: "bg-orange-50 text-orange-700" },
  DEPENSE_RATTACHEE: { libelle: "Dépense rattachée au budget", couleur: "bg-orange-50 text-orange-700" },
  PIECE_AJOUTEE: { libelle: "Pièce ajoutée", couleur: "bg-cyan-50 text-cyan-700" },
  PIECE_MODIFIEE: { libelle: "Pièce modifiée", couleur: "bg-cyan-50 text-cyan-700" },
  PIECE_RETIREE: { libelle: "Pièce retirée", couleur: "bg-amber-50 text-amber-700" },
  PREUVE_AJOUTEE: { libelle: "Justificatif ajouté", couleur: "bg-cyan-50 text-cyan-700" },
  EMAIL_ENVOYE: { libelle: "E-mail envoyé", couleur: "bg-violet-50 text-violet-700" },
  BUDGET_LIE: { libelle: "Budget lié", couleur: "bg-purple-50 text-purple-700" },
  RELANCE_NOTIFIEE: { libelle: "Relance de paiement", couleur: "bg-red-50 text-red-700" },
} as const;

export type ActionProforma = keyof typeof ACTIONS_PROFORMA;

export function libelleActionProforma(action: string): string {
  return (ACTIONS_PROFORMA as Record<string, { libelle: string }>)[action]?.libelle ?? action;
}

export function couleurActionProforma(action: string): string {
  return (ACTIONS_PROFORMA as Record<string, { couleur: string }>)[action]?.couleur ?? "bg-slate-100 text-slate-700";
}

export const LIBELLES_STATUT_PROFORMA: Record<string, string> = {
  Brouillon: "Brouillon",
  Envoyer: "Envoyée",
  Valider: "Validée",
  Annuler: "Annulée",
  Archiver: "Archivée",
  Payer: "Payée (en cours)",
  Solde: "Soldée",
};

export const libelleStatutProforma = (s: string | null | undefined) => (s ? LIBELLES_STATUT_PROFORMA[s] ?? s : "—");

/** Montant en FCFA pour les textes de l'historique. */
export function fcfa(n: number | string): string {
  return `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 }).replace(/ /g, " ")} FCFA`;
}
