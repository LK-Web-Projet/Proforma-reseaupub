'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

export interface BudgetAnnulationCible {
  id: string;
  designation: string;
  montant: number;
  caisse: string;
}

/** Annulation d'une dépense par contre-écriture de caisse (administrateur uniquement). */
export function BudgetAnnulationDialog({
  demandeId,
  depense,
  onClose,
  onSuccess,
}: {
  demandeId: string;
  depense: BudgetAnnulationCible | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => setMotif(''), [depense]);

  const handleConfirm = async () => {
    if (!depense) return;
    if (motif.trim().length < 3) return void toast.error("Indiquez le motif de l'annulation.");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/depenses/${depense.id}/annuler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: motif.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : "Erreur lors de l'annulation.");
      }
      toast.success('Dépense annulée — contre-écriture passée au journal de caisse.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!depense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la dépense ?</DialogTitle>
        </DialogHeader>
        {depense && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {depense.designation} — <strong>{formatMontant(depense.montant)}</strong>. Une recette de ce montant sera passée
              dans la caisse « {depense.caisse} » pour compenser la dépense. L&apos;écriture d&apos;origine reste visible au journal,
              et la dépense sort du consommé de la ligne.
            </p>
            <Textarea rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif de l'annulation *" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Retour</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting || motif.trim().length < 3}>
            {isSubmitting ? 'Annulation...' : "Confirmer l'annulation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
