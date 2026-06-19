"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Calendar as CalendarIcon, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface CashJournalEntry {
  id: number;
  date_operation: string;
  libelle: string;
  montant: number;
  type: 'RECETTE' | 'DEPENSE' | 'TRANSFERT';
  solde: number;
  cashRegisterId: number;
  cashRegister: { name: string };
  isApportDeCaisse?: boolean;
  createdAt: string;
}

interface CashRegister {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

export default function ExportCashJournalPage() {
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [allEntries, setAllEntries] = useState<CashJournalEntry[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [loading, setLoading] = useState(true);
  const [fromMonth, setFromMonth] = useState<Date>(new Date());
  const [toMonth, setToMonth] = useState<Date>(new Date());

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch('/api/cash-journal');
        const data = await res.json();
        setCashRegisters(data.cashRegisters);
        setAllEntries(data.cashJournalEntries);
      } catch (error) {
        console.error('Failed to fetch cash journal data:', error);
        toast.error("Échec du chargement des données.");
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredEntries = useMemo(() => {
    let result = allEntries;

    if (selectedCashRegisterId && selectedCashRegisterId !== 'all') {
      result = result.filter(e => e.cashRegisterId.toString() === selectedCashRegisterId);
    }

    if (dateRange.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(e => new Date(e.date_operation) >= fromDate);
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(e => new Date(e.date_operation) <= toDate);
    }
    return result.sort((a, b) => a.id - b.id);
  }, [allEntries, selectedCashRegisterId, dateRange]);

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast.warning("Aucune donnée à exporter pour les filtres sélectionnés.");
      return;
    }

    const dataToExport = filteredEntries.map(entry => ({
      'ID': entry.id,
      "Date d'opération": new Date(entry.date_operation).toLocaleDateString('fr-FR'),
      'Date de Saisie': entry.createdAt ? new Date(entry.createdAt).toLocaleString('fr-FR') : '',
      'Caisse': entry.cashRegister.name,
      'Libellé': entry.libelle,
      'Recettes (FCFA)': entry.type === 'RECETTE' ? entry.montant : '',
      'Dépenses (FCFA)': entry.type === 'DEPENSE' ? entry.montant : '',
      'Solde (FCFA)': entry.solde,
    }));

    const totalRecettes = filteredEntries.filter(e => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0);
    const totalDepenses = filteredEntries.filter(e => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0);
    const soldeDeLaPeriode = filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].solde : 0;

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['', '', '', '', '', '', '', ''],
      ['Total Recettes', '', '', '', '', totalRecettes, ''],
      ['Total Dépenses', '', '', '', '', '', totalDepenses],
      ['Solde de la période', '', '', '', '', '', '', soldeDeLaPeriode],
    ], { origin: -1 });

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 40 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Journal de Caisse');

    const selectedRegister = cashRegisters.find(r => r.id.toString() === selectedCashRegisterId);
    const registerName = selectedCashRegisterId === 'all' ? 'Tout' : (selectedRegister?.name.replace(/\s+/g, '_') || 'Inconnue');

    const fileName = `Export_Journal_Caisse_${registerName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success("Exportation réussie !");
  };

  const totalRecettes = useMemo(() => filteredEntries.filter(e => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0), [filteredEntries]);
  const totalDepenses = useMemo(() => filteredEntries.filter(e => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0), [filteredEntries]);
  const solde = useMemo(() => {
    if (filteredEntries.length > 0) {
      return filteredEntries[filteredEntries.length - 1].solde;
    }
    return 0;
  }, [filteredEntries]);

  return (
    <div className="p-4 md:p-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Exporter le Journal de Caisse</h1>
        <Button onClick={handleExport} className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exporter (Excel)
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cash-register-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Caisse
            </label>
            <Select value={selectedCashRegisterId} onValueChange={setSelectedCashRegisterId}>
              <SelectTrigger id="cash-register-select" className="w-full">
                <SelectValue placeholder="Toutes les caisses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les caisses</SelectItem>
                {cashRegisters.map(register => (
                  <SelectItem key={register.id} value={register.id.toString()}>
                    {register.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Du
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {dateRange.from ? dateRange.from.toLocaleDateString('fr-FR') : 'Choisir une date'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => {
                    setDateRange(prev => ({ ...prev, from: date }));
                    if (date) setFromMonth(date);
                  }}
                  month={fromMonth}
                  onMonthChange={setFromMonth}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Au
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {dateRange.to ? dateRange.to.toLocaleDateString('fr-FR') : 'Choisir une date'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => {
                    setDateRange(prev => ({ ...prev, to: date }));
                    if (date) setToMonth(date);
                  }}
                  month={toMonth}
                  onMonthChange={setToMonth}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Résumé totaux (cards sur mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Recettes</p>
              <p className="font-bold text-green-600 dark:text-green-400 text-sm sm:text-base truncate">
                {totalRecettes.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Dépenses</p>
              <p className="font-bold text-red-600 dark:text-red-400 text-sm sm:text-base truncate">
                {totalDepenses.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Solde de la période</p>
              <p className={cn(
                "font-bold text-sm sm:text-base truncate",
                solde >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {solde.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vue mobile : cartes */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement des données...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Aucune écriture à afficher pour les filtres sélectionnés.
        </div>
      ) : (
        <>
          {/* Mobile cards (visible uniquement sur petits écrans) */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredEntries.map(entry => (
              <Card key={entry.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  {/* Ligne 1 : ID + Badge type */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-mono">#{entry.id}</span>
                    <Badge
                      variant={entry.type === 'RECETTE' ? 'default' : entry.type === 'DEPENSE' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {entry.type === 'RECETTE'
                        ? entry.isApportDeCaisse ? 'Apport' : 'Recette'
                        : entry.type === 'DEPENSE' ? 'Dépense' : 'Transfert'}
                    </Badge>
                  </div>

                  {/* Ligne 2 : Libellé */}
                  <p className="font-medium text-sm leading-tight">{entry.libelle}</p>

                  {/* Ligne 3 : Caisse */}
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Caisse :</span> {entry.cashRegister.name}
                  </p>

                  {/* Ligne 4 : Dates */}
                  <div className="bg-muted/40 rounded-md p-2 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-foreground shrink-0">Date opé. :</span>
                      <span className="text-xs text-foreground">
                        {new Date(entry.date_operation).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Saisie :
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Ligne 5 : Montant + Solde */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <div>
                      {entry.type === 'RECETTE' || entry.type === 'TRANSFERT' ? (
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          +{entry.montant.toLocaleString('fr-FR')} FCFA
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          -{entry.montant.toLocaleString('fr-FR')} FCFA
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Solde</p>
                      <p className="text-sm font-bold">{entry.solde.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table (caché sur mobile) */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-460px)]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead className="min-w-[180px]">Date Opé. / Saisie</TableHead>
                    <TableHead className="min-w-[120px]">Caisse</TableHead>
                    <TableHead className="min-w-[200px]">Libellé</TableHead>
                    <TableHead className="text-right min-w-[120px]">Recettes</TableHead>
                    <TableHead className="text-right min-w-[120px]">Dépenses</TableHead>
                    <TableHead className="text-right min-w-[120px]">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">{entry.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm" title="Date d'opération">
                            {new Date(entry.date_operation).toLocaleDateString('fr-FR')}
                          </span>
                          <span
                            className="text-xs text-muted-foreground flex items-center gap-1"
                            title="Date de saisie dans le système"
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            Saisie : {new Date(entry.createdAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <span className="truncate block" title={entry.cashRegister.name}>
                          {entry.cashRegister.name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <span className="truncate block" title={entry.libelle}>
                          {entry.libelle}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                        {entry.type === 'RECETTE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">
                        {entry.type === 'DEPENSE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.solde.toLocaleString('fr-FR')} FCFA
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-background z-10">
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">Total Recettes</TableCell>
                    <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                      {totalRecettes.toLocaleString('fr-FR')} FCFA
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} className="font-bold">Total Dépenses</TableCell>
                    <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                      {totalDepenses.toLocaleString('fr-FR')} FCFA
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="font-bold text-base">Solde de la période</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold text-base",
                      solde >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {solde.toLocaleString('fr-FR')} FCFA
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
