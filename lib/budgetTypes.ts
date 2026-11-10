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
