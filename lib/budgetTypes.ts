// Types de budget — libellés et couleurs partagés par les écrans budget (aucune dépendance
// serveur : importable côté client). Voir l'enum TypeBudget dans prisma/schema.prisma.
export const TYPE_BUDGET_VALUES = ['MENSUEL', 'PONCTUEL', 'CAMPAGNE', 'TIERS'] as const;
export type TypeBudgetValue = (typeof TYPE_BUDGET_VALUES)[number];

export const TYPE_BUDGET_META: Record<TypeBudgetValue, { label: string; description: string; className: string }> = {
  MENSUEL: {
    label: 'Mensuel',
    description: "Budget prévisionnel d'un service pour un mois (validé par l'administrateur).",
    className: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  PONCTUEL: {
    label: 'Ponctuel',
    description: 'Dépense interne imprévue (achat d’équipement, besoin non prévu au budget du mois…).',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  CAMPAGNE: {
    label: 'Campagne',
    description: 'Budget d’une campagne client : sa proforma liée, les dépenses lui sont imputées (validé par l’administrateur).',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  TIERS: {
    label: 'Tiers',
    description: 'Pour le compte d’une entreprise ou d’un client sans proforma (proforma facultative).',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

/**
 * Types toujours validés au niveau administrateur (« Valider les budgets mensuels, de campagne et
 * au-dessus du plafond »), quel que soit le montant. Les autres (ponctuel, tiers) peuvent l'être
 * par le rôle délégué jusqu'au plafond. Partagé par le serveur (lib/budgetAuth.ts) et l'écran.
 */
export const TYPES_VALIDATION_ADMIN: readonly TypeBudgetValue[] = ['MENSUEL', 'CAMPAGNE'];

export function typeValideParAdmin(type: string): boolean {
  return (TYPES_VALIDATION_ADMIN as readonly string[]).includes(type);
}

/**
 * Nom du receveur d'une dépense : facultatif pour les budgets mensuels et de campagne (la dépense
 * est déjà rattachée au service ou à la campagne), obligatoire pour les autres types.
 */
export const TYPES_RECEVEUR_FACULTATIF: readonly TypeBudgetValue[] = ['MENSUEL', 'CAMPAGNE'];

export function receveurObligatoire(type: string | null | undefined): boolean {
  return !(TYPES_RECEVEUR_FACULTATIF as readonly string[]).includes(type ?? '');
}

/** Libellé enregistré quand le receveur n'est pas indiqué (budget mensuel ou de campagne). */
export const RECEVEUR_NON_PRECISE = 'Non précisé';

export function typeBudgetLabel(type: string | null | undefined): string {
  return TYPE_BUDGET_META[type as TypeBudgetValue]?.label ?? 'Ponctuel';
}

// Catégories de dépense normalisées (enum CategorieDepense) — servent à comparer les budgets
// d'un mois à l'autre dans le rapport « Suivi budgétaire ».
export const CATEGORIE_DEPENSE_VALUES = [
  'CARBURANT',
  'TRANSPORT',
  'LOYER_CHARGES',
  'COMMUNICATION',
  'FOURNITURES',
  'EQUIPEMENT',
  'MAINTENANCE',
  'IMPRESSION',
  'PRESTATION',
  'PERSONNEL',
  'RESTAURATION',
  'AUTRE',
] as const;
export type CategorieDepenseValue = (typeof CATEGORIE_DEPENSE_VALUES)[number];

export const CATEGORIE_DEPENSE_LABELS: Record<CategorieDepenseValue, string> = {
  CARBURANT: 'Carburant',
  TRANSPORT: 'Transport / déplacements',
  LOYER_CHARGES: 'Loyer & charges (eau, électricité)',
  COMMUNICATION: 'Téléphone & internet',
  FOURNITURES: 'Fournitures de bureau',
  EQUIPEMENT: 'Équipement / matériel',
  MAINTENANCE: 'Entretien & réparations',
  IMPRESSION: 'Impression & supports',
  PRESTATION: 'Prestations / sous-traitance',
  PERSONNEL: 'Primes, per diem, missions',
  RESTAURATION: 'Restauration',
  AUTRE: 'Autre',
};

export function categorieLabel(value: string | null | undefined): string {
  return value ? CATEGORIE_DEPENSE_LABELS[value as CategorieDepenseValue] ?? value : 'Non catégorisé';
}

// Moyens de paiement (enum ModePaiementDemande). L'ordre suit la procédure de paiement :
// espèces (petite caisse), MoMo (personnes), chèque / virement (entreprises), carte (achats en ligne).
export const MODE_PAIEMENT_VALUES = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CARTE', 'AUTRE'] as const;
export type ModePaiementValue = (typeof MODE_PAIEMENT_VALUES)[number];

export const MODE_PAIEMENT_LABELS: Record<ModePaiementValue, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement bancaire',
  CARTE: 'Carte bancaire',
  AUTRE: 'Autre',
};

export const MODE_PAIEMENT_OPTIONS = MODE_PAIEMENT_VALUES.map((value) => ({ value, label: MODE_PAIEMENT_LABELS[value] }));

export function modePaiementLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return MODE_PAIEMENT_LABELS[value as ModePaiementValue] ?? value;
}

/**
 * Total prévu par moyen de paiement (procédure, section 4 : « le total prévu par moyen de
 * paiement est connu dès le départ »). Une ligne sans moyen prend celui de la demande ; les
 * lignes retirées ne comptent pas. `accorde` = montant accordé (0 tant que la ligne ne l'est pas).
 */
export function totauxParModePaiement(
  lignes: { montant: number | string; modePaiement?: string | null; statutValidation?: string; montantAccorde?: number | string | null }[],
  modeParDefaut: string
): { mode: string; label: string; demande: number; accorde: number }[] {
  const totaux = new Map<string, { demande: number; accorde: number }>();
  for (const l of lignes) {
    if (l.statutValidation === 'RETIREE') continue;
    const mode = l.modePaiement || modeParDefaut;
    const t = totaux.get(mode) ?? { demande: 0, accorde: 0 };
    t.demande += Number(l.montant);
    if (l.statutValidation === 'ACCORDEE') t.accorde += Number(l.montantAccorde ?? l.montant);
    totaux.set(mode, t);
  }
  const connus: readonly string[] = MODE_PAIEMENT_VALUES;
  const ordre = [
    ...connus.filter((m) => totaux.has(m)),
    ...Array.from(totaux.keys()).filter((m) => !connus.includes(m)),
  ];
  return ordre.map((mode) => ({ mode, label: modePaiementLabel(mode), ...totaux.get(mode)! }));
}
