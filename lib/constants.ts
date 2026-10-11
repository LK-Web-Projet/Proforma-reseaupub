export const STATUT_FACTURE = {
  Brouillon: "Brouillon",
  Envoyer: "Envoyer",
  Valider: "Valider",
  Annuler: "Annuler",
  Archiver: "Archiver",
  Payer: "Payer",
  Solde: "Solde", // NEW STATUS
} as const;

export const STATUT_FACTURE_OPTIONS = Object.entries(STATUT_FACTURE).map(
  ([key, value]) => ({ value: key, label: value })
);

export const UNITE_DUREE = {
  heure: "Heure",
  jour: "Jour",
  semaine: "Semaine",
  mois: "Mois",
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

export const DISCOUNT_TYPE = {
  POURCENTAGE: "Pourcentage (%)",
  MONTANT: "Montant fixe",
} as const;

export const DISCOUNT_TYPE_OPTIONS = Object.entries(DISCOUNT_TYPE).map(
  ([value, label]) => ({ value, label })
);

// To get the keys as a type
export type StatutFacture = keyof typeof STATUT_FACTURE;
export type UniteDuree = keyof typeof UNITE_DUREE;
export type Devise = keyof typeof DEVISE;
export type DiscountTypeKey = keyof typeof DISCOUNT_TYPE;
