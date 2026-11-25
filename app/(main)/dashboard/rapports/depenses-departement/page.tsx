'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Building2, Download, Info, Receipt, TrendingDown, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useDroits } from '@/components/DroitsProvider';
import { VariationMontant } from '@/components/rapports/VariationMontant';
import { categorieLabel } from '@/lib/budgetTypes';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';
import { cn } from '@/lib/utils';
import {
  AUTRES_DEPARTEMENTS,
  classementMois,
  decalerMois,
  evolutionParMois,
  LIBELLES_SOURCE_DEPENSE,
  moisCle,
  repartitionCategories,
  seriesGraphique,
  type RapportDepensesDepartement,
} from '@/lib/depensesDepartement';

const fcfa = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(v);
const fcfaCourt = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v);
const moisLabel = (cle: string) => format(new Date(`${cle}-01T12:00:00`), 'MMMM yyyy', { locale: fr });
const moisCourt = (cle: string) => format(new Date(`${cle}-01T12:00:00`), 'MMM yy', { locale: fr });
const pct = (v: number) => `${Math.round(v * 100)} %`;

export default function DepensesDepartementPage() {
  const { peut } = useDroits();
  const { libelle: libelleMoyen } = useMoyensPaiement();
  const courant = moisCle(new Date());
  const [periode, setPeriode] = useState({ from: decalerMois(courant, -5), to: courant });
  const [moisChoisi, setMoisChoisi] = useState(courant);
  const [departementCategories, setDepartementCategories] = useState('all');
  const [data, setData] = useState<RapportDepensesDepartement | null>(null);
  const [loading, setLoading] = useState(true);
  const [interdit, setInterdit] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rapports/depenses-departement?from=${periode.from}&to=${periode.to}`);
      if (res.status === 403) return void setInterdit(true);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      // Le mois du classement reste dans la période : par défaut le plus récent.
      setMoisChoisi((m) => (json.mois.includes(m) ? m : json.mois[json.mois.length - 1]));
    } catch {
      toast.error('Échec du chargement du rapport.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periode.from, periode.to]);

  useEffect(() => {
    charger();
  }, [charger]);

  const classement = useMemo(() => (data ? classementMois(data, moisChoisi) : null), [data, moisChoisi]);
  const evolution = useMemo(() => (data ? evolutionParMois(data.depenses, data.mois) : new Map<string, Map<string, number>>()), [data]);
  const series = useMemo(() => seriesGraphique(evolution), [evolution]);
  const pointsGraphique = useMemo(() => {
    if (!data) return [];
    const gardes = new Set(series.map((s) => s.nom));
    return data.mois.map((m) => {
      const point: Record<string, string | number> = { mois: moisCourt(m) };
      for (const [dep, parMois] of evolution) {
        const cle = gardes.has(dep) ? dep : AUTRES_DEPARTEMENTS;
        point[cle] = (Number(point[cle]) || 0) + (parMois.get(m) ?? 0);
      }
      return point;
    });
  }, [data, evolution, series]);
  const departementsDuMois = useMemo(() => (classement?.lignes ?? []).filter((l) => l.realise > 0).map((l) => l.departement), [classement]);
  const categories = useMemo(
    () => (data ? repartitionCategories(data.depenses, moisChoisi, departementCategories === 'all' ? null : departementCategories) : []),
    [data, moisChoisi, departementCategories]
  );
  const departementsEvolution = useMemo(
    () =>
      [...evolution.entries()]
        .map(([nom, parMois]) => ({ nom, parMois, total: [...parMois.values()].reduce((s, v) => s + v, 0) }))
        .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr')),
    [evolution]
  );

  const premier = classement?.lignes.find((l) => l.realise > 0);
  const maxRealise = Math.max(1, ...(classement?.lignes ?? []).map((l) => l.realise));
  const nbAncien = useMemo(() => new Set((data?.depenses ?? []).filter((d) => d.source === 'ANCIEN' && data?.mois.includes(d.mois)).map((d) => d.budgetId)).size, [data]);

  const exporter = () => {
    if (!data || !classement) return;
    const affiches = new Set(data.mois);
    const detail = data.depenses.filter((d) => affiches.has(d.mois));
    if (detail.length === 0) return void toast.warning('Aucune dépense à exporter sur cette période.');
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      classeur,
      XLSX.utils.json_to_sheet(
        classement.lignes.map((l) => ({
          Rang: l.rang,
          Département: l.departement,
          'Dépensé (FCFA)': l.realise,
          'Part du mois (%)': Math.round(l.part * 100),
          'Mois précédent (FCFA)': l.precedent,
          'Évolution (%)': l.variation === null ? '' : Math.round(l.variation * 100),
          'Prévu des budgets du mois (FCFA)': l.prevu,
          'Enveloppe mensuelle (FCFA)': l.enveloppe ?? '',
          'Nombre de dépenses': l.nbDepenses,
        }))
      ),
      `Classement ${moisChoisi}`
    );
    XLSX.utils.book_append_sheet(
      classeur,
      XLSX.utils.json_to_sheet([
        ...departementsEvolution.map((d) => ({
          Département: d.nom,
          ...Object.fromEntries(data.mois.map((m) => [moisCourt(m), d.parMois.get(m) ?? 0])),
          'Total (FCFA)': d.total,
        })),
        {
          Département: 'Hors budget (non attribué)',
          ...Object.fromEntries(data.mois.map((m) => [moisCourt(m), data.horsBudget.find((h) => h.mois === m)?.montant ?? 0])),
          'Total (FCFA)': data.horsBudget.reduce((s, h) => s + h.montant, 0),
        },
      ]),
      'Par mois'
    );
    const parCategorie = new Map<string, { Mois: string; Département: string; Catégorie: string; 'Montant (FCFA)': number; 'Nombre de dépenses': number }>();
    for (const d of detail) {
      const cle = `${d.mois}|${d.departement}|${d.categorie ?? ''}`;
      const l = parCategorie.get(cle) ?? { Mois: moisCourt(d.mois), Département: d.departement, Catégorie: categorieLabel(d.categorie), 'Montant (FCFA)': 0, 'Nombre de dépenses': 0 };
      l['Montant (FCFA)'] += d.montant;
      l['Nombre de dépenses'] += 1;
      parCategorie.set(cle, l);
    }
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet([...parCategorie.values()]), 'Par catégorie');
    XLSX.utils.book_append_sheet(
      classeur,
      XLSX.utils.json_to_sheet(
        detail.map((d) => ({
          Date: format(new Date(d.date), 'dd/MM/yyyy'),
          Département: d.departement,
          Budget: d.budgetNumero,
          Ligne: d.ligne,
          Catégorie: categorieLabel(d.categorie),
          Receveur: d.receveur ?? '',
          'Moyen de paiement': d.moyen ? libelleMoyen(d.moyen) : '',
          Origine: LIBELLES_SOURCE_DEPENSE[d.source],
          'Montant (FCFA)': d.montant,
        }))
      ),
      'Détail des dépenses'
    );
    XLSX.writeFile(classeur, `Depenses_par_departement_${data.from}_${data.to}.xlsx`);
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
        <div className="min-w-0">
          <Link href="/dashboard/rapports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux rapports
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Dépenses par département</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Qui dépense le plus, mois par mois. Une dépense compte dans le mois où l&apos;argent est réellement sorti.
          </p>
        </div>
        {peut('dashboard.exporter') && (
          <Button onClick={exporter} className="w-full md:w-auto" disabled={!data || loading}>
            <Download className="mr-2 h-4 w-4" /> Exporter (Excel)
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Du mois</label>
            <Input type="month" value={periode.from} max={periode.to} onChange={(e) => e.target.value && setPeriode((p) => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Au mois</label>
            <Input type="month" value={periode.to} min={periode.from} onChange={(e) => e.target.value && setPeriode((p) => ({ ...p, to: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mois du classement</label>
            <Select value={moisChoisi} onValueChange={setMoisChoisi} disabled={!data}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(data?.mois ?? [moisChoisi]).slice().reverse().map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{moisLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : !data || !classement ? (
        <div className="text-center py-10 text-muted-foreground">Le rapport n&apos;a pas pu être chargé.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-t-4 border-t-red-500">
              <CardContent className="pt-6 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground capitalize">Dépensé en {moisLabel(moisChoisi)}</p>
                  <p className="text-xl font-bold truncate">{fcfa(classement.total)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                    <VariationMontant variation={classement.variation} actuel={classement.total} /> par rapport au mois précédent
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 text-red-700"><TrendingDown className="w-5 h-5" /></div>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-amber-500">
              <CardContent className="pt-6 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Dépense le plus</p>
                  <p className="text-xl font-bold truncate" title={premier?.departement}>{premier?.departement ?? '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {premier ? `${fcfa(premier.realise)} · ${pct(premier.part)} du mois` : 'Aucune dépense ce mois-ci'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><Trophy className="w-5 h-5" /></div>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-blue-500">
              <CardContent className="pt-6 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Départements qui ont dépensé</p>
                  <p className="text-xl font-bold">{departementsDuMois.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{classement.nbDepenses} dépense(s) enregistrée(s)</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Building2 className="w-5 h-5" /></div>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-slate-400">
              <CardContent className="pt-6 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Sorties hors budget</p>
                  <p className="text-xl font-bold truncate">{fcfa(classement.horsBudget)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sorties de caisse sans ligne de budget : aucun département</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 text-slate-700"><Receipt className="w-5 h-5" /></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">Classement — {moisLabel(moisChoisi)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {classement.lignes.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Aucune dépense ni aucun budget sur ce mois.</p>
              ) : (
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 w-12">#</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead className="text-right w-[30%] sm:w-[26%]">Dépensé</TableHead>
                      <TableHead className="text-right hidden md:table-cell w-[14%]">Mois précédent</TableHead>
                      <TableHead className="text-right hidden lg:table-cell w-[14%]">Prévu du mois</TableHead>
                      <TableHead className="text-right hidden xl:table-cell w-[14%] pr-6">Enveloppe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classement.lignes.map((l) => (
                      <TableRow key={l.departement}>
                        <TableCell className="pl-6 font-semibold text-muted-foreground">{l.realise > 0 ? l.rang : '—'}</TableCell>
                        <TableCell className="min-w-0">
                          {l.departementId ? (
                            <Link href={`/fournisseur/departements/${l.departementId}`} className="block truncate font-medium text-primary hover:underline" title={l.departement}>
                              {l.departement}
                            </Link>
                          ) : (
                            <span className="block truncate font-medium" title={l.departement}>{l.departement}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground">{l.nbDepenses} dépense(s)</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold whitespace-nowrap">{fcfa(l.realise)}</span>
                          <div className="mt-1 flex items-center justify-end gap-2">
                            <span className="text-[11px] text-muted-foreground">{pct(l.part)}</span>
                            <div className="h-1.5 w-16 sm:w-24 rounded-full bg-muted overflow-hidden" aria-hidden>
                              <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(l.realise / maxRealise) * 100}%` }} />
                            </div>
                          </div>
                          <div className="md:hidden mt-0.5"><VariationMontant variation={l.variation} actuel={l.realise} /></div>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <span className="block text-sm whitespace-nowrap">{fcfa(l.precedent)}</span>
                          <VariationMontant variation={l.variation} actuel={l.realise} />
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-sm whitespace-nowrap">{l.prevu > 0 ? fcfa(l.prevu) : '—'}</TableCell>
                        <TableCell className="text-right hidden xl:table-cell pr-6 text-sm">
                          {l.enveloppe ? (
                            <>
                              <span className="block whitespace-nowrap">{fcfa(l.enveloppe)}</span>
                              <span className={cn('text-[11px] font-semibold', l.realise > l.enveloppe ? 'text-red-700' : 'text-muted-foreground')}>
                                {Math.round((l.realise / l.enveloppe) * 100)} % utilisé{l.realise > l.enveloppe ? ' — dépassée' : ''}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="pl-6" />
                      <TableCell className="font-semibold">Total des départements</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{fcfa(classement.total)}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <span className="block text-sm whitespace-nowrap">{fcfa(classement.totalPrecedent)}</span>
                        <VariationMontant variation={classement.variation} actuel={classement.total} />
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm whitespace-nowrap">
                        {fcfa(classement.lignes.reduce((s, l) => s + l.prevu, 0))}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell pr-6" />
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Évolution mois par mois</CardTitle>
              <p className="text-xs text-muted-foreground">Dépensé par département, empilé : la hauteur d&apos;une barre est le total du mois.</p>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune dépense sur cette période.</p>
              ) : (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pointsGraphique} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="mois" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fcfaCourt(Number(v))} width={48} />
                      <Tooltip formatter={(value, name) => [fcfa(Number(value)), String(name)]} cursor={{ fill: 'rgba(148,163,184,0.15)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {series.map((s, i) => (
                        <Bar
                          key={s.nom}
                          dataKey={s.nom}
                          name={s.nom}
                          stackId="mois"
                          fill={s.couleur}
                          stroke="#ffffff"
                          strokeWidth={2}
                          radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                          maxBarSize={56}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
            {departementsEvolution.length > 0 && (
              <CardContent className="p-0 border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Département</TableHead>
                      {data.mois.map((m) => (
                        <TableHead key={m} className="text-right capitalize whitespace-nowrap">{moisCourt(m)}</TableHead>
                      ))}
                      <TableHead className="text-right pr-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departementsEvolution.map((d) => (
                      <TableRow key={d.nom}>
                        <TableCell className="pl-6 font-medium whitespace-nowrap">{d.nom}</TableCell>
                        {data.mois.map((m) => (
                          <TableCell key={m} className={cn('text-right text-sm whitespace-nowrap', m === moisChoisi && 'bg-muted/40')}>
                            {d.parMois.get(m) ? fcfaCourt(d.parMois.get(m)!) : '—'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right pr-6 font-semibold whitespace-nowrap">{fcfaCourt(d.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
              <CardTitle className="text-base capitalize">Par catégorie — {moisLabel(moisChoisi)}</CardTitle>
              <Select value={departementCategories} onValueChange={setDepartementCategories}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  {departementsDuMois.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune dépense pour ce choix.</p>
              ) : (
                <ul className="space-y-3">
                  {categories.map((c) => (
                    <li key={c.categorie ?? '__aucune__'} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{categorieLabel(c.categorie)}</span>
                        <span className="shrink-0 font-semibold whitespace-nowrap">
                          {fcfa(c.montant)} <span className="text-xs font-normal text-muted-foreground">· {pct(c.part)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
                        <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${c.part * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2 rounded-md border bg-slate-50 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Dépensé</strong> : dépenses non annulées, comptées à leur date de sortie, sur le département de la ligne de budget (même si le budget
                appartient à un autre mois). <strong>Prévu du mois</strong> : montants accordés (et dépassements approuvés) des budgets de ce mois.{' '}
                <strong>Enveloppe</strong> : montant mensuel indicatif saisi sur la fiche du département.
              </p>
              {nbAncien > 0 && <p>{nbAncien} budget(s) payé(s) avant le suivi des dépenses : leur montant accordé est compté à la date de paiement.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
