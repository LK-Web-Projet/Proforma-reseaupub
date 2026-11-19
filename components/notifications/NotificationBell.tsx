'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  evenement: string;
  titre: string;
  message: string;
  lien: string | null;
  luAt: string | null;
  createdAt: string;
}

const RAFRAICHISSEMENT_MS = 60_000;

/**
 * Cloche des notifications (barre latérale, à droite de « Recherche ») : bleue sans non lues,
 * rouge et pleine avec la pastille du nombre de non lues ; rafraîchie chaque minute et au retour
 * sur l'onglet ; les 10 dernières dans un menu.
 */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nonLues, setNonLues] = useState(0);

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setNonLues(data.nonLues ?? 0);
    } catch {
      // Hors ligne ou session expirée : la cloche reste en l'état.
    }
  }, []);

  useEffect(() => {
    charger();
    const timer = setInterval(charger, RAFRAICHISSEMENT_MS);
    const auRetour = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [charger]);

  useEffect(() => {
    if (open) charger();
  }, [open, charger]);

  const marquerLues = async (ids?: string[]) => {
    await fetch('/api/notifications/lues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => undefined);
    await charger();
  };

  const ouvrir = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.luAt) await marquerLues([n.id]);
    if (n.lien) router.push(n.lien);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={nonLues ? `${nonLues} notification(s) non lue(s)` : 'Notifications'}
          className={cn(
            'relative h-8 w-8 shrink-0 rounded-full transition-colors',
            nonLues > 0 ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700',
            open && (nonLues > 0 ? 'bg-red-50' : 'bg-blue-50')
          )}
          aria-label={`Notifications${nonLues ? ` (${nonLues} non lues)` : ''}`}
        >
          {/* Non lues : cloche rouge pleine ; sinon bleue. Badge DANS le bouton : la zone de défilement
              de la barre latérale coupe tout ce qui dépasse. */}
          <Bell className={cn('h-[18px] w-[18px]', nonLues > 0 && 'fill-current')} />
          {nonLues > 0 && (
            <span className="pointer-events-none absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-600 text-white text-[9px] font-bold leading-[15px] text-center ring-2 ring-sidebar">
              {nonLues > 99 ? '99+' : nonLues}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {nonLues > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => marquerLues()}>
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
            </Button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune notification.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => ouvrir(n)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/60 transition-colors',
                  !n.luAt && 'bg-blue-50/60'
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.luAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                  <div className="min-w-0">
                    <p className={cn('text-sm leading-snug', !n.luAt && 'font-semibold')}>{n.titre}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
            Voir toutes les notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
