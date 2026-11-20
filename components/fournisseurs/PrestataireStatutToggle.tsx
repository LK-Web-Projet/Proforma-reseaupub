'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDroits } from '@/components/DroitsProvider';

const MOTIF_OPTIONS_ACTIF = ['Nouveau contrat signé', 'Reconduction de contrat', 'Repris après une interruption'];
const MOTIF_OPTIONS_INACTIF = ['Fin de contrat', 'Résiliation de contrat', 'Remplacé par un autre prestataire'];

interface PrestataireStatutToggleProps {
  fournisseurId: string;
  entreprise: string;
  actif: boolean;
  onSuccess: () => void;
}

export function PrestataireStatutToggle({ fournisseurId, entreprise, actif, onSuccess }: PrestataireStatutToggleProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingActif, setPendingActif] = useState(actif);
  const [motifOption, setMotifOption] = useState('');
  const [motifCustom, setMotifCustom] = useState('');
  const [dateContrat, setDateContrat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { peut } = useDroits();

  const motifOptions = pendingActif ? MOTIF_OPTIONS_ACTIF : MOTIF_OPTIONS_INACTIF;
  const isOtherMotif = motifOption === 'Autre';

  const openDialog = (checked: boolean) => {
    setPendingActif(checked);
    setMotifOption('');
    setMotifCustom('');
    setDateContrat(new Date().toISOString().slice(0, 10));
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!dateContrat) {
      toast.error('La date du changement est requise.');
      return;
    }
    const motif = isOtherMotif ? motifCustom.trim() : motifOption;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/fournisseurs/${fournisseurId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: pendingActif, motif: motif || null, dateContrat }),
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

  // Sans le droit « Activer / désactiver », seul le badge de statut reste affiché.
  if (!peut('fournisseurs.activer')) return null;

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
          <div className="space-y-2">
            <label htmlFor="dateContrat" className="text-sm font-medium">Date du changement *</label>
            <Input
              id="dateContrat"
              type="date"
              value={dateContrat}
              onChange={(e) => setDateContrat(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="motif" className="text-sm font-medium">Motif (optionnel)</label>
            <Select value={motifOption} onValueChange={setMotifOption}>
              <SelectTrigger id="motif">
                <SelectValue placeholder="Sélectionner un motif" />
              </SelectTrigger>
              <SelectContent>
                {motifOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isOtherMotif && (
            <Textarea
              value={motifCustom}
              onChange={(e) => setMotifCustom(e.target.value)}
              placeholder="Précisez le motif"
            />
          )}
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
