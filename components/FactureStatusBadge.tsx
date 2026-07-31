import { cn } from '@/lib/utils';

export type FactureStatus =
  | 'Brouillon'
  | 'Envoyer'
  | 'Valider'
  | 'Payer'
  | 'Solde'
  | 'Annuler'
  | 'Archiver';

export const FACTURE_STATUS_META: Record<
  FactureStatus,
  { label: string; dot: string; bg: string; text: string; ring: string }
> = {
  Brouillon: {
    label: 'Brouillon',
    dot: 'bg-gray-400',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    ring: 'ring-gray-400/20',
  },
  Envoyer: {
    label: 'Envoyée',
    dot: 'bg-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'ring-orange-600/20',
  },
  Valider: {
    label: 'Validée',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-600/20',
  },
  Payer: {
    label: 'Payé',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20',
  },
  Solde: {
    label: 'Soldée',
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    ring: 'ring-green-600/20',
  },
  Annuler: {
    label: 'Annulée',
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-600/20',
  },
  Archiver: {
    label: 'Archivée',
    dot: 'bg-slate-500',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    ring: 'ring-slate-600/20',
  },
};

interface FactureStatusBadgeProps {
  status: FactureStatus | string;
  className?: string;
  animate?: boolean;
  /** Pourcentage déjà payé (0-100), affiché uniquement pour le statut "Payer" (ex: "Payé 50%"). */
  percentPaid?: number;
}

export function FactureStatusBadge({ status, className, animate = false, percentPaid }: FactureStatusBadgeProps) {
  const meta = FACTURE_STATUS_META[status as FactureStatus] ?? FACTURE_STATUS_META.Brouillon;
  const label = status === 'Payer' && typeof percentPaid === 'number'
    ? `Payé ${percentPaid}%`
    : meta.label;

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
      {label}
    </span>
  );
}
