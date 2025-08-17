export const STATUT_FACTURE = {
  Brouillon: "Brouillon",
  Envoyer: "Envoyer",
  Valider: "Valider",
  Annuler: "Annuler",
  Archiver: "Archiver",
  Payer: "Payer",
} as const;

export const STATUT_FACTURE_OPTIONS = Object.entries(STATUT_FACTURE).map(
  ([key, value]) => ({ value: key, label: value })
);

export const UNITE_DUREE = {
  jour: "Jour",
  heure: "Heure",
  mois: "Mois",
  semaine: "Semaine",
} as const;

export const UNITE_DUREE_OPTIONS = Object.entries(UNITE_DUREE).map(
  ([key, value]) => ({ value: key, label: value })
);

export const DEVISE = {
  XOF: "XOF (Franc CFA)",
  EUR: "EUR (Euro)",
  USD: "USD (Dollar)",
} as const;

export const DEVISE_OPTIONS = Object.entries(DEVISE).map(([key, value]) => ({
  value: key,
  label: value,
}));

// To get the keys as a type
export type StatutFacture = keyof typeof STATUT_FACTURE;
export type UniteDuree = keyof typeof UNITE_DUREE;
export type Devise = keyof typeof DEVISE;
