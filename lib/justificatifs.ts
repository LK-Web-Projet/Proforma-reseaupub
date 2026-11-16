// Justificatifs des dépenses (procédure de paiement, section 7) — calculs purs, importables côté
// client comme côté serveur :
// - chaque dépense a un « justificatif reçu : oui / non » (oui = au moins une pièce rattachée) ;
// - le justificatif est attendu sous 24 h ouvrées ; passé ce délai, la dépense passe en rouge ;
// - la liste des manquants part chaque soir à la DG (app/api/integration/rapports/justificatifs-manquants).

/** Délai de remise du justificatif, en heures ouvrées (lundi → vendredi). */
export const DELAI_JUSTIFICATIF_HEURES_OUVREES = 24;

// Bénin : UTC+1 toute l'année (pas d'heure d'été). Sert à savoir quand commence le week-end local.
const DECALAGE_LOCAL_MS = 60 * 60 * 1000;
const HEURE_MS = 60 * 60 * 1000;

function estWeekEndLocal(instantUtcMs: number): boolean {
  const jour = new Date(instantUtcMs + DECALAGE_LOCAL_MS).getUTCDay();
  return jour === 0 || jour === 6;
}

/**
 * Échéance du justificatif : `depuis` + 24 h en ne comptant que les heures du lundi au vendredi
 * (heure du Bénin). Une dépense du vendredi 15 h est due le lundi 15 h ; une dépense du samedi est
 * due le mardi 0 h (le décompte démarre le lundi).
 */
export function echeanceJustificatif(depuis: Date | string, heures = DELAI_JUSTIFICATIF_HEURES_OUVREES): Date {
  let t = new Date(depuis).getTime();
  let restant = heures;
  // Pas d'une heure : simple et exact pour un délai de quelques dizaines d'heures.
  while (restant > 0) {
    if (!estWeekEndLocal(t)) restant -= 1;
    t += HEURE_MS;
  }
  return new Date(t);
}

export interface DepensePourJustificatif {
  createdAt: Date | string;
  annuleeAt?: Date | string | null;
  nbJustificatifs: number;
  /** Dépense reçue de Camptrack : les pièces (états signés, historique MTN) y sont tenues. */
  source?: string | null;
}

export type EtatJustificatif = "RECU" | "ATTENDU" | "EN_RETARD" | "SANS_OBJET";

/**
 * État du justificatif d'une dépense :
 * - RECU      : au moins une pièce rattachée ;
 * - ATTENDU   : pas de pièce, mais encore dans le délai ;
 * - EN_RETARD : pas de pièce et délai dépassé → affichée en rouge, dans l'email du soir ;
 * - SANS_OBJET: dépense annulée.
 * Le compte part de l'enregistrement de la dépense (remise des fonds), pas de sa date déclarée.
 */
export function etatJustificatif(d: DepensePourJustificatif, maintenant: Date = new Date()): EtatJustificatif {
  if (d.annuleeAt) return "SANS_OBJET";
  if (d.nbJustificatifs > 0 || d.source === "CAMPTRACK") return "RECU";
  return maintenant.getTime() > echeanceJustificatif(d.createdAt).getTime() ? "EN_RETARD" : "ATTENDU";
}
