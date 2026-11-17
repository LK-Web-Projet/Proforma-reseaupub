'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { History } from 'lucide-react';

export interface BudgetHistoriqueEntry {
  id: string;
  action: string;
  details: string | null;
  montant: number | null;
  auteurEmail: string;
  auteurNom: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; dot: string }> = {
  CREATION: { label: 'Demande soumise', dot: 'bg-slate-400' },
  RESOUMISSION: { label: 'Demande modifiée et resoumise', dot: 'bg-slate-400' },
  VALIDATION: { label: 'Budget validé', dot: 'bg-green-500' },
  REJET: { label: 'Demande rejetée', dot: 'bg-red-500' },
  DEPENSE: { label: 'Dépense enregistrée', dot: 'bg-indigo-500' },
  ANNULATION_DEPENSE: { label: 'Dépense annulée', dot: 'bg-red-500' },
  JUSTIFICATIF: { label: 'Justificatif ajouté', dot: 'bg-green-500' },
  DOCUMENTS: { label: 'Documents ajoutés', dot: 'bg-slate-400' },
  DEPASSEMENT_DEMANDE: { label: 'Dépassement demandé', dot: 'bg-orange-500' },
  DEPASSEMENT_APPROUVE: { label: 'Dépassement approuvé', dot: 'bg-green-500' },
  DEPASSEMENT_REJETE: { label: 'Dépassement refusé', dot: 'bg-red-500' },
  CLOTURE: { label: 'Budget clôturé', dot: 'bg-slate-700' },
  PAIEMENT_ANCIEN_CIRCUIT: { label: 'Marquée payée (ancien circuit)', dot: 'bg-green-500' },
};

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

const VISIBLE_PAR_DEFAUT = 8;

/** Journal d'audit du budget (du plus récent au plus ancien) : qui a fait quoi, quand. */
export function BudgetHistoriqueCard({ historique }: { historique: BudgetHistoriqueEntry[] }) {
  const [toutAfficher, setToutAfficher] = useState(false);
  if (historique.length === 0) return null;
  const visibles = toutAfficher ? historique : historique.slice(0, VISIBLE_PAR_DEFAUT);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
          <History className="h-4 w-4" />
          Historique
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative border-l border-muted ml-2 space-y-4">
          {visibles.map((h) => {
            const meta = ACTION_META[h.action] ?? { label: h.action, dot: 'bg-slate-400' };
            return (
              <li key={h.id} className="ml-4 relative">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full', meta.dot)} />
                <p className="text-sm font-medium">
                  {meta.label}
                  {h.montant !== null && <span className="font-normal text-muted-foreground"> — {formatMontant(Number(h.montant))}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.auteurNom || h.auteurEmail} · {format(new Date(h.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
                {h.details && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{h.details}</p>}
              </li>
            );
          })}
        </ol>
        {historique.length > VISIBLE_PAR_DEFAUT && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setToutAfficher((v) => !v)}>
            {toutAfficher ? 'Réduire' : `Afficher tout (${historique.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
