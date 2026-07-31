'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { FournisseurModal } from '@/components/FournisseurModal';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { CalendarIcon, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface FactureFournisseurData {
  id: string;
  reference: string;
  montant: number | string;
  date: string | Date;
  fournisseurId: string;
  status: string;
  pieceJointe: string | null;
}

const emptyForm = {
  reference: '',
  montant: '',
  date: new Date(),
  fournisseurId: '',
  status: 'EN_ATTENTE',
};

interface FactureFournisseurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fournisseurs: Fournisseur[];
  onFournisseurCreated: (fournisseur: Fournisseur) => void;
  initialData?: FactureFournisseurData | null;
}

export function FactureFournisseurModal({
  isOpen,
  onClose,
  onSuccess,
  fournisseurs,
  onFournisseurCreated,
  initialData = null,
}: FactureFournisseurModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);

  const isEditing = !!initialData;
  const isLocked = isEditing && (initialData?.status === 'PAYEE' || initialData?.status === 'ANNULEE');
  const hasPieceJointe = isEditing && !!initialData?.pieceJointe;
  const lockedStatusLabel = initialData?.status === 'ANNULEE' ? 'annulée' : 'payée';

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        reference: initialData.reference,
        montant: String(initialData.montant),
        date: new Date(initialData.date),
        fournisseurId: initialData.fournisseurId,
        status: initialData.status,
      });
    } else {
      setFormData(emptyForm);
    }
    setFile(null);
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleFournisseurCreated = (newFournisseur: Fournisseur) => {
    onFournisseurCreated(newFournisseur);
    setFormData((prev) => ({ ...prev, fournisseurId: newFournisseur.id }));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      if (!file) {
        toast.error('Veuillez sélectionner un fichier à ajouter.');
        return;
      }
    } else if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur.');
      return;
    }

    setIsSubmitting(true);

    const data = new FormData();
    if (!isLocked) {
      data.append('reference', formData.reference);
      data.append('montant', formData.montant);
      data.append('date', formData.date.toISOString());
      data.append('fournisseurId', formData.fournisseurId);
      data.append('status', formData.status);
    }
    if (file) {
      data.append('pieceJointe', file);
    }

    try {
      const url = isEditing
        ? `/api/factures-fournisseurs/${initialData!.id}`
        : '/api/factures-fournisseurs';
      const response = await fetch(url, { method: isEditing ? 'PATCH' : 'POST', body: data });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Une erreur est survenue.');
      }

      toast.success(
        isEditing ? 'Facture fournisseur mise à jour avec succès !' : 'Facture fournisseur créée avec succès !',
      );
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedFournisseur = fournisseurs.find((f) => f.id === formData.fournisseurId);

  return (
    <>
      <FournisseurModal
        isOpen={isFournisseurModalOpen}
        onClose={() => setIsFournisseurModalOpen(false)}
        onSuccess={handleFournisseurCreated}
      />
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Modifier la facture fournisseur' : 'Ajouter une facture fournisseur'}
            </DialogTitle>
          </DialogHeader>

          {isLocked && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Cette facture est <strong>{lockedStatusLabel}</strong> et ne peut plus être modifiée.{' '}
                {hasPieceJointe
                  ? 'La pièce jointe est déjà présente.'
                  : "Vous pouvez uniquement ajouter la pièce jointe manquante."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label>Fournisseur *</label>
                {isLocked ? (
                  <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                    {selectedFournisseur?.entreprise ?? '—'}
                  </div>
                ) : (
                  <FournisseurCombobox
                    fournisseurs={fournisseurs}
                    value={formData.fournisseurId}
                    onChange={(id) => setFormData((prev) => ({ ...prev, fournisseurId: id }))}
                    onAddNew={() => setIsFournisseurModalOpen(true)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="reference">Référence de la facture *</label>
                <Input
                  id="reference"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  required
                  disabled={isLocked}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="montant">Montant (XOF) *</label>
                <Input
                  id="montant"
                  name="montant"
                  type="number"
                  value={formData.montant}
                  onChange={handleChange}
                  required
                  disabled={isLocked}
                />
              </div>
              <div className="space-y-2">
                <label>Date de la facture *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={'outline'}
                      className="w-full justify-start text-left font-normal"
                      disabled={isLocked}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, 'PPP') : <span>Choisir une date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => date && setFormData((prev) => ({ ...prev, date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label>Statut</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                  disabled={isLocked}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                    <SelectItem value="PAYEE">Payée</SelectItem>
                    <SelectItem value="ANNULEE">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="pieceJointe">Pièce jointe (PDF, Image)</label>
                {isLocked && hasPieceJointe ? (
                  <div className="flex items-center h-9">
                    <AttachmentPreviewButton url={initialData!.pieceJointe} title={`Facture ${initialData!.reference}`} />
                  </div>
                ) : (
                  <Input id="pieceJointe" type="file" onChange={handleFileChange} />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {isLocked && hasPieceJointe ? 'Fermer' : 'Annuler'}
              </Button>
              {!(isLocked && hasPieceJointe) && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Enregistrer la facture'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
