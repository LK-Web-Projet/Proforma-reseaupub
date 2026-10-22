import { cn } from '@/lib/utils';

interface PrestataireStatutMeta {
  label: string;
  dot: string;
  bg: string;
  text: string;
  ring: string;
}

const PRESTATAIRE_STATUT_META: { actif: PrestataireStatutMeta; inactif: PrestataireStatutMeta } = {
  actif: { label: 'Actif', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20' },
  inactif: { label: 'Inactif', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
};

interface PrestataireStatutDotProps {
  actif: boolean;
  animate?: boolean;
}

export function PrestataireStatutDot({ actif, animate }: PrestataireStatutDotProps) {
  const meta = actif ? PRESTATAIRE_STATUT_META.actif : PRESTATAIRE_STATUT_META.inactif;
  const shouldAnimate = animate ?? actif;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {shouldAnimate && (
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', meta.dot)} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
    </span>
  );
}

interface PrestataireStatutBadgeProps {
  actif: boolean;
  className?: string;
  animate?: boolean;
}

export function PrestataireStatutBadge({ actif, className, animate }: PrestataireStatutBadgeProps) {
  const meta = actif ? PRESTATAIRE_STATUT_META.actif : PRESTATAIRE_STATUT_META.inactif;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', meta.bg, meta.text, meta.ring, className)}>
      <PrestataireStatutDot actif={actif} animate={animate ?? actif} />
      {meta.label}
    </span>
  );
}
