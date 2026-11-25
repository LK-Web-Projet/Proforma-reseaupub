'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface MoyenPaiementFormData {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  ordre: number;
  caisses?: { id: number }[];
}

interface CaisseChoix {
  id: number;
  name: string;
  view: boolean;
}

/**
 * Création ou modification d'un moyen de paiement : nom, description, ordre d'affichage et caisses
 * liées. Au paiement, seules les caisses visibles liées au moyen choisi sont proposées ; sans caisse
 * liée, le moyen ne permet aucun paiement.
 */
export function MoyenPaiementDialog({
  open,
  moyen,
  onClose,
  onSuccess,
}: {
  open: boolean;
  /** null = création. */
  moyen: MoyenPaiementFormData | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [ordre, setOrdre] = useState('');
  const [caisseIds, setCaisseIds] = useState<Set<number>>(new Set());
  const [caisses, setCaisses] = useState<CaisseChoix[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNom(moyen?.nom ?? '');
    setDescription(moyen?.description ?? '');
    setOrdre(moyen ? String(moyen.ordre) : '');
    setCaisseIds(new Set((moyen?.caisses ?? []).map((c) => c.id)));
    fetch('/api/cash-registers')
      .then((res) => (res.ok ? res.json() : []))
      .then((liste: CaisseChoix[]) => setCaisses([...liste].sort((a, b) => Number(b.view) - Number(a.view) || a.name.localeCompare(b.name, 'fr'))))
      .catch(() => setCaisses([]));
  }, [open, moyen]);

  const basculer = (id: number) =>
    setCaisseIds((actuelles) => {
      const suivantes = new Set(actuelles);
      if (suivantes.has(id)) suivantes.delete(id);
      else suivantes.add(id);
      return suivantes;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim().length < 2) return void toast.error('Le nom du moyen de paiement est requis.');
    setIsSubmitting(true);
    try {
      const res = await fetch(moyen ? `/api/moyens-paiement/${moyen.id}` : '/api/moyens-paiement', {
        method: moyen ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, description, ordre: ordre === '' ? 0 : Number(ordre), caisseIds: [...caisseIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : "Erreur lors de l'enregistrement.");
      toast.success(moyen ? 'Moyen de paiement modifié.' : 'Moyen de paiement créé.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nbVisiblesCochees = caisses.filter((c) => c.view && caisseIds.has(c.id)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{moyen ? `Modifier « ${moyen.nom} »` : 'Nouveau moyen de paiement'}</DialogTitle>
          <DialogDescription>
            Au moment de payer, seules les caisses visibles cochées ici seront proposées pour ce moyen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mp-nom">Nom *</Label>
              <Input id="mp-nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} placeholder="Ex. : Wave, Orange Money…" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-ordre">Ordre</Label>
              <Input id="mp-ordre" type="number" min={0} max={999} value={ordre} onChange={(e) => setOrdre(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-desc">Description (facultatif)</Label>
            <Textarea id="mp-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Caisses liées</Label>
            {caisses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune caisse.</p>
            ) : (
              <ul className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {caisses.map((c) => (
                  <li key={c.id}>
                    <label className={cn('flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50', !c.view && 'text-muted-foreground')}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-indigo-600"
                        checked={caisseIds.has(c.id)}
                        onChange={() => basculer(c.id)}
                      />
                      <span className="min-w-0 break-words">{c.name}</span>
                      {!c.view && <span className="ml-auto shrink-0 text-xs">masquée : jamais proposée</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {nbVisiblesCochees === 0 && (
              <p className="text-xs text-amber-700">Sans caisse visible cochée, ce moyen ne permettra aucun paiement.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
