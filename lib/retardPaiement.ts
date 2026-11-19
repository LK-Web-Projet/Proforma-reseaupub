import { resolveTypeFournisseur, type TypeFournisseurValue } from "@/lib/typeFournisseur";

/**
 * Retards de paiement des factures prestataires (sans dépendance serveur : importable à l'écran).
 *
 * Une facture EN_ATTENTE doit être payée dans un délai qui dépend du type du prestataire,
 * compté en jours calendaires à partir de la date de la facture :
 * - Fournisseur : 30 jours ;
 * - Prestataire interne : 7 jours ;
 * - Prestataire externe : 3 jours.
 * Les délais se règlent dans Paramètres > Rôles (EntrepriseConfig). Au-delà de l'échéance, la facture
 * est « en retard » : ligne rouge et bouton clignotant dans les listes, notification aux comptables
 * et à la direction (tâche planifiée, une seule fois par facture).
 */

export interface DelaisPaiement {
  fournisseur: number;
  interne: number;
  externe: number;
}

export const DELAIS_PAIEMENT_DEFAUT: DelaisPaiement = { fournisseur: 30, interne: 7, externe: 3 };

/** Nombre de jours avant l'échéance à partir duquel la facture est signalée « bientôt due ». */
export const SEUIL_ECHEANCE_PROCHE = 2;

export function delaiPourType(typeFournisseur: string | null | undefined, delais: DelaisPaiement): number {
  const type: TypeFournisseurValue = resolveTypeFournisseur(typeFournisseur);
  if (type === "Fournisseur") return delais.fournisseur;
  if (type === "Prestataire externe") return delais.externe;
  return delais.interne;
}

export interface EtatEcheance {
  /** Délai appliqué (jours). */
  delai: number;
  /** Date limite de paiement (ISO). */
  echeance: string;
  /** Jours de retard (0 si dans les temps). */
  joursRetard: number;
  /** Jours restants avant l'échéance (0 le jour même, négatif en retard). */
  joursRestants: number;
  enRetard: boolean;
  /** Échéance dans SEUIL_ECHEANCE_PROCHE jours ou moins, pas encore en retard. */
  echeanceProche: boolean;
}

const JOUR_MS = 86_400_000;

/** Jour calendaire (UTC) d'une date : les dates de facture sont saisies « au jour ». */
function jourUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / JOUR_MS;
}

/**
 * État de l'échéance d'une facture ; null si elle n'est pas à payer (payée, annulée).
 */
export function etatEcheance(
  facture: { date: Date | string; status: string },
  typeFournisseur: string | null | undefined,
  delais: DelaisPaiement,
  maintenant: Date = new Date()
): EtatEcheance | null {
  if (facture.status !== "EN_ATTENTE") return null;
  const date = new Date(facture.date);
  if (Number.isNaN(date.getTime())) return null;
  const delai = delaiPourType(typeFournisseur, delais);
  const jourEcheance = jourUTC(date) + delai;
  const joursRestants = jourEcheance - jourUTC(maintenant);
  const enRetard = joursRestants < 0;
  return {
    delai,
    echeance: new Date(jourEcheance * JOUR_MS).toISOString(),
    joursRetard: enRetard ? -joursRestants : 0,
    joursRestants,
    enRetard,
    echeanceProche: !enRetard && joursRestants <= SEUIL_ECHEANCE_PROCHE,
  };
}

/** Synthèse des retards d'un prestataire (liste des prestataires). */
export interface RetardPrestataire {
  nombre: number;
  montant: number;
  joursMax: number;
}

export function syntheseRetards(
  factures: { montant: unknown; date: Date | string; status: string }[],
  typeFournisseur: string | null | undefined,
  delais: DelaisPaiement,
  maintenant: Date = new Date()
): RetardPrestataire | null {
  let nombre = 0;
  let montant = 0;
  let joursMax = 0;
  for (const f of factures) {
    const etat = etatEcheance(f, typeFournisseur, delais, maintenant);
    if (!etat?.enRetard) continue;
    nombre += 1;
    montant += Number(f.montant);
    joursMax = Math.max(joursMax, etat.joursRetard);
  }
  return nombre > 0 ? { nombre, montant, joursMax } : null;
}
