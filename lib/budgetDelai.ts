/**
 * Délai propre à une ligne de budget (DemandeBudgetLigne.dateLimite) : état affiché sur la fiche
 * du budget et dans la fenêtre « Détail » de la ligne. Calcul seulement (rien n'est stocké).
 */

export type EtatDelaiLigne = 'A_VENIR' | 'PROCHE' | 'DEPASSE' | 'TERMINE';

/** Nombre de jours avant l'échéance : alerte « proche » à partir de ce seuil. */
export const JOURS_ALERTE_DELAI = 3;

const jourUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const jourLocal = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** Jours restants avant le délai (négatif = dépassé), en jours calendaires. */
export function joursAvantDelai(dateLimite: string | Date, now = new Date()): number {
  return Math.round((jourUTC(new Date(dateLimite)) - jourLocal(now)) / 86_400_000);
}

/**
 * État du délai d'une ligne :
 * - TERMINE : la ligne n'attend plus rien (retirée, budget clos, ou entièrement dépensée) ;
 * - DEPASSE / PROCHE / A_VENIR selon les jours restants.
 * `null` si la ligne n'a pas de délai.
 */
export function etatDelaiLigne(
  ligne: { dateLimite: string | Date | null; statutValidation: string; plafond: number; reste: number },
  budgetActif: boolean,
  now = new Date()
): EtatDelaiLigne | null {
  if (!ligne.dateLimite) return null;
  if (!budgetActif || ligne.statutValidation === 'RETIREE') return 'TERMINE';
  if (ligne.statutValidation === 'ACCORDEE' && ligne.plafond > 0 && ligne.reste <= 0) return 'TERMINE';
  const jours = joursAvantDelai(ligne.dateLimite, now);
  if (jours < 0) return 'DEPASSE';
  if (jours <= JOURS_ALERTE_DELAI) return 'PROCHE';
  return 'A_VENIR';
}

/** Texte court du délai : « Délai dépassé de 2 j », « Délai : aujourd'hui », « Délai dans 5 j »… */
export function libelleDelai(etat: EtatDelaiLigne, dateLimite: string | Date, now = new Date()): string {
  const jours = joursAvantDelai(dateLimite, now);
  if (etat === 'TERMINE') return 'Délai';
  if (jours < 0) return `Délai dépassé de ${-jours} j`;
  if (jours === 0) return "Délai : aujourd'hui";
  if (jours === 1) return 'Délai : demain';
  return `Délai dans ${jours} j`;
}

export const CLASSES_DELAI: Record<EtatDelaiLigne, string> = {
  A_VENIR: 'bg-sky-50 text-sky-700 border-sky-200',
  PROCHE: 'bg-amber-50 text-amber-800 border-amber-300',
  DEPASSE: 'bg-red-50 text-red-700 border-red-300',
  TERMINE: 'bg-gray-50 text-gray-500 border-gray-200',
};
