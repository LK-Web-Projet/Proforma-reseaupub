/**
 * Rapport « Dépenses par département » — calculs partagés (écran, tableau de bord, tests ; aucun
 * accès à la base ici).
 *
 * Règle retenue (2026-11-25) : une dépense compte dans le **mois où l'argent est réellement sorti**
 * (date de la dépense), quel que soit le mois du budget qui la finance. Le département est celui de
 * la ligne de budget. Les dépenses annulées ne comptent pas.
 *
 * À côté, pour comparer :
 * - « Prévu » : montants accordés (+ dépassements approuvés) des budgets rattachés à ce mois (mois
 *   du budget mensuel, sinon mois de validation) — même règle que le suivi budgétaire ;
 * - « Enveloppe » : montant mensuel indicatif saisi sur le département ;
 * - « Hors budget » : sorties de caisse rattachées à aucune ligne de budget (hors transferts entre
 *   caisses et dépenses annulées), qui ne peuvent donc être attribuées à aucun département.
 */

export const SANS_DEPARTEMENT = "Sans département";

export type SourceDepenseRapport = "MANUEL" | "PROFORMA" | "CAMPTRACK" | "ANCIEN";

export const LIBELLES_SOURCE_DEPENSE: Record<SourceDepenseRapport, string> = {
  MANUEL: "Fiche budget",
  PROFORMA: "Fiche proforma",
  CAMPTRACK: "CampTrack",
  ANCIEN: "Budget payé avant le suivi des dépenses",
};

export interface DepenseDepartement {
  id: string;
  /** Date de sortie de l'argent (ISO). */
  date: string;
  /** "yyyy-MM" de `date`. */
  mois: string;
  departement: string;
  categorie: string | null;
  montant: number;
  budgetId: string;
  budgetNumero: string;
  ligne: string;
  receveur: string | null;
  moyen: string | null;
  source: SourceDepenseRapport;
}

export interface PrevuDepartement {
  mois: string;
  departement: string;
  prevu: number;
}

export interface DepartementRapport {
  id: string | null;
  nom: string;
  couleur: string | null;
  enveloppeMensuelle: number | null;
  actif: boolean;
}

export interface HorsBudgetMois {
  mois: string;
  montant: number;
  nb: number;
}

export interface RapportDepensesDepartement {
  /** Premier et dernier mois affichés ("yyyy-MM"). */
  from: string;
  to: string;
  /** Mois affichés, du plus ancien au plus récent. */
  mois: string[];
  /** Mois chargé en plus, juste avant `from`, pour la comparaison du premier mois. */
  moisComparaison: string;
  departements: DepartementRapport[];
  depenses: DepenseDepartement[];
  prevus: PrevuDepartement[];
  horsBudget: HorsBudgetMois[];
}

// --- Mois -------------------------------------------------------------------------------

/** "yyyy-MM" d'une date (UTC). */
export function moisCle(d: Date | string): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Décale un mois "yyyy-MM" de `n` mois. */
export function decalerMois(cle: string, n: number): string {
  const [a, m] = cle.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return moisCle(d);
}

/** Mois de `from` à `to` inclus ("yyyy-MM"). Vide si `from` > `to`. */
export function listeMois(from: string, to: string): string[] {
  const liste: string[] = [];
  for (let m = from; m <= to && liste.length < 240; m = decalerMois(m, 1)) liste.push(m);
  return liste;
}

/** Variation relative (0,25 = +25 %) ; null si rien le mois précédent (comparaison impossible). */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent <= 0) return null;
  return (actuel - precedent) / precedent;
}

// --- Classement d'un mois --------------------------------------------------------------

export interface LigneClassement {
  rang: number;
  departement: string;
  departementId: string | null;
  realise: number;
  nbDepenses: number;
  /** Part du total dépensé du mois par les départements (0–1). */
  part: number;
  precedent: number;
  variation: number | null;
  prevu: number;
  enveloppe: number | null;
}

export interface ClassementMois {
  mois: string;
  lignes: LigneClassement[];
  total: number;
  totalPrecedent: number;
  variation: number | null;
  horsBudget: number;
  nbDepenses: number;
}

/**
 * Classement des départements pour un mois : du plus gros au plus petit dépensé. Figurent les
 * départements qui ont dépensé ce mois-ci, ou le mois précédent, ou qui avaient un prévu. Les
 * ex aequo sont départagés par nom (ordre stable).
 */
export function classementMois(r: Pick<RapportDepensesDepartement, "departements" | "depenses" | "prevus" | "horsBudget">, mois: string): ClassementMois {
  const precedent = decalerMois(mois, -1);
  const infos = new Map(r.departements.map((d) => [d.nom, d]));
  const lignes = new Map<string, { realise: number; nb: number; precedent: number; prevu: number }>();
  const ligne = (dep: string) => {
    let l = lignes.get(dep);
    if (!l) lignes.set(dep, (l = { realise: 0, nb: 0, precedent: 0, prevu: 0 }));
    return l;
  };
  for (const d of r.depenses) {
    if (d.mois === mois) {
      const l = ligne(d.departement);
      l.realise += d.montant;
      l.nb += 1;
    } else if (d.mois === precedent) {
      ligne(d.departement).precedent += d.montant;
    }
  }
  for (const p of r.prevus) if (p.mois === mois && p.prevu > 0) ligne(p.departement).prevu += p.prevu;

  const total = [...lignes.values()].reduce((s, l) => s + l.realise, 0);
  const totalPrecedent = [...lignes.values()].reduce((s, l) => s + l.precedent, 0);
  const tri = [...lignes.entries()].sort((a, b) => b[1].realise - a[1].realise || a[0].localeCompare(b[0], "fr"));
  return {
    mois,
    lignes: tri.map(([dep, l], i) => ({
      rang: i + 1,
      departement: dep,
      departementId: infos.get(dep)?.id ?? null,
      realise: l.realise,
      nbDepenses: l.nb,
      part: total > 0 ? l.realise / total : 0,
      precedent: l.precedent,
      variation: variation(l.realise, l.precedent),
      prevu: l.prevu,
      enveloppe: infos.get(dep)?.enveloppeMensuelle ?? null,
    })),
    total,
    totalPrecedent,
    variation: variation(total, totalPrecedent),
    horsBudget: r.horsBudget.find((h) => h.mois === mois)?.montant ?? 0,
    nbDepenses: [...lignes.values()].reduce((s, l) => s + l.nb, 0),
  };
}

// --- Évolution et catégories -----------------------------------------------------------

/** Dépensé par département et par mois : `valeurs[departement][mois]`. */
export function evolutionParMois(depenses: DepenseDepartement[], mois: string[]): Map<string, Map<string, number>> {
  const affiches = new Set(mois);
  const res = new Map<string, Map<string, number>>();
  for (const d of depenses) {
    if (!affiches.has(d.mois)) continue;
    let parMois = res.get(d.departement);
    if (!parMois) res.set(d.departement, (parMois = new Map()));
    parMois.set(d.mois, (parMois.get(d.mois) ?? 0) + d.montant);
  }
  return res;
}

export interface LigneCategorie {
  categorie: string | null;
  montant: number;
  nb: number;
  part: number;
}

/** Répartition par catégorie de dépense, pour un mois et (facultatif) un département. */
export function repartitionCategories(depenses: DepenseDepartement[], mois: string, departement?: string | null): LigneCategorie[] {
  const map = new Map<string, { categorie: string | null; montant: number; nb: number }>();
  for (const d of depenses) {
    if (d.mois !== mois || (departement && d.departement !== departement)) continue;
    const cle = d.categorie ?? "__aucune__";
    const l = map.get(cle) ?? { categorie: d.categorie, montant: 0, nb: 0 };
    l.montant += d.montant;
    l.nb += 1;
    map.set(cle, l);
  }
  const total = [...map.values()].reduce((s, l) => s + l.montant, 0);
  return [...map.values()]
    .map((l) => ({ ...l, part: total > 0 ? l.montant / total : 0 }))
    .sort((a, b) => b.montant - a.montant);
}

// --- Couleurs du graphique -------------------------------------------------------------

/** Palette catégorielle validée (ordre fixe, jamais cyclé) ; au-delà : « Autres » en gris. */
export const PALETTE_DEPARTEMENTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
export const COULEUR_AUTRES = "#94a3b8";
export const AUTRES_DEPARTEMENTS = "Autres départements";

/**
 * Départements du graphique d'évolution : les 7 plus gros sur la période gardent chacun leur
 * couleur (attribuée par ordre alphabétique, donc stable quel que soit leur rang), les autres sont
 * regroupés dans « Autres départements ». Renvoie l'ordre d'affichage et la couleur de chacun.
 */
export function seriesGraphique(evolution: Map<string, Map<string, number>>): { nom: string; couleur: string }[] {
  const totaux = [...evolution.entries()].map(([nom, parMois]) => ({ nom, total: [...parMois.values()].reduce((s, v) => s + v, 0) }));
  const gardes = totaux
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, PALETTE_DEPARTEMENTS.length)
    .map((t) => t.nom)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const series = gardes.map((nom, i) => ({ nom, couleur: PALETTE_DEPARTEMENTS[i] }));
  if (totaux.some((t) => t.total > 0 && !gardes.includes(t.nom))) series.push({ nom: AUTRES_DEPARTEMENTS, couleur: COULEUR_AUTRES });
  return series;
}
