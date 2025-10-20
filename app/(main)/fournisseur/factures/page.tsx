'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { CalendarIcon, Download, Search, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Define the type for a supplier invoice, including the related supplier
interface FactureFournisseur {
  id: string;
  reference: string;
  montant: number;
  date: string;
  status: 'EN_ATTENTE' | 'PAYEE' | 'ANNULEE';
  pieceJointe: string | null;
  fournisseur: Fournisseur;
}

export default function FacturesListPage() {
  const [factures, setFactures] = useState<FactureFournisseur[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [filters, setFilters] = useState({
    fournisseurId: '',
    status: '',
    dateRange: undefined as DateRange | undefined,
  });
  const [loading, setLoading] = useState(true);

  // Fetch all suppliers for the filter dropdown
  useEffect(() => {
    async function fetchFournisseurs() {
      try {
        const res = await fetch("/api/fournisseurs");
        if (!res.ok) throw new Error("Failed to fetch fournisseurs");
        setFournisseurs(await res.json());
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors de la récupération des fournisseurs.");
      }
    }
    fetchFournisseurs();
  }, []);

  // Fetch invoices based on filters
  const fetchFactures = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
    if (filters.status) params.append('status', filters.status);
    if (filters.dateRange?.from) params.append('startDate', filters.dateRange.from.toISOString());
    if (filters.dateRange?.to) params.append('endDate', filters.dateRange.to.toISOString());

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
    setFilters({
      fournisseurId: '',
      status: '',
      dateRange: undefined,
    });
  };

  const handleStatusChange = async (factureId: string, newStatus: FactureFournisseur['status']) => {
      try {
        const response = await fetch(`/api/factures-fournisseurs/${factureId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          throw new Error('Failed to update status');
        }

        setFactures(prevFactures =>
          prevFactures.map(f =>
            f.id === factureId ? { ...f, status: newStatus } : f
          )
        );
        toast.success('Statut mis à jour avec succès !');
      } catch (error) {
        console.error(error);
        toast.error('Erreur lors de la mise à jour du statut.');
      }
    };

  const getStatusVariant = (status: FactureFournisseur['status']) => {
    switch (status) {
      case 'PAYEE': return 'success';
      case 'EN_ATTENTE': return 'brouillon';
      case 'ANNULEE': return 'annuler';
      default: return 'secondary';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Liste des Factures Fournisseurs</h1>
      
      <Card className="mb-8">
        <CardHeader><CardTitle>Filtres</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FournisseurCombobox 
            fournisseurs={fournisseurs}
            value={filters.fournisseurId}
            onChange={(id) => setFilters(prev => ({ ...prev, fournisseurId: id }))}
            onAddNew={() => {}}
          />
          <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EN_ATTENTE">En attente</SelectItem>
              <SelectItem value="PAYEE">Payée</SelectItem>
              <SelectItem value="ANNULEE">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateRange?.from ? (
                  filters.dateRange.to ? (
                    <>{format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}</>
                  ) : (
                    format(filters.dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Choisir une période</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={filters.dateRange} onSelect={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} />
            </PopoverContent>
          </Popover>
          <div className="flex items-end flex-wrap space-x-2">
            <Button onClick={fetchFactures} className="w-full"><Search className="mr-2 h-4 w-4"/>Rechercher</Button>
            <Button onClick={resetFilters} variant="ghost" className="w-full"><X className="mr-2 h-4 w-4"/>Réinitialiser</Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Chargement...</TableCell></TableRow>
            ) : factures.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Aucune facture trouvée.</TableCell></TableRow>
            ) : (
              factures.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell className="font-medium">{facture.fournisseur.entreprise}</TableCell>
                  <TableCell>{facture.reference}</TableCell>
                  <TableCell>{format(new Date(facture.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{new Intl.NumberFormat('fr-FR').format(facture.montant)} XOF</TableCell>
                  <TableCell>
                    <Select value={facture.status} onValueChange={(newStatus: FactureFournisseur['status']) => handleStatusChange(facture.id, newStatus)}>
                      <SelectTrigger className="border-none !bg-transparent p-0 h-auto">
                        <SelectValue asChild>
                           <Badge variant={getStatusVariant(facture.status)} className="cursor-pointer">
                            {facture.status.replace('_', ' ')}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                        <SelectItem value="PAYEE">Payée</SelectItem>
                        <SelectItem value="ANNULEE">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    {facture.pieceJointe && (
                      <Button asChild variant="outline" size="sm">
                        <a href={facture.pieceJointe} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Voir PJ
                        </a>
                      </Button>
                    )}
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
