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
import { InvoiceMultiCombobox, InvoiceOption } from '@/components/InvoiceMultiCombobox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProduitFournisseur } from '@prisma/client';

const STATUTS_PROFORMA_ASSOCIABLES = ['Valider', 'Payer', 'Solde'];

interface LigneCommande {
  produitFournisseurId: string;
  designation: string;
  quantite: number;
  largeur?: number;
  hauteur?: number;
  prixUnitaire: number;
  typeUnite: string;
}

export interface CommandeToEdit {
  id: string;
  numero: string;
  dateCommande: string;
  appliquerTva: boolean;
  appliquerAib: boolean;
  fournisseur: { id: string; entreprise: string };
  lignes: {
    quantite: number;
    largeur: number | null;
    hauteur: number | null;
    prixUnitaire: number;
    produitFournisseur: { id: string; designation: string; typeUnite: string };
  }[];
  proformas: { invoice: { id: string } }[];
}

interface EditCommandeFournisseurModalProps {
  commande: CommandeToEdit | null;
  onClose: () => void;
  onSuccess: () => void;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

const TAUX_TVA = 0.18;
const TAUX_AIB = 0.03;

export function EditCommandeFournisseurModal({ commande, onClose, onSuccess }: EditCommandeFournisseurModalProps) {
  const [dateCommande, setDateCommande] = useState('');
  const [produits, setProduits] = useState<ProduitFournisseur[]>([]);
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [appliquerTva, setAppliquerTva] = useState(false);
  const [appliquerAib, setAppliquerAib] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [proformaIds, setProformaIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!commande) return;

    setDateCommande(new Date(commande.dateCommande).toISOString().split('T')[0]);
    setAppliquerTva(commande.appliquerTva);
    setAppliquerAib(commande.appliquerAib);
    setProformaIds(commande.proformas.map((p) => p.invoice.id));
    setLignes(
      commande.lignes.map((l) => ({
        produitFournisseurId: l.produitFournisseur.id,
        designation: l.produitFournisseur.designation,
        quantite: l.quantite,
        largeur: l.largeur ?? undefined,
        hauteur: l.hauteur ?? undefined,
        prixUnitaire: Number(l.prixUnitaire),
        typeUnite: l.produitFournisseur.typeUnite,
      }))
    );

    fetch(`/api/fournisseurs/produits?fournisseurId=${commande.fournisseur.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setProduits)
      .catch(() => setProduits([]));

    fetch('/api/factures')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: (InvoiceOption & { statut: string })[]) =>
        setInvoices(data.filter((inv) => STATUTS_PROFORMA_ASSOCIABLES.includes(inv.statut)))
      )
      .catch(() => setInvoices([]));
  }, [commande]);

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

  const calculateSurface = (ligne: LigneCommande) => {
    if (ligne.typeUnite !== 'METRE_CARRE' || !ligne.largeur || !ligne.hauteur) return null;
    return (Number(ligne.largeur) * Number(ligne.hauteur)) / 10000;
  };

  const calculateTotalLigne = (ligne: LigneCommande) => {
    const qte = Number(ligne.quantite) || 0;
    const pu = Number(ligne.prixUnitaire) || 0;
    const surfaceM2 = calculateSurface(ligne);
    if (surfaceM2 !== null) {
      return surfaceM2 * qte * pu;
    }
    return qte * pu;
  };

  const totalGeneral = lignes.reduce((acc, l) => acc + calculateTotalLigne(l), 0);
  const montantTva = appliquerTva ? totalGeneral * TAUX_TVA : 0;
  const totalTTC = totalGeneral + montantTva;
  const montantAib = appliquerAib ? totalGeneral * TAUX_AIB : 0;
  const montantNet = totalTTC - montantAib;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commande) return;

    const lignesValides = lignes.filter((l) => l.produitFournisseurId);
    if (lignesValides.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne de produit.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        dateCommande: new Date(dateCommande).toISOString(),
        lignes: lignesValides.map((l) => ({
          produitFournisseurId: l.produitFournisseurId,
          quantite: Number(l.quantite),
          largeur: l.largeur ? Number(l.largeur) : undefined,
          hauteur: l.hauteur ? Number(l.hauteur) : undefined,
          prixUnitaire: Number(l.prixUnitaire),
        })),
        appliquerTva,
        appliquerAib,
        proformaIds,
      };

      const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur lors de la modification du bon de commande.');
      }

      toast.success('Bon de commande modifié avec succès !');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!commande} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le Bon de Commande {commande?.numero}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label>Prestataire</label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {commande?.fournisseur.entreprise}
              </div>
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
            <label>Proforma(s) associée(s)</label>
            <InvoiceMultiCombobox invoices={invoices} value={proformaIds} onChange={setProformaIds} />
            <p className="text-[11px] text-muted-foreground">
              Seules les proformas validées, payées ou soldées peuvent être associées.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label>Produits *</label>
              <Button type="button" variant="outline" size="sm" onClick={addLigne}>
                <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Produit</TableHead>
                    <TableHead className="w-[14%]">Dimensions (cm)</TableHead>
                    <TableHead className="w-[10%]">Surface (m²)</TableHead>
                    <TableHead className="w-[9%]">Qté</TableHead>
                    <TableHead className="w-[13%]">P.U.</TableHead>
                    <TableHead className="w-[14%] text-right">Total</TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-16 text-muted-foreground">
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
                        <TableCell className="text-sm text-muted-foreground">
                          {calculateSurface(ligne) !== null
                            ? `${calculateSurface(ligne)!.toFixed(3)} m²`
                            : <span className="text-xs italic">N/A</span>}
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
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div>
                  <p className="text-sm font-semibold text-slate-700">TVA (18%)</p>
                  <p className="text-[11px] text-muted-foreground">Appliquer la TVA à ce bon de commande</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={appliquerTva ? 'default' : 'outline'} className="text-[10px] uppercase">
                    {appliquerTva ? 'Appliquée' : 'Non appliquée'}
                  </Badge>
                  <Switch checked={appliquerTva} onCheckedChange={setAppliquerTva} />
                </div>
              </div>
              <div className="flex-1 flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div>
                  <p className="text-sm font-semibold text-slate-700">AIB (3%)</p>
                  <p className="text-[11px] text-muted-foreground">Appliquer l&apos;AIB à ce bon de commande</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={appliquerAib ? 'default' : 'outline'} className="text-[10px] uppercase">
                    {appliquerAib ? 'Appliqué' : 'Non appliqué'}
                  </Badge>
                  <Switch checked={appliquerAib} onCheckedChange={setAppliquerAib} />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-full sm:w-72 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total H.T.</span>
                  <span>{formatMontant(totalGeneral)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    TVA (18%)
                    {!appliquerTva && <span className="text-[10px] italic"> — non appliquée</span>}
                  </span>
                  <span>{formatMontant(montantTva)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total T.T.C.</span>
                  <span>{formatMontant(totalTTC)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    AIB (3%) — déduite
                    {!appliquerAib && <span className="text-[10px] italic"> — non appliqué</span>}
                  </span>
                  <span>− {formatMontant(montantAib)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-1">
                  <span>Montant Net</span>
                  <span>{formatMontant(montantNet)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
