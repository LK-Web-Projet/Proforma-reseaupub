'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { couleurActionProforma, libelleActionProforma } from '@/lib/proformaHistorique';
import { cn } from '@/lib/utils';

interface EntreeHistorique {
  id: string;
  action: string;
  details: string | null;
  donnees: { reprise?: boolean } | null;
  auteurEmail: string | null;
  auteurNom: string | null;
  createdAt: string;
}

const NB_VISIBLES = 8;

/**
 * Historique de la proforma : toutes les actions la concernant, de la plus récente à la plus
 * ancienne. `version` : à changer pour recharger (après une action sur la page).
 */
export function HistoriqueProformaCard({ invoiceId, version }: { invoiceId: string; version: number }) {
  const [entrees, setEntrees] = useState<EntreeHistorique[] | null>(null);
  const [toutVoir, setToutVoir] = useState(false);

  useEffect(() => {
    let actif = true;
    fetch(`/api/factures/${invoiceId}/historique`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => actif && setEntrees(Array.isArray(d) ? d : []))
      .catch(() => actif && setEntrees([]));
    return () => {
      actif = false;
    };
  }, [invoiceId, version]);

  const visibles = entrees ? (toutVoir ? entrees : entrees.slice(0, NB_VISIBLES)) : [];

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-slate-500">
          <History className="w-4 h-4 text-indigo-500" /> Historique de la proforma
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {entrees === null ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : entrees.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune action enregistrée.</p>
        ) : (
          <>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {visibles.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-400" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', couleurActionProforma(h.action))}>
                      {libelleActionProforma(h.action)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(h.createdAt), 'dd/MM/yyyy HH:mm')}
                      {h.auteurNom || h.auteurEmail ? ` · ${h.auteurNom ?? h.auteurEmail}` : ''}
                      {h.donnees?.reprise ? ' · repris de l’existant' : ''}
                    </span>
                  </div>
                  {h.details && <p className="mt-0.5 text-xs text-slate-700 break-words">{h.details}</p>}
                </li>
              ))}
            </ol>
            {entrees.length > NB_VISIBLES && (
              <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs" onClick={() => setToutVoir((v) => !v)}>
                {toutVoir ? 'Voir moins' : `Voir tout l'historique (${entrees.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
