'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DemandeBudgetStatusBadge, DemandeBudgetStatus } from '@/components/DemandeBudgetStatusBadge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import { TYPE_BUDGET_VALUES, TYPE_BUDGET_META, TypeBudgetValue, typeBudgetLabel } from '@/lib/budgetTypes';
import { Plus, Eye, Wallet, CheckCircle2, Clock, X, SlidersHorizontal, ChevronDown, FileQuestion, FileWarning, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemandeBudget {
  id: string;
  numero: string;
  statut: DemandeBudgetStatus;
  type: TypeBudgetValue;
  periodeMois: string | null;
  requesterEmail: string;
  requesterName: string | null;
  departement: string | null;
  montantTotal: number;
  montantConsomme: number;
  montantPlafond: number;
  nbDepensesSansJustificatif: number;
  nbDepassementsEnAttente: number;
  createdAt: string;
  proformas: { invoice: { client: { nom: string } } }[];
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

const STATUT_OPTIONS: { value: DemandeBudgetStatus; label: string }[] = [
  { value: 'SOUMISE', label: 'Soumise' },
  { value: 'VALIDEE', label: 'Validée' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'REJETEE', label: 'Rejetée' },
  { value: 'PAYEE', label: 'Soldée / clôturée' },
];

const defaultFilters = {
  statut: '',
  type: '',
  mois: '',
  departement: '',
  sansJustificatif: false,
  depassementEnAttente: false,
};

export default function DemandesBudgetListPage() {
  const [demandes, setDemandes] = useState<DemandeBudget[]>([]);
  const [role, setRole] = useState({ isImplique: false });
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isImplique = role.isImplique;

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.statut) params.append('statut', filters.statut);
    if (filters.type) params.append('type', filters.type);
    if (filters.mois) params.append('mois', filters.mois);
    if (filters.departement) params.append('departement', filters.departement);
    if (filters.sansJustificatif) params.append('sansJustificatif', '1');
    if (filters.depassementEnAttente) params.append('depassementEnAttente', '1');

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
    fetch('/api/demandes-budget/me-role')
      .then((res) => (res.ok ? res.json() : { isImplique: false }))
      .then((data) => setRole({ isImplique: !!data.isImplique }))
      .catch(() => setRole({ isImplique: false }));
  }, []);

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
    if (filters.type) {
      chips.push({ key: 'type', label: typeBudgetLabel(filters.type), onRemove: () => setFilters((p) => ({ ...p, type: '' })) });
    }
    if (filters.mois) {
      chips.push({
        key: 'mois',
        label: format(new Date(`${filters.mois}-01T12:00:00`), 'MMMM yyyy', { locale: fr }),
        onRemove: () => setFilters((p) => ({ ...p, mois: '' })),
      });
    }
    if (filters.departement) {
      chips.push({ key: 'departement', label: filters.departement, onRemove: () => setFilters((p) => ({ ...p, departement: '' })) });
    }
    if (filters.sansJustificatif) {
      chips.push({ key: 'sansJustificatif', label: 'Dépenses sans justificatif', onRemove: () => setFilters((p) => ({ ...p, sansJustificatif: false })) });
    }
    if (filters.depassementEnAttente) {
      chips.push({ key: 'depassementEnAttente', label: 'Dépassement en attente', onRemove: () => setFilters((p) => ({ ...p, depassementEnAttente: false })) });
    }
    return chips;
  }, [filters]);

  const summary = useMemo(() => {
    const total = demandes.reduce((sum, d) => sum + Number(d.montantTotal), 0);
    const soumises = demandes.filter((d) => d.statut === 'SOUMISE').reduce((sum, d) => sum + Number(d.montantTotal), 0);
    const consomme = demandes.reduce((sum, d) => sum + Number(d.montantConsomme), 0);
    const sansJustificatif = demandes.reduce((sum, d) => sum + d.nbDepensesSansJustificatif, 0);
    return { total, soumises, consomme, sansJustificatif, count: demandes.length };
  }, [demandes]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isImplique ? 'Demandes de Budget' : 'Mes Demandes de Budget'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summary.count} demande(s){isImplique ? ' — toutes les demandes' : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/budget/nouvelle-demande')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Demande
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <p className="text-sm text-muted-foreground">Dépensé (journal de caisse)</p>
              <p className="text-xl font-bold">{formatMontant(summary.consomme)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-100 text-green-700"><CheckCircle2 className="w-5 h-5" /></div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-amber-500">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Dépenses sans justificatif</p>
              <p className="text-xl font-bold">{summary.sansJustificatif}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><FileWarning className="w-5 h-5" /></div>
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
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6 items-center">
              <Select value={filters.statut} onValueChange={(value) => setFilters((prev) => ({ ...prev, statut: value }))}>
                <SelectTrigger><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger><SelectValue placeholder="Tous les types" /></SelectTrigger>
                <SelectContent>
                  {TYPE_BUDGET_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_BUDGET_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={filters.mois}
                onChange={(e) => setFilters((prev) => ({ ...prev, mois: e.target.value }))}
                aria-label="Mois du budget mensuel"
                title="Mois (budgets mensuels)"
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={filters.sansJustificatif}
                  onCheckedChange={(v) => setFilters((prev) => ({ ...prev, sansJustificatif: v }))}
                />
                Avec dépenses sans justificatif
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={filters.depassementEnAttente}
                  onCheckedChange={(v) => setFilters((prev) => ({ ...prev, depassementEnAttente: v }))}
                />
                Dépassement en attente
              </label>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Numéro</TableHead>
              <TableHead>Type</TableHead>
              {isImplique && <TableHead>Demandeur</TableHead>}
              <TableHead>Département</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="min-w-[160px]">Consommé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isImplique ? 9 : 8} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : demandes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isImplique ? 9 : 8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileQuestion className="h-8 w-8" />
                    {isImplique ? (
                      <p>Aucune demande de budget trouvée.</p>
                    ) : (
                      <>
                        <p>Vous n&apos;avez pas encore fait de demande de budget.</p>
                        <Button size="sm" className="mt-2" onClick={() => router.push('/budget/nouvelle-demande')}>
                          <Plus className="mr-2 h-4 w-4" /> Faire une demande
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              demandes.map((demande) => (
                <TableRow key={demande.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">{demande.numero}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('font-normal', TYPE_BUDGET_META[demande.type]?.className)}>
                      {typeBudgetLabel(demande.type)}
                    </Badge>
                    {demande.type === 'MENSUEL' && demande.periodeMois && (
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {format(new Date(demande.periodeMois), 'MMMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </TableCell>
                  {isImplique && <TableCell className="text-sm">{demande.requesterName || demande.requesterEmail}</TableCell>}
                  <TableCell className="text-sm text-muted-foreground">{demande.departement || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(demande.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(Number(demande.montantTotal))}</TableCell>
                  <TableCell>
                    {['VALIDEE', 'EN_COURS', 'PAYEE'].includes(demande.statut) ? (
                      <div className="space-y-1">
                        <BudgetProgressBar consomme={demande.montantConsomme} prevu={demande.montantPlafond} />
                        {demande.nbDepensesSansJustificatif > 0 && (
                          <p className="text-xs text-amber-700 flex items-center gap-1">
                            <FileWarning className="h-3 w-3" /> {demande.nbDepensesSansJustificatif} sans justificatif
                          </p>
                        )}
                        {demande.nbDepassementsEnAttente > 0 && (
                          <p className="text-xs text-orange-700 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> dépassement en attente
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE'} /></TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="icon" onClick={() => router.push(`/budget/demandes/${demande.id}`)}>
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
