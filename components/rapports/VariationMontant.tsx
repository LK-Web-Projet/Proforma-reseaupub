import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Évolution d'une dépense par rapport au mois précédent : flèche + pourcentage (jamais la couleur
 * seule). Hausse de dépense en rouge, baisse en vert ; « nouveau » quand rien le mois d'avant.
 */
export function VariationMontant({ variation, actuel, className }: { variation: number | null; actuel: number; className?: string }) {
  if (variation === null) {
    return <span className={cn('text-[11px] text-muted-foreground', className)}>{actuel > 0 ? 'nouveau' : '—'}</span>;
  }
  const pct = Math.round(variation * 100);
  if (pct === 0) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-xs text-muted-foreground', className)}>
        <Minus className="h-3 w-3" /> stable
      </span>
    );
  }
  const hausse = pct > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', hausse ? 'text-red-700' : 'text-green-700', className)}>
      {hausse ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {hausse ? '+' : ''}
      {pct} %
    </span>
  );
}
