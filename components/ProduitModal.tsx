'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Produit } from './ProduitCombobox';

interface ProduitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (produit: Produit) => void;
  initialData?: Produit | null;
}

export function ProduitModal({ isOpen, onClose, onSuccess, initialData }: ProduitModalProps) {
  const [nom, setNom] = useState('');
  const [prixUnitaire, setPrixUnitaire] = useState('');
  const [actif, setActif] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNom(initialData?.nom ?? '');
    setPrixUnitaire(initialData ? String(initialData.prixUnitaire) : '');
    setActif(initialData?.actif ?? true);
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/produits/${initialData.id}` : '/api/produits';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          prixUnitaire: Number(prixUnitaire),
          ...(initialData ? { actif } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Une erreur est survenue.');
      }
      const produit: Produit = await response.json();

      toast.success(initialData ? 'Produit mis à jour avec succès !' : 'Produit créé avec succès !');
      onSuccess(produit);
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Modifier le produit' : 'Ajouter un nouveau produit'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du produit</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prixUnitaire">Prix unitaire</Label>
            <Input
              id="prixUnitaire"
              type="number"
              step="0.01"
              min="0"
              value={prixUnitaire}
              onChange={(e) => setPrixUnitaire(e.target.value)}
              required
            />
          </div>
          {initialData && (
            <div className="flex items-center justify-between">
              <Label htmlFor="actif">Actif</Label>
              <div className="flex items-center gap-2">
                <Switch id="actif" checked={actif} onCheckedChange={setActif} />
                {!actif && <Badge variant="destructive" className="text-[10px]">Inactif</Badge>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
