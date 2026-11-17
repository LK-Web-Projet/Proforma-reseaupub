'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

export interface BudgetLigneDecisionCible {
  id: string;
  designation: string;
  montant: number; // demandé
  mode: 'AJUSTER' | 'CORRIGER';
}

/**
 * Décision du valideur sur une ligne (validation ligne par ligne) :
 *  - AJUSTER : accorder un montant inférieur au demandé, avec motif ;
 *  - CORRIGER : renvoyer la ligne au demandeur avec un motif (il la modifiera ou la retirera).
 * « Accorder » au montant demandé se fait directement depuis la fiche, sans ce dialogue.
 */
export function BudgetLigneDecisionDialog({
  demandeId,
  ligne,
  onClose,
  onSuccess,
}: {
  demandeId: string;
  ligne: BudgetLigneDecisionCible | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMontant(ligne ? String(ligne.montant) : '');
    setMotif('');
  }, [ligne]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligne) return;
    if (!motif.trim()) return void toast.error(ligne.mode === 'CORRIGER' ? 'Expliquez ce qui doit être corrigé.' : 'Indiquez le motif de la réduction.');
    const body: Record<string, unknown> = { decision: ligne.mode === 'CORRIGER' ? 'CORRIGER' : 'ACCORDER', motif: motif.trim() };
    if (ligne.mode === 'AJUSTER') {
      const m = Number(montant);
      if (!m || m <= 0) return void toast.error('Indiquez le montant accordé.');
      if (m > ligne.montant) return void toast.error('On ne peut pas accorder plus que le montant demandé.');
      body.montantAccorde = m;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/lignes/${ligne.id}/decider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la décision.');
      }
      toast.success(ligne.mode === 'CORRIGER' ? 'Ligne renvoyée au demandeur pour correction.' : 'Ligne accordée au montant ajusté.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!ligne} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ligne?.mode === 'CORRIGER' ? 'Demander une correction' : 'Accorder un montant ajusté'}</DialogTitle>
        </DialogHeader>
        {ligne && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{ligne.designation}</p>
              <p className="text-muted-foreground">Montant demandé : {formatMontant(ligne.montant)}</p>
            </div>
            {ligne.mode === 'AJUSTER' && (
              <div className="space-y-2">
                <Label htmlFor="montant-accorde">Montant accordé (XOF) *</Label>
                <Input id="montant-accorde" type="number" min={0} max={ligne.montant} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
                <p className="text-xs text-muted-foreground">Au-delà du montant demandé, il faudra passer par un dépassement.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="motif-decision">{ligne.mode === 'CORRIGER' ? 'Ce que le demandeur doit corriger *' : 'Motif de la réduction *'}</Label>
              <Textarea
                id="motif-decision"
                rows={3}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={ligne.mode === 'CORRIGER' ? 'Ex. : joindre un devis, revoir la quantité…' : 'Ex. : 7 000 suffisent pour ce mois'}
              />
              {ligne.mode === 'CORRIGER' && (
                <p className="text-xs text-muted-foreground">
                  Le demandeur pourra modifier la ligne (elle repartira en validation) ou la retirer du budget. Ce message ouvre aussi le fil de commentaires de la ligne.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting} className={ligne.mode === 'CORRIGER' ? 'bg-amber-600 hover:bg-amber-700' : ''}>
                {isSubmitting ? 'Envoi...' : ligne.mode === 'CORRIGER' ? 'Renvoyer pour correction' : 'Accorder ce montant'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
