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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { FournisseurModal } from '@/components/FournisseurModal';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProduitFournisseur } from '@prisma/client';

interface LigneCommande {
  produitFournisseurId: string;
  designation: string;
  quantite: number;
  largeur?: number;
  hauteur?: number;
  prixUnitaire: number;
  typeUnite: string;
}

interface CommandeFournisseurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fournisseurs: Fournisseur[];
  onFournisseurCreated: (fournisseur: Fournisseur) => void;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export function CommandeFournisseurModal({
  isOpen,
  onClose,
  onSuccess,
  fournisseurs,
  onFournisseurCreated,
}: CommandeFournisseurModalProps) {
  const [fournisseurId, setFournisseurId] = useState('');
  const [dateCommande, setDateCommande] = useState(new Date().toISOString().split('T')[0]);
  const [produits, setProduits] = useState<ProduitFournisseur[]>([]);
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFournisseurId('');
    setDateCommande(new Date().toISOString().split('T')[0]);
    setProduits([]);
    setLignes([]);
  }, [isOpen]);

  useEffect(() => {
    if (!fournisseurId) {
      setProduits([]);
      return;
    }
    fetch(`/api/fournisseurs/produits?fournisseurId=${fournisseurId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setProduits)
      .catch(() => setProduits([]));
  }, [fournisseurId]);

  const handleFournisseurCreated = (newFournisseur: Fournisseur) => {
    onFournisseurCreated(newFournisseur);
    setFournisseurId(newFournisseur.id);
  };

  const addLigne = () => {
    setLignes((prev) => [
      ...prev,
      { produitFournisseurId: '', designation: '', quantite: 1, prixUnitaire: 0, typeUnite: 'UNITE' },
    ]);
  };

  const removeLigne = (index: number) => {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLigne = (index: number, field: keyof LigneCommande, value: string) => {
    setLignes((prev) => {
      const newLignes = [...prev];
      const ligne = { ...newLignes[index] };

      if (field === 'produitFournisseurId') {
        const prod = produits.find((p) => p.id === value);
        if (prod) {
          ligne.produitFournisseurId = prod.id;
          ligne.designation = prod.designation;
          ligne.prixUnitaire = Number(prod.prixUnitaire);
          ligne.typeUnite = prod.typeUnite;
        }
      } else if (field === 'quantite' || field === 'largeur' || field === 'hauteur' || field === 'prixUnitaire') {
        (ligne[field] as number | undefined) = value === '' ? undefined : Number(value);
      }

      newLignes[index] = ligne;
      return newLignes;
    });
  };

  const calculateTotalLigne = (ligne: LigneCommande) => {
    const qte = Number(ligne.quantite) || 0;
    const pu = Number(ligne.prixUnitaire) || 0;
    if (ligne.typeUnite === 'METRE_CARRE' && ligne.largeur && ligne.hauteur) {
      return Number(ligne.largeur) * Number(ligne.hauteur) * qte * pu;
    }
    return qte * pu;
  };

  const totalGeneral = lignes.reduce((acc, l) => acc + calculateTotalLigne(l), 0);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur.');
      return;
    }

    const lignesValides = lignes.filter((l) => l.produitFournisseurId);
    if (lignesValides.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne de produit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fournisseurId,
        dateCommande: new Date(dateCommande).toISOString(),
        lignes: lignesValides.map((l) => ({
          produitFournisseurId: l.produitFournisseurId,
          quantite: Number(l.quantite),
          largeur: l.largeur ? Number(l.largeur) : undefined,
          hauteur: l.hauteur ? Number(l.hauteur) : undefined,
          prixUnitaire: Number(l.prixUnitaire),
        })),
      };

      const res = await fetch('/api/fournisseurs/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur lors de la création du bon de commande.');
      }

      toast.success('Bon de commande créé avec succès !');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FournisseurModal
        isOpen={isFournisseurModalOpen}
        onClose={() => setIsFournisseurModalOpen(false)}
        onSuccess={handleFournisseurCreated}
      />
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau Bon de Commande Fournisseur</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label>Fournisseur *</label>
                <FournisseurCombobox
                  fournisseurs={fournisseurs}
                  value={fournisseurId}
                  onChange={setFournisseurId}
                  onAddNew={() => setIsFournisseurModalOpen(true)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dateCommande">Date de commande *</label>
                <Input
                  id="dateCommande"
                  type="date"
                  value={dateCommande}
                  onChange={(e) => setDateCommande(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label>Produits *</label>
                <Button type="button" variant="outline" size="sm" onClick={addLigne} disabled={!fournisseurId}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
                </Button>
              </div>

              {!fournisseurId ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  Sélectionnez d&apos;abord un fournisseur pour choisir ses produits.
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Produit</TableHead>
                        <TableHead className="w-[15%]">Dimensions (m)</TableHead>
                        <TableHead className="w-[10%]">Qté</TableHead>
                        <TableHead className="w-[15%]">P.U.</TableHead>
                        <TableHead className="w-[15%] text-right">Total</TableHead>
                        <TableHead className="w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">
                            Aucune ligne. Cliquez sur &quot;Ajouter une ligne&quot;.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lignes.map((ligne, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Select
                                value={ligne.produitFournisseurId}
                                onValueChange={(val) => updateLigne(index, 'produitFournisseurId', val)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un produit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {produits.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.designation}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {ligne.typeUnite === 'METRE_CARRE' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    placeholder="L"
                                    type="number"
                                    step="0.01"
                                    value={ligne.largeur ?? ''}
                                    onChange={(e) => updateLigne(index, 'largeur', e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                  <span>x</span>
                                  <Input
                                    placeholder="H"
                                    type="number"
                                    step="0.01"
                                    value={ligne.hauteur ?? ''}
                                    onChange={(e) => updateLigne(index, 'hauteur', e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={ligne.quantite}
                                onChange={(e) => updateLigne(index, 'quantite', e.target.value)}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={ligne.prixUnitaire}
                                onChange={(e) => updateLigne(index, 'prixUnitaire', e.target.value)}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">
                              {formatMontant(calculateTotalLigne(ligne))}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLigne(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <div className="text-lg font-bold">
                Total H.T. : {formatMontant(totalGeneral)}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Création...' : 'Créer le bon de commande'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
