'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { FournisseurModal } from '@/components/FournisseurModal';
import { FactureFournisseurModal } from '@/components/FactureFournisseurModal';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { FactureFournisseurStatusBadge, StatusDot } from '@/components/FactureFournisseurStatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CalendarIcon, Pencil, Plus, X, Building2, Wallet, Clock, CheckCircle2,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Define the type for a supplier invoice, including the related supplier
interface FactureFournisseur {
  id: string;
  reference: string;
  montant: number;
  date: string;
  status: 'EN_ATTENTE' | 'PAYEE' | 'ANNULEE';
  pieceJointe: string | null;
  fournisseurId: string;
  fournisseur: Fournisseur;
  commandeId?: string | null;
  ligneBudgetId?: string | null;
}

const formatMontant = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} XOF`;

type Period = 'current' | 'previous' | 'all' | 'custom';

const CURRENT_YEAR = new Date().getFullYear();

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'current', label: `Cette année (${CURRENT_YEAR})` },
  { value: 'previous', label: `Année dernière (${CURRENT_YEAR - 1})` },
  { value: 'all', label: 'Toutes les périodes' },
  { value: 'custom', label: 'Période personnalisée' },
];

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

const defaultFilters = {
  fournisseurId: '',
  status: '',
  period: 'current' as Period,
  dateRange: undefined as DateRange | undefined,
};

export default function FacturesListPage() {
  const [factures, setFactures] = useState<FactureFournisseur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState<FactureFournisseur | null>(null);

  // Fetch all suppliers for the filter dropdown and the add-invoice modal
  const fetchFournisseurs = useCallback(async () => {
    try {
      const res = await fetch("/api/fournisseurs");
      if (!res.ok) {
        const errorBody = await res.text();
        console.error('Fournisseurs API error response:', res.status, errorBody);
        throw new Error(`Failed to fetch fournisseurs: ${res.status}`);
      }
      const data = await res.json();
      setFournisseurs(data);
    } catch (error) {
      console.error('Error fetching fournisseurs:', error);
      toast.error("Erreur lors de la récupération des prestataires.");
    }
  }, []);

  useEffect(() => {
    fetchFournisseurs();
  }, [fetchFournisseurs]);

  const handleFournisseurCreated = (newFournisseur: Fournisseur) => {
    setFournisseurs((prev) => [...prev, newFournisseur]);
  };

  // Fetch invoices based on filters
  const fetchFactures = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);

    if (filters.period === 'current') {
      params.append('year', String(CURRENT_YEAR));
    } else if (filters.period === 'previous') {
      params.append('year', String(CURRENT_YEAR - 1));
    } else if (filters.period === 'all') {
      params.append('year', 'ALL');
    } else if (filters.period === 'custom') {
      if (filters.dateRange?.from) params.append('startDate', filters.dateRange.from.toISOString());
      if (filters.dateRange?.to) params.append('endDate', filters.dateRange.to.toISOString());
    }

    try {
      const res = await fetch(`/api/factures-fournisseurs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch factures");
      setFactures(await res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des factures.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFactures();
  }, [fetchFactures]);

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.fournisseurId) {
      const nom = fournisseurs.find(f => f.id === filters.fournisseurId)?.entreprise ?? 'Prestataire';
      chips.push({ key: 'fournisseur', label: nom, onRemove: () => setFilters(prev => ({ ...prev, fournisseurId: '' })) });
    }
    if (filters.status && filters.status !== 'ALL') {
      chips.push({ key: 'status', label: STATUS_LABELS[filters.status] ?? filters.status, onRemove: () => setFilters(prev => ({ ...prev, status: '' })) });
    }
    if (filters.period !== 'current') {
      const label = filters.period === 'custom'
        ? (filters.dateRange?.from
            ? `${format(filters.dateRange.from, 'dd/MM/yy')} - ${filters.dateRange.to ? format(filters.dateRange.to, 'dd/MM/yy') : '...'}`
            : 'Période personnalisée')
        : PERIOD_OPTIONS.find(p => p.value === filters.period)?.label ?? '';
      chips.push({ key: 'period', label, onRemove: () => setFilters(prev => ({ ...prev, period: 'current', dateRange: undefined })) });
    }
    return chips;
  }, [filters, fournisseurs]);

  const handleStatusChange = async (facture: FactureFournisseur, newStatus: FactureFournisseur['status']) => {
      try {
        const response = await fetch(`/api/factures-fournisseurs/${facture.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update status');
        }

        setFactures(prevFactures =>
          prevFactures.map(f =>
            f.id === facture.id ? { ...f, status: newStatus } : f
          )
        );
        toast.success('Statut mis à jour avec succès !');
      } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut.';
        toast.error(message);
      }
    };

  const summary = useMemo(() => {
    const total = factures.reduce((sum, f) => sum + Number(f.montant), 0);
    const paye = factures.filter(f => f.status === 'PAYEE').reduce((sum, f) => sum + Number(f.montant), 0);
    const enAttente = factures.filter(f => f.status === 'EN_ATTENTE').reduce((sum, f) => sum + Number(f.montant), 0);
    return { total, paye, enAttente, count: factures.length };
  }, [factures]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Liste des Factures Prestataires</h1>
          <p className="text-sm text-muted-foreground mt-1">{summary.count} facture(s) sur la période sélectionnée</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une facture
        </Button>
      </div>

      <FactureFournisseurModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchFactures}
        fournisseurs={fournisseurs}
        onFournisseurCreated={handleFournisseurCreated}
      />
      <FournisseurModal
        isOpen={isFournisseurModalOpen}
        onClose={() => setIsFournisseurModalOpen(false)}
        onSuccess={handleFournisseurCreated}
      />
      <FactureFournisseurModal
        isOpen={!!editingFacture}
        onClose={() => setEditingFacture(null)}
        onSuccess={fetchFactures}
        fournisseurs={fournisseurs}
        onFournisseurCreated={handleFournisseurCreated}
        initialData={editingFacture}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total facturé</p>
              <p className="text-xl font-bold">{formatMontant(summary.total)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Wallet className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Payé</p>
              <p className="text-xl font-bold">{formatMontant(summary.paye)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100 text-green-700"><CheckCircle2 className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-amber-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-xl font-bold">{formatMontant(summary.enAttente)}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><Clock className="w-5 h-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(s => !s)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
            {activeFilterChips.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5">{activeFilterChips.length}</Badge>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')} />
          </Button>

          {activeFilterChips.map(chip => (
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
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
              <FournisseurCombobox
                fournisseurs={fournisseurs}
                value={filters.fournisseurId}
                onChange={(id) => setFilters(prev => ({ ...prev, fournisseurId: id }))}
                onAddNew={() => setIsFournisseurModalOpen(true)}
              />
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                  <SelectItem value="PAYEE">Payée</SelectItem>
                  <SelectItem value="ANNULEE">Annulée</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.period} onValueChange={(value: Period) => setFilters(prev => ({ ...prev, period: value }))}>
                <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.period === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>{format(filters.dateRange.from, "dd/MM/yy")} - {format(filters.dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(filters.dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>Choisir les dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={filters.dateRange} onSelect={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} />
                  </PopoverContent>
                </Popover>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Prestataire</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Pièce jointe</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : factures.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">Aucune facture trouvée.</TableCell></TableRow>
            ) : (
              factures.map((facture) => {
                const isLocked = facture.status === 'PAYEE' || facture.status === 'ANNULEE';
                return (
                <TableRow key={facture.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate max-w-[160px]">{facture.fournisseur.entreprise}</span>
                    </div>
                  </TableCell>
                  <TableCell>{facture.reference}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(facture.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(facture.montant)}</TableCell>
                  <TableCell>
                    {isLocked ? (
                      <FactureFournisseurStatusBadge status={facture.status} animate={false} />
                    ) : (
                      <Select value={facture.status} onValueChange={(newStatus: FactureFournisseur['status']) => handleStatusChange(facture, newStatus)}>
                        <SelectTrigger className="border-none bg-transparent! p-0 h-auto cursor-pointer">
                          <SelectValue>
                            <FactureFournisseurStatusBadge status={facture.status} />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EN_ATTENTE">
                            <span className="flex items-center gap-2"><StatusDot status="EN_ATTENTE" animate={false} />En attente</span>
                          </SelectItem>
                          {/* « Payée » à la main comme avant, sauf pour une facture rattachée à un bon de commande
                              ou à une ligne de budget : celle-là passe « payée » par son paiement sur le budget. */}
                          <SelectItem value="PAYEE" disabled={!!facture.commandeId || !!facture.ligneBudgetId}>
                            <span className="flex items-center gap-2"><StatusDot status="PAYEE" animate={false} />{facture.commandeId || facture.ligneBudgetId ? 'Payée (par le budget)' : 'Payée'}</span>
                          </SelectItem>
                          <SelectItem value="ANNULEE">
                            <span className="flex items-center gap-2"><StatusDot status="ANNULEE" animate={false} />Annulée</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <AttachmentPreviewButton url={facture.pieceJointe} title={`Facture ${facture.reference}`} />
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setEditingFacture(facture)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isLocked ? 'Voir la facture' : 'Modifier la facture'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );})
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
