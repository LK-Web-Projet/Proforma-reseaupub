"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEntryModal } from '@/components/AddEntryModal';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Wallet, Plus, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CashJournalEntry {
  id: number;
  date_operation: string;
  libelle: string;
  montant: number;
  type: 'RECETTE' | 'DEPENSE' | 'TRANSFERT';
  solde: number;
  cashRegisterId: number;
  cashRegister: { name: string };
  isApportDeCaisse?: boolean; // New field
}

interface CashRegister {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

export default function CashJournalPage() {
  const [allEntries, setAllEntries] = useState<CashJournalEntry[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<number | null>(null);
  const [newRegisterName, setNewRegisterName] = useState('');
  const [isAddingRegister, setIsAddingRegister] = useState(false);
  const [addRegisterModalOpen, setAddRegisterModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/cash-journal');
      const data = await res.json();
      setAllEntries(data.cashJournalEntries || []);
      setCashRegisters(data.cashRegisters || []);
    } catch (error) {
      console.error('Failed to fetch cash journal data:', error);
      toast.error("Échec du chargement des données du journal de caisse.");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredEntries = useMemo(() => {
    if (selectedCashRegisterId === null) {
      return allEntries;
    }
    return allEntries.filter(entry => entry.cashRegisterId === selectedCashRegisterId);
  }, [allEntries, selectedCashRegisterId]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (sortOrder === "desc") {
        return a.id - b.id;
      } else {
        return b.id - a.id;
      }
    });
  }, [filteredEntries, sortOrder]);

  const totalRecettesGlobal = allEntries.filter((e) => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0);
  const totalDepensesGlobal = allEntries.filter((e) => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0);
  const soldeFinalGlobal = totalRecettesGlobal - totalDepensesGlobal;

  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegisterName.trim()) {
      toast.error("Le nom de la caisse ne peut pas être vide.");
      return;
    }

    setIsAddingRegister(true);
    try {
      const res = await fetch('/api/cash-registers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRegisterName }),
      });

      if (res.ok) {
        toast.success("Caisse ajoutée avec succès.");
        setNewRegisterName('');
        setAddRegisterModalOpen(false);
        fetchData(); // Refresh data to show new register
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Échec de l'ajout de la caisse.");
      }
    } catch (error) {
      console.error('Failed to add cash register:', error);
      toast.error("Une erreur est survenue lors de l'ajout de la caisse.");
    } finally {
      setIsAddingRegister(false);
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/cash-journal/recalculate', {
        method: 'POST',
      });

      if (res.ok) {
        toast.success("Recalcul des soldes effectué avec succès.");
        fetchData(); // Refresh data after recalculation
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Échec du recalcul des soldes.");
      }
    } catch (error) {
      console.error('Failed to recalculate cash journal:', error);
      toast.error("Une erreur est survenue lors du recalcul des soldes.");
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="pt-8 ">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Journal de Caisse</h1>
        <div className="flex gap-2 ">
          <Button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            variant="outline"
            className="hidden"
          >
            <RefreshCcw
              className={cn(
                "mr-2 h-4 w-4 hidden",
                isRecalculating && "animate-spin"
              )}
            />
            {isRecalculating ? "Recalcul en cours..." : "Recalculer les soldes"}
          </Button>
          <AddEntryModal
            onEntryAdded={fetchData}
            cashRegisters={cashRegisters}
            selectedCashRegisterId={selectedCashRegisterId}
          />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card
          className={cn(
            "cursor-pointer hover:shadow-lg transition-shadow",
            selectedCashRegisterId === null && "border-2 border-primary"
          )}
          onClick={() => setSelectedCashRegisterId(null)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Global</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {soldeFinalGlobal.toLocaleString("fr-FR")} FCFA
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Recettes: {totalRecettesGlobal.toLocaleString("fr-FR")}</p>
              <p>Dépenses: {totalDepensesGlobal.toLocaleString("fr-FR")}</p>
            </div>
          </CardContent>
        </Card>
        {cashRegisters.map((register) => {
          const registerRecettes = allEntries
            .filter(
              (e) => e.cashRegisterId === register.id && e.type === "RECETTE"
            )
            .reduce((acc, curr) => acc + curr.montant, 0);
          const registerDepenses = allEntries
            .filter(
              (e) => e.cashRegisterId === register.id && e.type === "DEPENSE"
            )
            .reduce((acc, curr) => acc + curr.montant, 0);
          // const registerSolde = registerRecettes - registerDepenses; // This is not needed as register.balance is the source of truth

          return (
            <Card
              key={register.id}
              className={cn(
                "cursor-pointer hover:shadow-lg transition-shadow",
                selectedCashRegisterId === register.id &&
                  "border-2 border-primary"
              )}
              onClick={() => setSelectedCashRegisterId(register.id)}
            >
              <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 ">
                <CardTitle className="text-sm font-medium">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="truncate max-w-[250px] cursor-pointer">
                          {register.name}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p> {register.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {register.balance.toLocaleString("fr-FR")} FCFA
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Recettes: {registerRecettes.toLocaleString("fr-FR")}</p>
                  <p>Dépenses: {registerDepenses.toLocaleString("fr-FR")}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center"
          onClick={() => setAddRegisterModalOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Plus className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Ajouter une caisse</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="overflow-auto max-h-[calc(100vh-250px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                    }
                  >
                    ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Type d&apos;Entrée</TableHead>
                <TableHead className="text-right">Entrée d’argent</TableHead>
                <TableHead className="text-right">Dépense</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : (
                sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.id}</TableCell>
                    <TableCell>
                      {new Date(entry.date_operation).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="truncate max-w-[150px] cursor-pointer">
                              {entry.cashRegister.name}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{entry.cashRegister.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="truncate max-w-[250px] cursor-pointer">
                              {entry.libelle}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{entry.libelle}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {entry.type === "RECETTE"
                        ? entry.isApportDeCaisse
                          ? "Apport de Caisse"
                          : "Recette"
                        : ""}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {entry.type === "RECETTE" || entry.type === "TRANSFERT"
                        ? `${entry.montant.toLocaleString("fr-FR")} FCFA`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {entry.type === "DEPENSE" || entry.type === "TRANSFERT"
                        ? `${entry.montant.toLocaleString("fr-FR")} FCFA`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.solde.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add New Cash Register Modal */}
      <Dialog
        open={addRegisterModalOpen}
        onOpenChange={setAddRegisterModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une nouvelle caisse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddRegister} className="space-y-4">
            <div>
              <label htmlFor="newRegisterName">Nom de la caisse</label>
              <Input
                id="newRegisterName"
                value={newRegisterName}
                onChange={(e) => setNewRegisterName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isAddingRegister}>
              {isAddingRegister ? "Ajout en cours..." : "Ajouter la caisse"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
