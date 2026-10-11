'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { CommandeFournisseurModal } from '@/components/CommandeFournisseurModal';
import { CommandeStatutControl, STATUT_LABELS } from '@/components/fournisseurs/CommandeStatutControl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Building2, Wallet, PackageCheck, Clock, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { StatutCommandeFournisseur } from '@prisma/client';

interface LigneCommande {
  id: string;
  prixTotal: number;
}

interface CommandeFournisseur {
  id: string;
  numero: string;
  dateCommande: string;
  statut: StatutCommandeFournisseur;
  totalHT: number;
  totalTTC: number;
  montantNet: number;
  fournisseurId: string;
  fournisseur: Fournisseur;
  lignes: LigneCommande[];
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

const defaultFilters = {
  fournisseurId: '',
  statut: '',
};

export default function CommandesFournisseursListPage() {
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const fetchFournisseurs = useCallback(async () => {
    try {
      const res = await fetch('/api/fournisseurs');
      if (!res.ok) throw new Error();
      setFournisseurs(await res.json());
    } catch {
      toast.error('Erreur lors de la récupération des fournisseurs.');
    }
  }, []);

  useEffect(() => {
    fetchFournisseurs();
  }, [fetchFournisseurs]);

  useEffect(() => {
    fetch('/api/demandes-budget/me-role')
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const handleFournisseurCreated = (newFournisseur: Fournisseur) => {
    setFournisseurs((prev) => [...prev, newFournisseur]);
  };

  const fetchCommandes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
    if (filters.statut) params.append('statut', filters.statut);

    try {
      const res = await fetch(`/api/fournisseurs/commandes?${params.toString()}`);
      if (!res.ok) throw new Error();
      setCommandes(await res.json());
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la récupération des bons de commande.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCommandes();
  }, [fetchCommandes]);

  const resetFilters = () => setFilters(defaultFilters);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.fournisseurId) {
      const nom = fournisseurs.find((f) => f.id === filters.fournisseurId)?.entreprise ?? 'Fournisseur';
      chips.push({ key: 'fournisseur', label: nom, onRemove: () => setFilters((p) => ({ ...p, fournisseurId: '' })) });
    }
    if (filters.statut) {
      chips.push({
        key: 'statut',
        label: STATUT_LABELS[filters.statut as StatutCommandeFournisseur] ?? filters.statut,
        onRemove: () => setFilters((p) => ({ ...p, statut: '' })),
      });
    }
    return chips;
  }, [filters, fournisseurs]);

  const handleStatutChange = async (commande: CommandeFournisseur, newStatut: StatutCommandeFournisseur) => {
    try {
      const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: newStatut }),
      });
      if (!res.ok) throw new Error();
      setCommandes((prev) => prev.map((c) => (c.id === commande.id ? { ...c, statut: newStatut } : c)));
      toast.success('Statut mis à jour avec succès !');
    } catch {
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  };

  const summary = useMemo(() => {
    const total = commandes.reduce((sum, c) => sum + Number(c.montantNet), 0);
    const validees = commandes.filter((c) => c.statut === 'VALIDEE' || c.statut === 'LIVREE');
    const totalValidees = validees.reduce((sum, c) => sum + Number(c.montantNet), 0);
    const enBrouillon = commandes.filter((c) => c.statut === 'BROUILLON').reduce((sum, c) => sum + Number(c.montantNet), 0);
    return { total, totalValidees, enBrouillon, count: commandes.length };
  }, [commandes]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bons de Commande Fournisseurs</h1>
          <p className="text-sm text-muted-foreground mt-1">{summary.count} bon(s) de commande</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Bon de Commande
        </Button>
      </div>

      <CommandeFournisseurModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCommandes}
        fournisseurs={fournisseurs}
        onFournisseurCreated={handleFournisseurCreated}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total commandé</p>
              <p className="text-xl font-bold">{formatMontant(summary.total)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Wallet className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Validées / Livrées</p>
              <p className="text-xl font-bold">{formatMontant(summary.totalValidees)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100 text-green-700"><PackageCheck className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-amber-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En brouillon</p>
              <p className="text-xl font-bold">{formatMontant(summary.enBrouillon)}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><Clock className="w-5 h-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
            {activeFilterChips.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5">{activeFilterChips.length}</Badge>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')} />
          </Button>

          {activeFilterChips.map((chip) => (
            <Badge key={chip.key} variant="outline" className="gap-1.5 py-1.5 pl-3 pr-2 font-normal">
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded-full hover:bg-muted p-0.5"
                aria-label={`Retirer le filtre ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {activeFilterChips.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              Tout effacer
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="mt-3">
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              <FournisseurCombobox
                fournisseurs={fournisseurs}
                value={filters.fournisseurId}
                onChange={(id) => setFilters((prev) => ({ ...prev, fournisseurId: id }))}
                onAddNew={() => {}}
              />
              <Select value={filters.statut} onValueChange={(value) => setFilters((prev) => ({ ...prev, statut: value }))}>
                <SelectTrigger><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BROUILLON">Brouillon</SelectItem>
                  <SelectItem value="VALIDEE">Validée</SelectItem>
                  <SelectItem value="LIVREE">Livrée</SelectItem>
                  <SelectItem value="ANNULEE">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Fournisseur</TableHead>
              <TableHead>Numéro</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Articles</TableHead>
              <TableHead className="text-right">Montant Net</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : commandes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Aucun bon de commande trouvé.</TableCell></TableRow>
            ) : (
              commandes.map((commande) => {
                return (
                  <TableRow key={commande.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Building2 className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate max-w-[160px]">{commande.fournisseur.entreprise}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{commande.numero}</TableCell>
                    <TableCell className="whitespace-nowrap">{format(new Date(commande.dateCommande), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-center">{commande.lignes.length}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(Number(commande.montantNet))}</TableCell>
                    <TableCell>
                      <CommandeStatutControl
                        statut={commande.statut}
                        isAdmin={isAdmin}
                        onChange={(value) => handleStatutChange(commande, value)}
                        triggerClassName="border-none bg-transparent! p-0 h-auto cursor-pointer w-auto"
                        buttonClassName="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => router.push(`/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Voir le bon de commande</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
