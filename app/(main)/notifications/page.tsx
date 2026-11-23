'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EVENEMENTS_NOTIFICATION, isEvenementNotification } from '@/lib/notifications/evenements';
import type { NotificationItem } from '@/components/notifications/NotificationBell';

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [filtreNonLues, setFiltreNonLues] = useState(false);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=200${filtreNonLues ? '&nonLuesSeulement=1' : ''}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setNonLues(data.nonLues ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [filtreNonLues]);

  useEffect(() => {
    charger();
  }, [charger]);

  const marquerLues = async (ids?: string[]) => {
    await fetch('/api/notifications/lues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    await charger();
  };

  // Navigation immédiate (barre de progression) ; la notification est marquée lue en parallèle.
  const ouvrir = (n: NotificationItem) => {
    if (n.lien) router.push(n.lien);
    if (!n.luAt) void marquerLues([n.id]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{nonLues} non lue(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filtreNonLues ? 'default' : 'outline'} size="sm" onClick={() => setFiltreNonLues((v) => !v)}>
            Non lues seulement
          </Button>
          {nonLues > 0 && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => marquerLues()}>
              <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucune notification.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => ouvrir(n)}
                className={cn('w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/50', !n.luAt && 'bg-blue-50/60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.luAt && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                      <p className={cn('text-sm', !n.luAt && 'font-semibold')}>{n.titre}</p>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {isEvenementNotification(n.evenement) ? EVENEMENTS_NOTIFICATION[n.evenement].groupe : n.evenement}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
