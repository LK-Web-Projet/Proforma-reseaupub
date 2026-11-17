import { cn } from '@/lib/utils';

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

/**
 * Consommé / prévu d'un budget ou d'une ligne : vert < 80 %, orange ≥ 80 %, rouge à 100 %.
 */
export function BudgetProgressBar({ consomme, prevu, compact = false }: { consomme: number; prevu: number; compact?: boolean }) {
  const pct = prevu > 0 ? Math.min((consomme / prevu) * 100, 100) : consomme > 0 ? 100 : 0;
  const color = pct >= 99.99 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-green-500';

  return (
    <div className="space-y-1 min-w-[120px]">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {formatMontant(consomme)} / {formatMontant(prevu)} ({Math.round(pct)} %)
        </p>
      )}
    </div>
  );
}
