'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BellRing, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  CANAL_LABELS,
  CANAUX_NOTIFICATION,
  EVENEMENTS_NOTIFICATION,
  isEvenementNotification,
  type CanalNotificationValue,
} from '@/lib/notifications/evenements';

interface Preference {
  evenement: string;
  canal: CanalNotificationValue;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

/**
 * Paramètres > Notifications : pour chaque événement, l'admin choisit le canal — email, notification
 * dans l'application, ou les deux. Une adresse sans compte (liste de diffusion) reçoit toujours l'email.
 */
export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [initial, setInitial] = useState<Record<string, CanalNotificationValue>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(async (res) => {
        if (res.status === 403) return setForbidden(true);
        if (!res.ok) throw new Error();
        const data: Preference[] = await res.json();
        setPrefs(data);
        setInitial(Object.fromEntries(data.map((p) => [p.evenement, p.canal])));
      })
      .catch(() => toast.error('Impossible de charger les préférences.'))
      .finally(() => setLoading(false));
  }, []);

  const modifiees = useMemo(() => prefs.filter((p) => initial[p.evenement] !== p.canal), [prefs, initial]);

  const groupes = useMemo(() => {
    const map = new Map<string, Preference[]>();
    for (const p of prefs) {
      const groupe = isEvenementNotification(p.evenement) ? EVENEMENTS_NOTIFICATION[p.evenement].groupe : 'Autres';
      map.set(groupe, [...(map.get(groupe) ?? []), p]);
    }
    return Array.from(map.entries());
  }, [prefs]);

  const changer = (evenement: string, canal: CanalNotificationValue) =>
    setPrefs((prev) => prev.map((p) => (p.evenement === evenement ? { ...p, canal } : p)));

  const toutRegler = (canal: CanalNotificationValue) => setPrefs((prev) => prev.map((p) => ({ ...p, canal })));

  const enregistrer = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: modifiees.map(({ evenement, canal }) => ({ evenement, canal })) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : "Erreur lors de l'enregistrement.");
      }
      setInitial(Object.fromEntries(prefs.map((p) => [p.evenement, p.canal])));
      toast.success('Préférences enregistrées.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setSaving(false);
    }
  };

  if (forbidden) {
    return <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/parametres"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BellRing className="h-6 w-6 text-amber-600" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pour chaque événement, choisissez comment les personnes concernées sont prévenues. Une adresse sans compte dans
            l&apos;application (liste de diffusion, externe) reçoit toujours l&apos;email.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Tout régler sur :</span>
        {CANAUX_NOTIFICATION.map((c) => (
          <Button key={c} variant="outline" size="sm" onClick={() => toutRegler(c)}>{CANAL_LABELS[c]}</Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        groupes.map(([groupe, liste]) => (
          <Card key={groupe}>
            <CardContent className="p-0">
              <p className="px-4 pt-4 pb-2 text-sm font-semibold">{groupe}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Événement</TableHead>
                    <TableHead>Destinataires</TableHead>
                    <TableHead className="text-right pr-4">Canal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map((p) => {
                    const meta = isEvenementNotification(p.evenement) ? EVENEMENTS_NOTIFICATION[p.evenement] : null;
                    return (
                      <TableRow key={p.evenement}>
                        <TableCell className="pl-4 font-medium text-sm">{meta?.libelle ?? p.evenement}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{meta?.destinataires}</TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-end">
                            <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label={meta?.libelle ?? p.evenement}>
                              {CANAUX_NOTIFICATION.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  role="radio"
                                  aria-checked={p.canal === c}
                                  onClick={() => changer(p.evenement, c)}
                                  className={cn(
                                    'px-2.5 py-1 text-xs rounded transition-colors',
                                    p.canal === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                  )}
                                >
                                  {CANAL_LABELS[c]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={enregistrer} disabled={saving || modifiees.length === 0} className="shadow-lg">
          {saving ? 'Enregistrement…' : modifiees.length > 0 ? `Enregistrer (${modifiees.length})` : 'Aucune modification'}
        </Button>
      </div>
    </div>
  );
}
