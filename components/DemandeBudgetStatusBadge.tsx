import { cn } from '@/lib/utils';

export type DemandeBudgetStatus = 'SOUMISE' | 'VALIDEE' | 'REJETEE' | 'PAYEE';

export const DEMANDE_BUDGET_STATUS_META: Record<
  DemandeBudgetStatus,
  { label: string; dot: string; bg: string; text: string; ring: string }
> = {
  SOUMISE: {
    label: 'Soumise',
    dot: 'bg-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'ring-orange-600/20',
  },
  VALIDEE: {
    label: 'Validée',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-600/20',
  },
  REJETEE: {
    label: 'Rejetée',
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-600/20',
  },
  PAYEE: {
    label: 'Payée',
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    ring: 'ring-green-600/20',
  },
};

interface DemandeBudgetStatusBadgeProps {
  status: DemandeBudgetStatus | string;
  className?: string;
  animate?: boolean;
}

export function DemandeBudgetStatusBadge({ status, className, animate = false }: DemandeBudgetStatusBadgeProps) {
  const meta = DEMANDE_BUDGET_STATUS_META[status as DemandeBudgetStatus] ?? DEMANDE_BUDGET_STATUS_META.SOUMISE;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        meta.bg,
        meta.text,
        meta.ring,
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {animate && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', meta.dot)} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}
