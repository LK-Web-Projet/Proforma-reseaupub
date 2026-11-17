'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Rentabilite {
  caHT: number;
  caTTC: number;
  encaisse: number;
  aBudget: boolean;
  budgets: { id: string; numero: string; statut: string }[];
  budgetAccorde: number;
  depense: number;
  parBudget: number;
  horsBudget: number;
  aRattacher: number;
  resteBudget: number;
  margePrevue: number | null;
  margeReelle: number;
  tauxMargeReelle: number | null;
  coherent: boolean;
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

/**
 * Rentabilité de la campagne (fiche proforma) : chiffre d'affaires, budget accordé, dépensé (par le
 * budget, hors budget, à rattacher) et marges prévue / réelle. Toutes les dépenses de la campagne
 * sont centralisées ici, quelle que soit leur origine (budget, bon de commande, facture, CampTrack).
 * `version` : à changer pour recharger (après une dépense ou un encaissement).
 */
export function RentabiliteCampagneCard({ invoiceId, version }: { invoiceId: string; version?: number }) {
  const [r, setR] = useState<Rentabilite | null>(null);

  useEffect(() => {
    fetch(`/api/factures/${invoiceId}/rentabilite`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setR)
      .catch(() => setR(null));
  }, [invoiceId, version]);

  if (!r) return null;
  const ligne = (libelle: string, valeur: string, cls = '') => (
    <div className={`flex justify-between gap-3 text-sm ${cls}`}>
      <span className="text-muted-foreground">{libelle}</span>
      <span className="font-mono font-medium">{valeur}</span>
    </div>
  );
  const margeCls = (m: number) => (m < 0 ? 'text-red-600' : 'text-green-700');

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
          <TrendingUp className="h-4 w-4" /> Rentabilité de la campagne
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ligne("Chiffre d'affaires HT", fcfa(r.caHT))}
        {ligne('Encaissé', fcfa(r.encaisse))}
        {r.aBudget ? (
          ligne('Budget accordé', fcfa(r.budgetAccorde))
        ) : (
          <p className="text-xs text-muted-foreground">Campagne sans budget : les dépenses sont imputées directement à la proforma.</p>
        )}
        <div className="border-t pt-2 space-y-1">
          {ligne('Dépensé', fcfa(r.depense), 'font-semibold')}
          {r.aBudget && ligne('· par le budget', fcfa(r.parBudget), 'pl-2 text-xs')}
          {r.horsBudget !== 0 && ligne('· hors budget', fcfa(r.horsBudget), 'pl-2 text-xs')}
          {r.aRattacher > 0 && ligne('· CampTrack à rattacher', fcfa(r.aRattacher), 'pl-2 text-xs text-orange-700')}
          {r.aBudget && ligne('Reste sur le budget', fcfa(r.resteBudget), 'text-xs')}
        </div>
        <div className="border-t pt-2 space-y-1">
          {r.margePrevue !== null && ligne('Marge prévue (CA − budget)', fcfa(r.margePrevue), margeCls(r.margePrevue))}
          {ligne(
            'Marge réelle (CA − dépensé)',
            `${fcfa(r.margeReelle)}${r.tauxMargeReelle !== null ? ` · ${r.tauxMargeReelle.toFixed(1)} %` : ''}`,
            `font-semibold ${margeCls(r.margeReelle)}`
          )}
        </div>
        {r.budgets.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Budget{r.budgets.length > 1 ? 's' : ''} :{' '}
            {r.budgets.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ', '}
                <Link href={`/budget/demandes/${b.id}`} className="text-primary hover:underline">{b.numero}</Link>
              </span>
            ))}
          </p>
        )}
        {!r.coherent && (
          <p className="flex gap-1 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Écart entre les dépenses du budget et celles de la proforma : prévenez l&apos;administrateur.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
