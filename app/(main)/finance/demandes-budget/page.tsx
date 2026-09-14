'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DemandeBudgetStatusBadge, DemandeBudgetStatus } from '@/components/DemandeBudgetStatusBadge';
import { DemandeBudgetModal } from '@/components/DemandeBudgetModal';
import { Plus, Eye, Wallet, CheckCircle2, Clock, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemandeBudget {
  id: string;
  numero: string;
  statut: DemandeBudgetStatus;
  requesterEmail: string;
  requesterName: string | null;
  departement: string | null;
  montantTotal: number;
  createdAt: string;
  proformas: { invoice: { client: { nom: string } } }[];
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

const STATUT_OPTIONS: { value: DemandeBudgetStatus; label: string }[] = [
  { value: 'SOUMISE', label: 'Soumise' },
  { value: 'VALIDEE', label: 'Validée' },
  { value: 'REJETEE', label: 'Rejetée' },
  { value: 'PAYEE', label: 'Payée' },
];

const defaultFilters = {
  statut: '',
  departement: '',
};

export default function DemandesBudgetListPage() {
  const [demandes, setDemandes] = useState<DemandeBudget[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const router = useRouter();

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.statut) params.append('statut', filters.statut);
    if (filters.departement) params.append('departement', filters.departement);

    try {
      const res = await fetch(`/api/demandes-budget?${params.toString()}`);
      if (!res.ok) throw new Error();
      setDemandes(await res.json());
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la récupération des demandes de budget.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  const resetFilters = () => setFilters(defaultFilters);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.statut) {
      chips.push({
        key: 'statut',
        label: STATUT_OPTIONS.find((s) => s.value === filters.statut)?.label ?? filters.statut,
        onRemove: () => setFilters((p) => ({ ...p, statut: '' })),
      });
    }
    if (filters.departement) {
      chips.push({ key: 'departement', label: filters.departement, onRemove: () => setFilters((p) => ({ ...p, departement: '' })) });
    }
    return chips;
  }, [filters]);

  const summary = useMemo(() => {
    const total = demandes.reduce((sum, d) => sum + Number(d.montantTotal), 0);
    const soumises = demandes.filter((d) => d.statut === 'SOUMISE').reduce((sum, d) => sum + Number(d.montantTotal), 0);
    const payees = demandes.filter((d) => d.statut === 'PAYEE').reduce((sum, d) => sum + Number(d.montantTotal), 0);
    return { total, soumises, payees, count: demandes.length };
  }, [demandes]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Demandes de Budget</h1>
          <p className="text-sm text-muted-foreground mt-1">{summary.count} demande(s)</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Demande
        </Button>
      </div>

      <DemandeBudgetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchDemandes}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total demandé</p>
              <p className="text-xl font-bold">{formatMontant(summary.total)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Wallet className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En attente de validation</p>
              <p className="text-xl font-bold">{formatMontant(summary.soumises)}</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-100 text-orange-700"><Clock className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Payées</p>
              <p className="text-xl font-bold">{formatMontant(summary.payees)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100 text-green-700"><CheckCircle2 className="w-5 h-5" /></div>
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
              <Select value={filters.statut} onValueChange={(value) => setFilters((prev) => ({ ...prev, statut: value }))}>
                <SelectTrigger><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
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
              <TableHead>Numéro</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Département</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : demandes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Aucune demande de budget trouvée.</TableCell></TableRow>
            ) : (
              demandes.map((demande) => (
                <TableRow key={demande.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">{demande.numero}</TableCell>
                  <TableCell className="text-sm">{demande.requesterName || demande.requesterEmail}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{demande.departement || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(demande.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(Number(demande.montantTotal))}</TableCell>
                  <TableCell><DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE'} /></TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="icon" onClick={() => router.push(`/finance/demandes-budget/${demande.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
