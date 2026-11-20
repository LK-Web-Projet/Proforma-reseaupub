'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, ArrowLeftRight, Calendar as CalendarIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeeklyTreasuryChart, type WeeklyTreasuryPoint } from '@/components/dashboard/WeeklyTreasuryChart';
import { useDroits } from '@/components/DroitsProvider';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

export default function TresorerieHebdomadairePage() {
  const { peut } = useDroits();
  const [weeks, setWeeks] = useState<WeeklyTreasuryPoint[] | null>(null);
  const [autresMouvementsTotal, setAutresMouvementsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from.toISOString());
      if (dateRange.to) params.set('to', dateRange.to.toISOString());
      const res = await fetch(`/api/rapports/tresorerie-hebdomadaire?${params.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWeeks(data.weeks);
      setAutresMouvementsTotal(data.autresMouvementsTotal ?? 0);
    } catch {
      toast.error('Échec du chargement du rapport.');
      setWeeks(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = () => {
    if (!weeks || weeks.length === 0) {
      toast.warning('Aucune donnée à exporter pour la période sélectionnée.');
      return;
    }
    const rows = weeks.map((w) => ({
      Semaine: w.weekLabel,
      'Recettes (FCFA)': w.recettes,
      'Dépenses (FCFA)': w.depenses,
      'Proformas validées (FCFA)': w.proformasValidees,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trésorerie hebdomadaire');
    XLSX.writeFile(workbook, `Tresorerie_Hebdomadaire_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exportation réussie !');
  };

  const totaux = weeks?.reduce(
    (acc, w) => ({
      recettes: acc.recettes + w.recettes,
      depenses: acc.depenses + w.depenses,
      proformasValidees: acc.proformasValidees + w.proformasValidees,
    }),
    { recettes: 0, depenses: 0, proformasValidees: 0 }
  );

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b">
        <div>
          <Link href="/dashboard/rapports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux rapports
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Trésorerie hebdomadaire</h1>
          <p className="text-sm text-muted-foreground mt-1">Recettes, dépenses et proformas validées, semaine par semaine.</p>
        </div>
        {peut("dashboard.exporter") && (
        <Button onClick={handleExport} className="w-full md:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exporter (Excel)
        </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Période (par défaut : 12 dernières semaines)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Du (début de semaine)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateRange.from && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{dateRange.from ? dateRange.from.toLocaleDateString('fr-FR') : 'Choisir une date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Au</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateRange.to && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{dateRange.to ? dateRange.to.toLocaleDateString('fr-FR') : 'Choisir une date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement des données...</div>
      ) : !weeks || weeks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Aucune donnée pour la période sélectionnée.</div>
      ) : (
        <>
          <WeeklyTreasuryChart data={weeks} formatCurrency={formatCurrency} />

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            Autres mouvements de caisse (apports, transferts entre caisses — hors chiffre d&apos;affaires) sur la période :{' '}
            <span className="font-medium text-foreground">{formatCurrency(autresMouvementsTotal)}</span>
          </p>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semaine</TableHead>
                    <TableHead className="text-right">Recettes</TableHead>
                    <TableHead className="text-right">Dépenses</TableHead>
                    <TableHead className="text-right">Proformas validées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((w) => (
                    <TableRow key={w.weekStart}>
                      <TableCell className="font-medium">{w.weekLabel}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(w.recettes)}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">{formatCurrency(w.depenses)}</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">{formatCurrency(w.proformasValidees)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {totaux && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(totaux.recettes)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(totaux.depenses)}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totaux.proformasValidees)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
