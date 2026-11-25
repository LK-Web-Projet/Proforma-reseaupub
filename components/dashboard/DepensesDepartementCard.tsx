'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VariationMontant } from '@/components/rapports/VariationMontant';
import { classementMois, moisCle, type ClassementMois } from '@/lib/depensesDepartement';

const NB_AFFICHES = 5;

/**
 * Résumé du tableau de bord (vue « Ce mois ») : les départements qui dépensent le plus ce mois-ci,
 * avec l'évolution par rapport au mois précédent. Masqué pour les rôles hors circuit budget (le
 * rapport leur est fermé) ou si le chargement échoue.
 */
export function DepensesDepartementCard({ formatCurrency }: { formatCurrency: (v: number) => string }) {
  const [etat, setEtat] = useState<'chargement' | 'masque' | ClassementMois>('chargement');

  useEffect(() => {
    let actif = true;
    const mois = moisCle(new Date());
    fetch(`/api/rapports/depenses-departement?from=${mois}&to=${mois}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => actif && setEtat(data ? classementMois(data, mois) : 'masque'))
      .catch(() => actif && setEtat('masque'));
    return () => {
      actif = false;
    };
  }, []);

  if (etat === 'masque') return null;

  const lignes = etat === 'chargement' ? [] : etat.lignes.filter((l) => l.realise > 0);
  const max = Math.max(1, ...lignes.map((l) => l.realise));

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" /> Dépenses par département — {format(new Date(), 'MMMM', { locale: fr })}
        </CardTitle>
        <Link href="/dashboard/rapports/depenses-departement" className="inline-flex items-center text-xs font-medium text-primary hover:underline shrink-0">
          Voir le rapport <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {etat === 'chargement' ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
        ) : lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune dépense de budget enregistrée ce mois-ci.</p>
        ) : (
          <>
            <ol className="space-y-2.5">
              {lignes.slice(0, NB_AFFICHES).map((l) => (
                <li key={l.departement} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 font-semibold text-muted-foreground">{l.rang}.</span>
                      {l.departement}
                    </span>
                    <span className="shrink-0 flex items-baseline gap-2">
                      <span className="font-semibold whitespace-nowrap">{formatCurrency(l.realise)}</span>
                      <VariationMontant variation={l.variation} actuel={l.realise} />
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
                    <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(l.realise / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
            <p className="flex flex-wrap items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
              Total des départements : <span className="font-semibold text-foreground">{formatCurrency(etat.total)}</span>
              <VariationMontant variation={etat.variation} actuel={etat.total} /> par rapport au mois précédent
              {lignes.length > NB_AFFICHES && <span>· {lignes.length - NB_AFFICHES} autre(s) département(s)</span>}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
