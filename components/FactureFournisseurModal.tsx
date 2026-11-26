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
import { exigeBonDeCommande } from '@/lib/typeFournisseur';

export interface FactureFournisseurData {
  id: string;
  reference: string;
  montant: number | string;
  date: string | Date;
  fournisseurId: string;
  status: string;
  pieceJointe: string | null;
  commandeId?: string | null;
}

const emptyForm = {
  reference: '',
  montant: '',
  date: new Date(),
  fournisseurId: '',
  status: 'EN_ATTENTE',
  commandeId: '',
  ligneBudgetId: '',
};

interface LigneBudgetOption {
  id: string;
  label: string;
}

interface CommandeOption {
  id: string;
  numero: string;
  statut: string;
  montantNet: number | string;
}

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
  // Bons de commande du prestataire choisi : toute nouvelle facture répond à l'un d'eux.
  const [commandes, setCommandes] = useState<CommandeOption[]>([]);
  // Prestataire interne / externe : lignes des budgets ouverts (ex. budget mensuel de la comptabilité).
  const [lignesBudget, setLignesBudget] = useState<LigneBudgetOption[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/demandes-budget')
      .then((res) => (res.ok ? res.json() : []))
      .then((demandes: { numero: string; statut: string; type: string; departement: string | null; lignes: { id: string; designation: string; statutValidation: string; departement?: { nom: string } | null }[] }[]) =>
        setLignesBudget(
          demandes
            .filter((d) => ['VALIDATION_PARTIELLE', 'VALIDEE', 'EN_COURS'].includes(d.statut))
            .flatMap((d) =>
              d.lignes
                .filter((l) => l.statutValidation === 'ACCORDEE')
                .map((l) => ({ id: l.id, label: `${d.numero}${(l.departement?.nom ?? d.departement) ? ` (${l.departement?.nom ?? d.departement})` : ''} — ${l.designation}` }))
            )
        )
      )
      .catch(() => setLignesBudget([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !formData.fournisseurId) {
      setCommandes([]);
      return;
    }
    fetch(`/api/fournisseurs/commandes?fournisseurId=${formData.fournisseurId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((liste: CommandeOption[]) => setCommandes(liste.filter((c) => c.statut !== 'ANNULEE' && c.statut !== 'BROUILLON')))
      .catch(() => setCommandes([]));
  }, [isOpen, formData.fournisseurId]);

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
        commandeId: initialData.commandeId ?? '',
        ligneBudgetId: '',
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
      toast.error('Veuillez sélectionner un prestataire.');
      return;
    } else if (!isEditing && !formData.commandeId && exigeBonDeCommande(fournisseurs.find((f) => f.id === formData.fournisseurId)?.typeFournisseur)) {
      toast.error('Ce prestataire est un fournisseur : choisissez le bon de commande auquel répond cette facture.');
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
      if (formData.commandeId) data.append('commandeId', formData.commandeId);
      else if (formData.ligneBudgetId) data.append('ligneBudgetId', formData.ligneBudgetId);
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
        isEditing ? 'Facture prestataire mise à jour avec succès !' : 'Facture prestataire créée avec succès !',
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
              {isEditing ? 'Modifier la facture prestataire' : 'Ajouter une facture prestataire'}
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
                <label>Prestataire *</label>
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
              {!isEditing && (
                <div className="space-y-2 md:col-span-2">
                  <label>Bon de commande{exigeBonDeCommande(selectedFournisseur?.typeFournisseur) ? ' *' : ' (facultatif)'}</label>
                  <Select
                    value={formData.commandeId || '__AUCUN__'}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, commandeId: v === '__AUCUN__' ? '' : v, ligneBudgetId: v === '__AUCUN__' ? prev.ligneBudgetId : '' }))}
                    disabled={!formData.fournisseurId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!formData.fournisseurId ? "Choisissez d'abord le prestataire" : commandes.length ? 'Choisir le bon de commande' : 'Aucun bon de commande validé pour ce prestataire'} />
                    </SelectTrigger>
                    <SelectContent>
                      {!exigeBonDeCommande(selectedFournisseur?.typeFournisseur) && <SelectItem value="__AUCUN__">Aucun bon de commande</SelectItem>}
                      {commandes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero} — {new Intl.NumberFormat('fr-FR').format(Number(c.montantNet))} F
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {exigeBonDeCommande(selectedFournisseur?.typeFournisseur) ? (
                    <p className="text-xs text-muted-foreground">Fournisseur : la facture passera « payée » au paiement du solde de ce bon.</p>
                  ) : (
                    !formData.commandeId && (
                      <div className="space-y-2 pt-1">
                        <label>Ligne de budget (facultatif)</label>
                        <Select value={formData.ligneBudgetId || '__AUCUNE__'} onValueChange={(v) => setFormData((prev) => ({ ...prev, ligneBudgetId: v === '__AUCUNE__' ? '' : v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__AUCUNE__">Aucune (paiement par la caisse seule)</SelectItem>
                            {lignesBudget.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Prestataire interne / externe : choisissez la ligne du budget qui paie cette facture (ex. budget mensuel de la comptabilité pour la paie). Au paiement, l&apos;argent sort de la caisse et est retiré de cette ligne. Sans ligne, le paiement sort seulement de la caisse, sans toucher un budget.
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
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
                {/* En modification, le statut se change depuis le menu de statut de la liste (droits,
                    preuve du paiement, historique). */}
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                  disabled={isLocked || isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                    {/* « Payée » : uniquement par le paiement du solde depuis le budget. */}
                    <SelectItem value="PAYEE" disabled>Payée</SelectItem>
                    <SelectItem value="ANNULEE">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                {isEditing && !isLocked && (
                  <p className="text-xs text-muted-foreground">Pour changer le statut, utilisez le menu de statut dans la liste.</p>
                )}
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
                <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
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
