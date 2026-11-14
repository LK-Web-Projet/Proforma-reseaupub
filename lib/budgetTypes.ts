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
    description: 'Budget d’une campagne client : au moins une proforma liée, les dépenses lui sont imputées.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  TIERS: {
    label: 'Tiers',
    description: 'Pour le compte d’une entreprise ou d’un client sans proforma (proforma facultative).',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

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
