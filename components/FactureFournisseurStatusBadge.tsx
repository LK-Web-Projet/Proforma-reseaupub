import { cn } from '@/lib/utils';

export type FactureFournisseurStatus = 'EN_ATTENTE' | 'PAYEE' | 'ANNULEE';

export const FACTURE_FOURNISSEUR_STATUS_META: Record<
  FactureFournisseurStatus,
  { label: string; dot: string; bg: string; text: string; ring: string }
> = {
  PAYEE: {
    label: 'Payée',
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    ring: 'ring-green-600/20',
  },
  EN_ATTENTE: {
    label: 'En attente',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20',
  },
  ANNULEE: {
    label: 'Annulée',
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-600/20',
  },
};

interface StatusDotProps {
  status: FactureFournisseurStatus;
  animate?: boolean;
}

export function StatusDot({ status, animate = true }: StatusDotProps) {
  const meta = FACTURE_FOURNISSEUR_STATUS_META[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {animate && (
        <span
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', meta.dot)}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
    </span>
  );
}

interface FactureFournisseurStatusBadgeProps {
  status: FactureFournisseurStatus;
  className?: string;
  animate?: boolean;
}

export function FactureFournisseurStatusBadge({ status, className, animate = true }: FactureFournisseurStatusBadgeProps) {
  const meta = FACTURE_FOURNISSEUR_STATUS_META[status];
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
      <StatusDot status={status} animate={animate} />
      {meta.label}
    </span>
  );
}
