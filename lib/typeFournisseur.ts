import { UserRound, Briefcase, Truck } from "lucide-react";

export const TYPE_FOURNISSEUR_VALUES = [
  "Prestataire interne",
  "Prestataire externe",
  "Fournisseur",
] as const;

export type TypeFournisseurValue = (typeof TYPE_FOURNISSEUR_VALUES)[number];

export const TYPE_FOURNISSEUR_COLORS: Record<TypeFournisseurValue, string> = {
  "Prestataire interne": "bg-blue-50 text-blue-700 border-blue-200",
  "Prestataire externe": "bg-purple-50 text-purple-700 border-purple-200",
  Fournisseur: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const TYPE_FOURNISSEUR_ICONS: Record<TypeFournisseurValue, typeof UserRound> = {
  "Prestataire interne": UserRound,
  "Prestataire externe": Briefcase,
  Fournisseur: Truck,
};

/**
 * Range une valeur existante (potentiellement vide/legacy/"Autre") dans une des 3 catégories
 * d'affichage. Ne modifie jamais la donnée en base — seulement pour filtrer/badger à l'écran.
 */
export function resolveTypeFournisseur(value: string | null | undefined): TypeFournisseurValue {
  if (value === "Prestataire externe" || value === "Fournisseur") return value;
  return "Prestataire interne";
}

/**
 * Procédure de paiement : seules les factures d'un « Fournisseur » répondent obligatoirement à un
 * bon de commande (payées par le solde du bon). Celles d'un prestataire interne ou externe peuvent
 * être rattachées directement à une ligne de budget (ex. budget mensuel de la comptabilité pour la paie).
 */
export function exigeBonDeCommande(typeFournisseur: string | null | undefined): boolean {
  return resolveTypeFournisseur(typeFournisseur) === "Fournisseur";
}
