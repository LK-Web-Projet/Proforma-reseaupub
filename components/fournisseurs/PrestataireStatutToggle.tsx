'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface PrestataireStatutToggleProps {
  fournisseurId: string;
  entreprise: string;
  actif: boolean;
  onSuccess: () => void;
}

export function PrestataireStatutToggle({ fournisseurId, entreprise, actif, onSuccess }: PrestataireStatutToggleProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingActif, setPendingActif] = useState(actif);
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openDialog = (checked: boolean) => {
    setPendingActif(checked);
    setMotif('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/fournisseurs/${fournisseurId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: pendingActif, motif: motif.trim() || null }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erreur lors de la mise à jour du statut.');
      }

      toast.success(pendingActif ? 'Prestataire marqué comme actif.' : 'Prestataire marqué comme inactif.');
      setDialogOpen(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Switch checked={actif} onCheckedChange={openDialog} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingActif ? `Marquer « ${entreprise} » comme actif ?` : `Marquer « ${entreprise} » comme inactif ?`}
            </DialogTitle>
            <DialogDescription>
              {pendingActif
                ? 'Ce prestataire sera à nouveau considéré comme actif. Vous pouvez préciser un motif (optionnel).'
                : "Ce prestataire n'apparaîtra plus comme actif. Vous pouvez préciser un motif (optionnel)."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={pendingActif ? 'Ex : repris en janvier, nouveau contrat signé…' : 'Ex : contrat terminé, remplacé par un autre prestataire…'}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              variant={pendingActif ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              {pendingActif ? 'Marquer comme actif' : 'Marquer comme inactif'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
