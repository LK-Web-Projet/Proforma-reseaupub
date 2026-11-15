'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import {
  TYPE_BUDGET_VALUES,
  TYPE_BUDGET_META,
  typeBudgetLabel,
  CATEGORIE_DEPENSE_VALUES,
  CATEGORIE_DEPENSE_LABELS,
  categorieLabel,
  modePaiementLabel,
} from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { ArrowLeft, Download, Wallet, TrendingDown, TrendingUp, Percent } from 'lucide-react';

interface Ligne {
  mois: string;
  demandeId: string;
  numero: string;
  type: string;
  statut: string;
  departement: string;
  designation: string;
  categorie: string | null;
  modePaiement: string;
  demande: number;
  prevu: number;
  depassements: number;
  plafond: number;
  realise: number;
  ancienCircuit: boolean;
}

interface Groupe {
  cle: string;
  libelle: string;
  prevu: number;
  depassements: number;
  plafond: number;
  realise: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

const moisLabel = (cle: string) => format(new Date(`${cle}-01T12:00:00`), 'MMM yyyy', { locale: fr });

const moisCourant = () => new Date().toISOString().slice(0, 7);
const moisIlYa = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
};

function grouper(lignes: Ligne[], cleDe: (l: Ligne) => string, libelleDe: (cle: string) => string): Groupe[] {
  const map = new Map<string, Groupe>();
  for (const l of lignes) {
    const cle = cleDe(l);
    const g = map.get(cle) ?? { cle, libelle: libelleDe(cle), prevu: 0, depassements: 0, plafond: 0, realise: 0 };
    g.prevu += l.prevu;
    g.depassements += l.depassements;
    g.plafond += l.plafond;
    g.realise += l.realise;
    map.set(cle, g);
  }
  return Array.from(map.values());
}

const taux = (realise: number, plafond: number) => (plafond > 0 ? Math.round((realise / plafond) * 100) : 0);

function GroupeTable({ titre, groupes }: { titre: string; groupes: Groupe[] }) {
  const total = groupes.reduce(
    (acc, g) => ({ prevu: acc.prevu + g.prevu, depassements: acc.depassements + g.depassements, plafond: acc.plafond + g.plafond, realise: acc.realise + g.realise }),
    { prevu: 0, depassements: 0, plafond: 0, realise: 0 }
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titre}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">{titre.replace('Par ', '').replace(/^./, (c) => c.toUpperCase())}</TableHead>
              <TableHead className="text-right">Prévu</TableHead>
              <TableHead className="text-right">Dépassements</TableHead>
              <TableHead className="text-right">Réalisé</TableHead>
              <TableHead className="text-right">Écart</TableHead>
              <TableHead className="min-w-[130px] pr-6">Consommation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupes
              .slice()
              .sort((a, b) => b.plafond - a.plafond)
              .map((g) => (
                <TableRow key={g.cle}>
                  <TableCell className="pl-6 font-medium">{g.libelle}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(g.prevu)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap', g.depassements > 0 && 'text-orange-700')}>
                    {g.depassements > 0 ? `+ ${formatCurrency(g.depassements)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(g.realise)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap', g.plafond - g.realise < 0 ? 'text-red-600' : 'text-green-700')}>
                    {formatCurrency(g.plafond - g.realise)}
                  </TableCell>
                  <TableCell className="pr-6">
                    <BudgetProgressBar consomme={g.realise} prevu={g.plafond} compact />
                    <span className="text-[11px] text-muted-foreground">{taux(g.realise, g.plafond)} %</span>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-6 font-bold">Total</TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">{formatCurrency(total.prevu)}</TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">{total.depassements > 0 ? `+ ${formatCurrency(total.depassements)}` : '—'}</TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">{formatCurrency(total.realise)}</TableCell>
              <TableCell className="text-right font-bold whitespace-nowrap">{formatCurrency(total.plafond - total.realise)}</TableCell>
              <TableCell className="pr-6 font-bold">{taux(total.realise, total.plafond)} %</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function SuiviBudgetairePage() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [interdit, setInterdit] = useState(false);
  const [filters, setFilters] = useState({ from: moisIlYa(5), to: moisCourant(), type: 'all', departement: 'all', categorie: 'all' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: filters.from, to: filters.to });
      if (filters.type !== 'all') params.set('type', filters.type);
      if (filters.categorie !== 'all') params.set('categorie', filters.categorie);
      const res = await fetch(`/api/rapports/suivi-budgetaire?${params.toString()}`);
      if (res.status === 403) {
        setInterdit(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLignes(data.lignes);
    } catch {
      toast.error('Échec du chargement du rapport.');
      setLignes(null);
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.type, filters.categorie]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Le filtre service est appliqué côté page : la liste des services vient des données chargées.
  const services = useMemo(() => Array.from(new Set((lignes ?? []).map((l) => l.departement))).sort(), [lignes]);
  const lignesFiltrees = useMemo(
    () => (lignes ?? []).filter((l) => filters.departement === 'all' || l.departement === filters.departement),
    [lignes, filters.departement]
  );

  const parMois = useMemo(
    () => grouper(lignesFiltrees, (l) => l.mois, moisLabel).sort((a, b) => a.cle.localeCompare(b.cle)),
    [lignesFiltrees]
  );
  const parService = useMemo(() => grouper(lignesFiltrees, (l) => l.departement, (c) => c), [lignesFiltrees]);
  const parCategorie = useMemo(
    () => grouper(lignesFiltrees, (l) => l.categorie ?? '__aucune__', (c) => categorieLabel(c === '__aucune__' ? null : c)),
    [lignesFiltrees]
  );

  // Procédure de paiement (section 4) : total prévu / réalisé par moyen de paiement.
  const parModePaiement = useMemo(
    () => grouper(lignesFiltrees, (l) => l.modePaiement, (m) => modePaiementLabel(m)),
    [lignesFiltrees]
  );

  const totaux = useMemo(
    () =>
      lignesFiltrees.reduce(
        (acc, l) => ({ prevu: acc.prevu + l.prevu, depassements: acc.depassements + l.depassements, plafond: acc.plafond + l.plafond, realise: acc.realise + l.realise }),
        { prevu: 0, depassements: 0, plafond: 0, realise: 0 }
      ),
    [lignesFiltrees]
  );
  const nbAncienCircuit = useMemo(() => new Set(lignesFiltrees.filter((l) => l.ancienCircuit).map((l) => l.demandeId)).size, [lignesFiltrees]);

  const handleExport = () => {
    if (lignesFiltrees.length === 0) {
      toast.warning('Aucune donnée à exporter pour ces filtres.');
      return;
    }
    const versFeuille = (groupes: Groupe[], colonne: string) =>
      groupes.map((g) => ({
        [colonne]: g.libelle,
        'Prévu (FCFA)': g.prevu,
        'Dépassements (FCFA)': g.depassements,
        'Plafond (FCFA)': g.plafond,
        'Réalisé (FCFA)': g.realise,
        'Écart (FCFA)': g.plafond - g.realise,
        'Consommation (%)': taux(g.realise, g.plafond),
      }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versFeuille(parMois, 'Mois')), 'Par mois');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versFeuille(parService, 'Service')), 'Par service');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versFeuille(parCategorie, 'Catégorie')), 'Par catégorie');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versFeuille(parModePaiement, 'Moyen de paiement')), 'Par moyen');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        lignesFiltrees.map((l) => ({
          Mois: moisLabel(l.mois),
          Budget: l.numero,
          Type: typeBudgetLabel(l.type),
          Service: l.departement,
          Ligne: l.designation,
          Catégorie: categorieLabel(l.categorie),
          'Moyen de paiement': modePaiementLabel(l.modePaiement),
          'Demandé (FCFA)': l.demande,
          'Accordé (FCFA)': l.prevu,
          'Dépassements (FCFA)': l.depassements,
          'Réalisé (FCFA)': l.realise,
          'Écart (FCFA)': l.plafond - l.realise,
          Remarque: l.ancienCircuit ? 'Payée avant le suivi par dépenses (réalisé = prévu)' : '',
        }))
      ),
      'Détail'
    );
    XLSX.writeFile(workbook, `Suivi_Budgetaire_${filters.from}_${filters.to}.xlsx`);
    toast.success('Exportation réussie !');
  };

  if (interdit) {
    return (
      <div className="container mx-auto py-20 text-center text-muted-foreground">
        Ce rapport est réservé aux rôles du circuit budget (validation ou enregistrement des dépenses).
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b">
        <div>
          <Link href="/dashboard/rapports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux rapports
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Suivi budgétaire</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prévu vs réalisé des budgets validés, par mois, par service et par catégorie de dépense.
          </p>
        </div>
        <Button onClick={handleExport} className="w-full md:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exporter (Excel)
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Du mois</label>
            <Input type="month" value={filters.from} max={filters.to} onChange={(e) => e.target.value && setFilters((p) => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Au mois</label>
            <Input type="month" value={filters.to} min={filters.from} onChange={(e) => e.target.value && setFilters((p) => ({ ...p, to: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <Select value={filters.type} onValueChange={(v) => setFilters((p) => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {TYPE_BUDGET_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_BUDGET_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Service</label>
            <Select value={filters.departement} onValueChange={(v) => setFilters((p) => ({ ...p, departement: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les services</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catégorie</label>
            <Select value={filters.categorie} onValueChange={(v) => setFilters((p) => ({ ...p, categorie: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {CATEGORIE_DEPENSE_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>
                ))}
                <SelectItem value="__aucune__">Non catégorisé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement des données...</div>
      ) : lignesFiltrees.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Aucun budget validé sur cette période pour ces filtres.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { titre: 'Prévu', valeur: formatCurrency(totaux.prevu), sous: totaux.depassements > 0 ? `+ ${formatCurrency(totaux.depassements)} de dépassements` : 'Aucun dépassement', icon: Wallet, couleur: 'bg-blue-100 text-blue-700' },
              { titre: 'Réalisé', valeur: formatCurrency(totaux.realise), sous: 'Dépenses non annulées', icon: TrendingDown, couleur: 'bg-red-100 text-red-700' },
              { titre: 'Écart', valeur: formatCurrency(totaux.plafond - totaux.realise), sous: totaux.plafond - totaux.realise >= 0 ? 'Non consommé' : 'Au-delà du plafond', icon: TrendingUp, couleur: 'bg-green-100 text-green-700' },
              { titre: 'Taux de consommation', valeur: `${taux(totaux.realise, totaux.plafond)} %`, sous: 'Réalisé / (prévu + dépassements)', icon: Percent, couleur: 'bg-slate-100 text-slate-700' },
            ].map((k) => (
              <Card key={k.titre}>
                <CardContent className="pt-6 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{k.titre}</p>
                    <p className="text-xl font-bold">{k.valeur}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{k.sous}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl', k.couleur)}><k.icon className="w-5 h-5" /></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {nbAncienCircuit > 0 && (
            <p className="text-xs text-muted-foreground">
              {nbAncienCircuit} budget(s) payé(s) avant le suivi par dépenses : leur réalisé est compté égal au prévu.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prévu vs réalisé par mois</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parMois}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="libelle" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="plafond" name="Prévu (avec dépassements)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realise" name="Réalisé" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GroupeTable titre="Par service" groupes={parService} />
            <GroupeTable titre="Par catégorie" groupes={parCategorie} />
            <GroupeTable titre="Par moyen de paiement" groupes={parModePaiement} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Détail des lignes</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Mois</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Ligne</TableHead>
                    <TableHead className="text-right">Plafond</TableHead>
                    <TableHead className="text-right">Réalisé</TableHead>
                    <TableHead className="text-right pr-6">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignesFiltrees.map((l, i) => (
                    <TableRow key={`${l.demandeId}-${i}`}>
                      <TableCell className="pl-6 whitespace-nowrap capitalize">{moisLabel(l.mois)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/budget/demandes/${l.demandeId}`} className="text-primary hover:underline font-mono text-xs">{l.numero}</Link>
                        <Badge variant="outline" className={cn('ml-1.5 text-[10px] font-normal', TYPE_BUDGET_META[l.type as keyof typeof TYPE_BUDGET_META]?.className)}>
                          {typeBudgetLabel(l.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{l.departement}</TableCell>
                      <TableCell className="text-sm">
                        {l.designation}
                        <p className="text-[11px] text-muted-foreground">{categorieLabel(l.categorie)}</p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(l.plafond)}
                        {l.depassements > 0 && <p className="text-[11px] text-orange-700">dont + {formatCurrency(l.depassements)}</p>}
                        {l.demande > l.prevu && <p className="text-[11px] text-muted-foreground">demandé {formatCurrency(l.demande)}</p>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(l.realise)}
                        {l.ancienCircuit && <p className="text-[11px] text-muted-foreground">ancien circuit</p>}
                      </TableCell>
                      <TableCell className={cn('text-right whitespace-nowrap pr-6', l.plafond - l.realise < 0 ? 'text-red-600' : 'text-green-700')}>
                        {formatCurrency(l.plafond - l.realise)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
