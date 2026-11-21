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

export interface BudgetDepassementDialogLigne {
  id: string;
  designation: string;
  plafond: number;
  consomme: number;
}

/** Demande d'augmentation du plafond d'une ligne — décidée ensuite par l'administrateur. */
export function BudgetDepassementDialog({
  demandeId,
  ligne,
  onClose,
  onSuccess,
}: {
  demandeId: string;
  ligne: BudgetDepassementDialogLigne | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMontant('');
    setMotif('');
  }, [ligne]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligne) return;
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return void toast.error('Indiquez le montant supplémentaire demandé.');
    if (motif.trim().length < 3) return void toast.error('Expliquez pourquoi ce dépassement est nécessaire.');

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/depassements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ligneId: ligne.id, montant: montantNum, motif: motif.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la demande de dépassement.');
      }
      toast.success("Demande de dépassement envoyée à l'administrateur.");
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
          <DialogTitle>Demander un dépassement</DialogTitle>
        </DialogHeader>
        {ligne && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{ligne.designation}</p>
              <p className="text-muted-foreground">
                Consommé {formatMontant(ligne.consomme)} sur un plafond de {formatMontant(ligne.plafond)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dep-montant-sup">Montant supplémentaire (XOF) *</Label>
              <Input id="dep-montant-sup" type="number" min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
              {Number(montant) > 0 && (
                <p className="text-xs text-muted-foreground">Nouveau plafond si approuvé : {formatMontant(ligne.plafond + Number(montant))}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dep-motif">Justification *</Label>
              <Textarea id="dep-motif" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Pourquoi le budget prévu ne suffit pas…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>{isSubmitting ? 'Envoi...' : 'Envoyer la demande'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
