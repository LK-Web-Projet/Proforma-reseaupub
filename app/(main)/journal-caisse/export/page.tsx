"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Assuming these interfaces from the other page
interface CashJournalEntry {
  id: number;
  date_operation: string;
  libelle: string;
  montant: number;
  type: 'RECETTE' | 'DEPENSE' | 'TRANSFERT';
  solde: number;
  cashRegisterId: number;
  cashRegister: { name:string };
  isApportDeCaisse?: boolean;
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
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });
  const [loading, setLoading] = useState(true);

  // Fetch all data on mount
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
    return result.sort((a, b) => new Date(a.date_operation).getTime() - new Date(b.date_operation).getTime());
  }, [allEntries, selectedCashRegisterId, dateRange]);

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast.warning("Aucune donnée à exporter pour les filtres sélectionnés.");
      return;
    }

    // Prepare data for worksheet
    const dataToExport = filteredEntries.map(entry => ({
      'Date': new Date(entry.date_operation).toLocaleDateString('fr-FR'),
      'Caisse': entry.cashRegister.name,
      'Libellé': entry.libelle,
      'Recettes (FCFA)': entry.type === 'RECETTE' ? entry.montant : '',
      'Dépenses (FCFA)': entry.type === 'DEPENSE' ? entry.montant : '',
    }));

    const totalRecettes = filteredEntries.filter(e => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0);
    const totalDepenses = filteredEntries.filter(e => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0);
    const solde = totalRecettes - totalDepenses;

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Add totals to the worksheet
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['' , '', '', '', ''], // Spacer row
      ['Total Recettes', '', '', totalRecettes, ''],
      ['Total Dépenses', '', '', '', totalDepenses],
      ['Solde de la période', '', '', '', solde],
    ], { origin: -1 });

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Caisse
      { wch: 40 }, // Libellé
      { wch: 15 }, // Recettes
      { wch: 15 }, // Dépenses
    ];

    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Journal de Caisse');

    // Generate and download the Excel file
    const fileName = `Export_Journal_Caisse_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success("Exportation réussie !");
  };
  
  const totalRecettes = useMemo(() => filteredEntries.filter(e => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0), [filteredEntries]);
  const totalDepenses = useMemo(() => filteredEntries.filter(e => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0), [filteredEntries]);
  const solde = useMemo(() => totalRecettes - totalDepenses, [totalRecettes, totalDepenses]);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Exporter le Journal de Caisse</h1>
      
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cash-register-select" className="block text-sm font-medium text-gray-700 mb-1">Caisse</label>
            <Select value={selectedCashRegisterId} onValueChange={setSelectedCashRegisterId}>
              <SelectTrigger id="cash-register-select">
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
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">Du</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? dateRange.from.toLocaleDateString('fr-FR') : <span>Choisir une date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">Au</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.to ? dateRange.to.toLocaleDateString('fr-FR') : <span>Choisir une date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.to}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end mb-4">
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Exporter (Excel)
        </Button>
      </div>

      <Card>
        <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Recettes</TableHead>
                <TableHead className="text-right">Dépenses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement des données...</TableCell></TableRow>
              ) : filteredEntries.length > 0 ? (
                filteredEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date_operation).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{entry.cashRegister.name}</TableCell>
                    <TableCell>{entry.libelle}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {entry.type === 'RECETTE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {entry.type === 'DEPENSE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Aucune écriture à afficher pour les filtres sélectionnés.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-background z-10">
              <TableRow className="bg-secondary">
                <TableCell colSpan={3} className="font-bold">Total Recettes</TableCell>
                <TableCell className="text-right font-bold text-green-600">{totalRecettes.toLocaleString('fr-FR')} FCFA</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow className="bg-secondary">
                <TableCell colSpan={4} className="font-bold">Total Dépenses</TableCell>
                <TableCell className="text-right font-bold text-red-600">{totalDepenses.toLocaleString('fr-FR')} FCFA</TableCell>
              </TableRow>
              <TableRow className="bg-primary-foreground">
                <TableCell colSpan={4} className="font-bold text-lg">Solde de la période</TableCell>
                <TableCell className="text-right font-bold text-lg">{solde.toLocaleString('fr-FR')} FCFA</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
    </div>
  );
}
