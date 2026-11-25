'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Pencil, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoyenPaiementDialog, type MoyenPaiementFormData } from '@/components/moyensPaiement/MoyenPaiementDialog';
import { useDroits } from '@/components/DroitsProvider';
import { useActionEnCours } from '@/lib/useActionEnCours';
import { oublierMoyensPaiement } from '@/lib/useMoyensPaiement';
import type { MoyenPaiementOption } from '@/lib/moyensPaiement';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MoyenListe extends MoyenPaiementOption {
  nbLignesBudget: number;
  nbDepenses: number;
}

/** Finance → Moyens de paiement : liste, création, modification (caisses liées), activation. */
export default function MoyensPaiementPage() {
  const { peut } = useDroits();
  const { enCours, lancer } = useActionEnCours();
  const [moyens, setMoyens] = useState<MoyenListe[]>([]);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState<{ open: boolean; moyen: MoyenPaiementFormData | null }>({ open: false, moyen: null });

  const charger = useCallback(async () => {
    oublierMoyensPaiement();
    try {
      const res = await fetch('/api/moyens-paiement');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Impossible de charger les moyens de paiement.');
      setMoyens(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les moyens de paiement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const basculerActif = (m: MoyenListe) =>
    lancer(m.id, async () => {
      const res = await fetch(`/api/moyens-paiement/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !m.actif }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(typeof data.error === 'string' ? data.error : 'Erreur.');
      toast.success(m.actif ? `${m.nom} désactivé : il n'est plus proposé.` : `${m.nom} réactivé.`);
      await charger();
    });

  const sansCaisse = moyens.filter((m) => m.actif && !(m.caisses ?? []).some((c) => c.view));

  return (
    <div className="max-w-6xl mx-auto">
      <MoyenPaiementDialog
        open={edition.open}
        moyen={edition.moyen}
        onClose={() => setEdition({ open: false, moyen: null })}
        onSuccess={charger}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-700" /> Moyens de paiement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Au moment de payer, on choisit le moyen ; seules les caisses visibles liées à ce moyen sont alors proposées.
          </p>
        </div>
        {peut('finance.moyenCreer') && (
          <Button onClick={() => setEdition({ open: true, moyen: null })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nouveau moyen
          </Button>
        )}
      </div>

      {!loading && sansCaisse.length > 0 && (
        <div className="mb-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {sansCaisse.length === 1 ? 'Ce moyen n’a' : 'Ces moyens n’ont'} aucune caisse visible liée, donc aucun paiement possible avec{' '}
            {sansCaisse.length === 1 ? 'lui' : 'eux'} : <strong>{sansCaisse.map((m) => m.nom).join(', ')}</strong>. Cliquez sur « Modifier » pour cocher ses caisses.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Moyen</TableHead>
              <TableHead>Caisses liées</TableHead>
              <TableHead className="text-center">Utilisé sur</TableHead>
              <TableHead className="text-center">Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Chargement…</TableCell>
              </TableRow>
            ) : moyens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun moyen de paiement.</TableCell>
              </TableRow>
            ) : (
              moyens.map((m) => {
                const caisses = m.caisses ?? [];
                return (
                  <TableRow key={m.id} className={cn(!m.actif && 'opacity-60')}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{m.nom}</p>
                      {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 max-w-sm">{m.description}</p>}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {caisses.length === 0 ? (
                        <span className="text-xs text-amber-700">Aucune : paiement impossible</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {caisses.map((c) => (
                            <Badge
                              key={c.id}
                              variant="outline"
                              className={cn('font-normal whitespace-normal text-left', !c.view && 'text-muted-foreground line-through')}
                              title={c.view ? undefined : 'Caisse masquée : jamais proposée'}
                            >
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                      {m.nbLignesBudget} ligne{m.nbLignesBudget > 1 ? 's' : ''} · {m.nbDepenses} dépense{m.nbDepenses > 1 ? 's' : ''}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={m.actif}
                        disabled={!peut('finance.moyenActiver') || enCours(m.id)}
                        onCheckedChange={() => basculerActif(m)}
                        aria-label={m.actif ? `Désactiver ${m.nom}` : `Réactiver ${m.nom}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {peut('finance.moyenModifier') && (
                        <Button variant="outline" size="sm" onClick={() => setEdition({ open: true, moyen: m })}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
