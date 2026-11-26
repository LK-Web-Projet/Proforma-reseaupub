'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next-nprogress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DemandeBudgetStatusBadge, DemandeBudgetStatus } from '@/components/DemandeBudgetStatusBadge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import { TYPE_BUDGET_VALUES, TYPE_BUDGET_META, TypeBudgetValue, typeBudgetLabel } from '@/lib/budgetTypes';
import {
  Plus,
  Eye,
  Wallet,
  CheckCircle2,
  Clock,
  X,
  SlidersHorizontal,
  ChevronDown,
  FileQuestion,
  FileWarning,
  TrendingUp,
  Archive,
  XCircle,
} from 'lucide-react';
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
  /** Départements des lignes (du plus gros montant au plus petit). */
  departements?: string[];
  montantTotal: number;
  montantConsomme: number;
  montantPlafond: number;
  nbDepensesSansJustificatif: number;
  nbJustificatifsEnRetard: number;
  nbDepassementsEnAttente: number;
  nbLignesACorriger: number;
  createdAt: string;
  proformas: { invoice: { client: { nom: string } } }[];
  /** Budget collectif (plusieurs départements) ; vue partielle = seulement les lignes de ses départements. */
  collectif?: boolean;
  vuePartielle?: boolean;
  dateLimiteSaisie?: string | null;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

// Groupes de statut affichés en cartes cliquables. Par défaut, seuls les budgets « actifs »
// (dépensables) sont listés ; les autres groupes s'affichent en cliquant sur leur carte.
type GroupeStatut = 'ACTIFS' | 'SOUMISE' | 'PAYEE' | 'REJETEE' | 'TOUS';

const GROUPES: {
  value: GroupeStatut;
  label: string;
  detail: string;
  statuts: DemandeBudgetStatus[] | null;
  icon: React.ElementType;
  couleur: { bordure: string; icone: string; anneau: string };
}[] = [
  {
    value: 'ACTIFS',
    label: 'Budgets actifs',
    detail: 'Validés, partiellement validés ou en cours',
    statuts: ['VALIDEE', 'VALIDATION_PARTIELLE', 'EN_COURS'],
    icon: CheckCircle2,
    couleur: { bordure: 'border-t-blue-500', icone: 'bg-blue-100 text-blue-700', anneau: 'ring-blue-500 bg-blue-50/40' },
  },
  {
    value: 'SOUMISE',
    label: 'En préparation ou à valider',
    detail: 'Budgets collectifs en préparation, ou soumis pas encore accordés',
    statuts: ['EN_PREPARATION', 'SOUMISE'],
    icon: Clock,
    couleur: { bordure: 'border-t-orange-500', icone: 'bg-orange-100 text-orange-700', anneau: 'ring-orange-500 bg-orange-50/40' },
  },
  {
    value: 'PAYEE',
    label: 'Soldés / clôturés',
    detail: 'Entièrement consommés ou clôturés',
    statuts: ['PAYEE'],
    icon: Archive,
    couleur: { bordure: 'border-t-green-500', icone: 'bg-green-100 text-green-700', anneau: 'ring-green-500 bg-green-50/40' },
  },
  {
    value: 'REJETEE',
    label: 'Rejetés',
    detail: 'Refusés à la validation',
    statuts: ['REJETEE'],
    icon: XCircle,
    couleur: { bordure: 'border-t-red-500', icone: 'bg-red-100 text-red-700', anneau: 'ring-red-500 bg-red-50/40' },
  },
  {
    value: 'TOUS',
    label: 'Tous les budgets',
    detail: 'Tous statuts confondus',
    statuts: null,
    icon: Wallet,
    couleur: { bordure: 'border-t-slate-500', icone: 'bg-slate-100 text-slate-700', anneau: 'ring-slate-500 bg-slate-50/60' },
  },
];

const dansGroupe = (groupe: GroupeStatut, statut: DemandeBudgetStatus) => {
  const statuts = GROUPES.find((g) => g.value === groupe)?.statuts;
  return !statuts || statuts.includes(statut);
};

/** Groupe correspondant à un statut passé dans l'URL (?statut=SOUMISE…). */
const groupeDuStatut = (statut: string): GroupeStatut | null => {
  const g = GROUPES.find((x) => x.statuts?.includes(statut as DemandeBudgetStatus));
  return g ? g.value : null;
};

// Filtres envoyés au serveur ; le statut et le type sont filtrés à l'écran pour que les
// cartes et les mini-cartes affichent leurs compteurs sans requête supplémentaire.
const defaultFilters = {
  mois: '',
  departement: '',
  sansJustificatif: false,
  depassementEnAttente: false,
};

export default function DemandesBudgetListPage() {
  const [demandes, setDemandes] = useState<DemandeBudget[]>([]);
  const [role, setRole] = useState({ isImplique: false });
  const [filters, setFilters] = useState(defaultFilters);
  const [groupe, setGroupe] = useState<GroupeStatut>('ACTIFS');
  const [typeFiltre, setTypeFiltre] = useState<TypeBudgetValue | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paramsLus, setParamsLus] = useState(false);
  const router = useRouter();

  const isImplique = role.isImplique;

  // Liens entrants (ex. e-mail « dépenses sans justificatif » → ?sansJustificatif=1).
  // Lu au montage plutôt qu'avec useSearchParams (pas de Suspense requise au build).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const statut = p.get('statut');
    const type = p.get('type');
    if (statut) {
      const g = groupeDuStatut(statut);
      if (g) setGroupe(g);
    }
    if (type && (TYPE_BUDGET_VALUES as readonly string[]).includes(type)) setTypeFiltre(type as TypeBudgetValue);
    if (p.get('sansJustificatif') === '1' || p.get('depassementEnAttente') === '1') {
      setGroupe((g) => (statut ? g : 'TOUS'));
      setFilters((f) => ({
        ...f,
        sansJustificatif: p.get('sansJustificatif') === '1',
        depassementEnAttente: p.get('depassementEnAttente') === '1',
      }));
    }
    setParamsLus(true);
  }, []);

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
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
    if (paramsLus) fetchDemandes();
  }, [fetchDemandes, paramsLus]);

  const resetFilters = () => {
    setFilters(defaultFilters);
    setTypeFiltre('');
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
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

  // Compteurs des cartes de statut : tiennent compte du type choisi.
  const parGroupe = useMemo(() => {
    const res = {} as Record<GroupeStatut, { count: number; montant: number; consomme: number }>;
    for (const g of GROUPES) {
      const liste = demandes.filter((d) => dansGroupe(g.value, d.statut) && (!typeFiltre || d.type === typeFiltre));
      res[g.value] = {
        count: liste.length,
        montant: liste.reduce((s, d) => s + Number(d.montantTotal), 0),
        consomme: liste.reduce((s, d) => s + Number(d.montantConsomme), 0),
      };
    }
    return res;
  }, [demandes, typeFiltre]);

  // Budgets du groupe de statut choisi (avant le filtre de type) : base des mini-cartes de type.
  const duGroupe = useMemo(() => demandes.filter((d) => dansGroupe(groupe, d.statut)), [demandes, groupe]);

  const parType = useMemo(() => {
    const res = {} as Record<TypeBudgetValue, number>;
    for (const t of TYPE_BUDGET_VALUES) res[t] = duGroupe.filter((d) => d.type === t).length;
    return res;
  }, [duGroupe]);

  const visibles = useMemo(
    () => (typeFiltre ? duGroupe.filter((d) => d.type === typeFiltre) : duGroupe),
    [duGroupe, typeFiltre]
  );

  const sansJustif = useMemo(() => {
    const nb = visibles.reduce((s, d) => s + d.nbDepensesSansJustificatif, 0);
    const retard = visibles.reduce((s, d) => s + (d.nbJustificatifsEnRetard ?? 0), 0);
    return { nb, retard };
  }, [visibles]);

  const groupeCourant = GROUPES.find((g) => g.value === groupe)!;
  const nbColonnes = isImplique ? 9 : 8;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{isImplique ? 'Demandes de Budget' : 'Mes Demandes de Budget'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visibles.length} budget(s) affiché(s) — {groupeCourant.label.toLowerCase()}
            {typeFiltre ? ` · ${typeBudgetLabel(typeFiltre)}` : ''}
          </p>
        </div>
        <Button onClick={() => router.push('/budget/nouvelle-demande')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Demande
        </Button>
      </div>

      {/* Cartes de statut : cliquer sur une carte affiche les budgets de ce groupe. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6" role="group" aria-label="Statut des budgets">
        {GROUPES.map((g) => {
          const Icon = g.icon;
          const actif = groupe === g.value;
          const stats = parGroupe[g.value];
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => setGroupe(g.value)}
              aria-pressed={actif}
              className={cn(
                'text-left rounded-xl border border-t-4 bg-card shadow-sm transition-all',
                'hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                g.couleur.bordure,
                actif ? cn('ring-2 shadow-md', g.couleur.anneau) : 'opacity-80 hover:opacity-100'
              )}
            >
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('text-sm', actif ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{g.label}</p>
                  <p className="text-2xl font-bold leading-tight mt-1">{stats.count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{formatMontant(stats.montant)}</p>
                  {g.value === 'ACTIFS' && (
                    <p className="text-xs text-green-700 mt-0.5 truncate">Dépensé : {formatMontant(stats.consomme)}</p>
                  )}
                </div>
                <div className={cn('p-2.5 rounded-xl shrink-0', g.couleur.icone)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </button>
          );
        })}
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

          {/* Mini-cartes de type : un clic filtre, un second clic retire le filtre. */}
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Type de budget">
            <button
              type="button"
              onClick={() => setTypeFiltre('')}
              aria-pressed={!typeFiltre}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                !typeFiltre ? 'bg-foreground text-background border-foreground' : 'bg-card hover:bg-muted'
              )}
            >
              Tous types
              <span className={cn('text-xs tabular-nums', !typeFiltre ? 'opacity-80' : 'text-muted-foreground')}>{duGroupe.length}</span>
            </button>
            {TYPE_BUDGET_VALUES.map((t) => {
              const actif = typeFiltre === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFiltre(actif ? '' : t)}
                  aria-pressed={actif}
                  title={TYPE_BUDGET_META[t].description}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    actif ? cn(TYPE_BUDGET_META[t].className, 'ring-1 ring-current font-medium') : 'bg-card hover:bg-muted',
                    parType[t] === 0 && !actif && 'text-muted-foreground'
                  )}
                >
                  {TYPE_BUDGET_META[t].label}
                  <span className={cn('text-xs tabular-nums', !actif && 'text-muted-foreground')}>{parType[t]}</span>
                </button>
              );
            })}
          </div>

          {(sansJustif.nb > 0 || filters.sansJustificatif) && (
            <button
              type="button"
              onClick={() => setFilters((p) => ({ ...p, sansJustificatif: !p.sansJustificatif }))}
              aria-pressed={filters.sansJustificatif}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                sansJustif.retard > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800',
                filters.sansJustificatif && 'ring-1 ring-current font-medium'
              )}
              title="Afficher seulement les budgets ayant des dépenses sans justificatif"
            >
              <FileWarning className="h-3.5 w-3.5" />
              {sansJustif.nb} sans justificatif
              {sansJustif.retard > 0 && <span className="text-xs">({sansJustif.retard} en retard)</span>}
            </button>
          )}

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

          {(activeFilterChips.length > 0 || typeFiltre) && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              Tout effacer
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="mt-3">
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 items-center">
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
              <TableRow><TableCell colSpan={nbColonnes} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={nbColonnes} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileQuestion className="h-8 w-8" />
                    {demandes.length > 0 ? (
                      <>
                        <p>
                          Aucun budget « {groupeCourant.label.toLowerCase()} »
                          {typeFiltre ? ` de type ${typeBudgetLabel(typeFiltre).toLowerCase()}` : ''}.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            setGroupe('TOUS');
                            setTypeFiltre('');
                          }}
                        >
                          Voir tous les budgets
                        </Button>
                      </>
                    ) : isImplique ? (
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
              visibles.map((demande) => (
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
                  <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                    {demande.departements && demande.departements.length > 0 ? (
                      <span className="line-clamp-2" title={demande.departements.join(', ')}>{demande.departements.join(', ')}</span>
                    ) : (
                      demande.departement || '-'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(demande.createdAt), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(Number(demande.montantTotal))}</TableCell>
                  <TableCell>
                    {['VALIDATION_PARTIELLE', 'VALIDEE', 'EN_COURS', 'PAYEE'].includes(demande.statut) ? (
                      <div className="space-y-1">
                        <BudgetProgressBar consomme={demande.montantConsomme} prevu={demande.montantPlafond} />
                        {demande.nbDepensesSansJustificatif > 0 && (
                          <p
                            className={cn(
                              'text-xs flex items-center gap-1',
                              demande.nbJustificatifsEnRetard > 0 ? 'text-red-600 font-medium' : 'text-amber-700'
                            )}
                          >
                            <FileWarning className="h-3 w-3" /> {demande.nbDepensesSansJustificatif} sans justificatif
                            {demande.nbJustificatifsEnRetard > 0 ? ` (${demande.nbJustificatifsEnRetard} en retard)` : ''}
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
                  <TableCell>
                    <DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE' || demande.statut === 'EN_PREPARATION'} />
                    {demande.nbLignesACorriger > 0 && (
                      <p className="text-[11px] text-amber-700 mt-1">{demande.nbLignesACorriger} ligne(s) à corriger</p>
                    )}
                    {demande.collectif && (
                      <p className="text-[11px] text-violet-700 mt-1">
                        Collectif{demande.vuePartielle ? ' · vos départements' : ''}
                        {demande.statut === 'EN_PREPARATION' && demande.dateLimiteSaisie
                          ? ` · saisie jusqu'au ${new Date(demande.dateLimiteSaisie).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`
                          : ''}
                      </p>
                    )}
                  </TableCell>
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
