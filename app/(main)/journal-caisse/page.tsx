"use client";

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEntryModal } from '@/components/AddEntryModal';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Wallet, Plus, RefreshCcw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CashRegisterCard } from '@/components/CashRegisterCard';
import { AddCashRegisterModal } from '@/components/AddCashRegisterModal';


import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UploadAttachmentModal } from '@/components/UploadAttachmentModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  attachments: {
    id: string;
    url: string;
    fileName: string;
  }[];
  createdAt: string;
  lotPaiement?: {
    reference: string;
    referenceOperateur: string | null;
    campagneNom: string | null;
    nbBeneficiaires: number;
    detail: { numero?: number; beneficiaire: string; numeroMomo?: string; typePaiement?: string; reference?: string; montant: number }[];
  } | null;
}

interface CashRegister {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
  view: boolean;
}

export default function CashJournalPage() {
  const [allEntries, setAllEntries] = useState<CashJournalEntry[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [addRegisterModalOpen, setAddRegisterModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Droit « Saisir au journal de caisse » (Paramètres > Rôles) : sans lui, consultation seule.
  // Le serveur reste juge (403) ; ceci ne fait que masquer les boutons inutilisables.
  const [peutSaisir, setPeutSaisir] = useState(false);

  useEffect(() => {
    fetch('/api/demandes-budget/me-role')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPeutSaisir(!!data?.canSaisirCaisse))
      .catch(() => setPeutSaisir(false));
  }, []);


  const toggleRegisterVisibility = async (register: CashRegister) => {
    try {
      const newViewStatus = !register.view;
      const res = await fetch(`/api/cash-registers/${register.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ view: newViewStatus }),
      });

      if (res.ok) {
        setCashRegisters(prev =>
          prev.map(r => r.id === register.id ? { ...r, view: newViewStatus } : r)
        );
        toast.success(`Visibilité de la caisse "${register.name}" mise à jour.`);
      } else {
        toast.error("Échec de la mise à jour de la visibilité.");
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
      toast.error("Une erreur est survenue.");
    }
  };

  async function fetchData(currentYear: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/cash-journal?year=${currentYear}`);
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
    if (year) {
      fetchData(year);
    }
  }, [year]);

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

  const { totalRecettesGlobal, totalDepensesGlobal, soldeFinalGlobal } = useMemo(() => {
    // Compute totals taking into account only visible cash registers and treating transfers as internal when both sides are visible
    const visibleIds = new Set(cashRegisters.filter(r => r.view).map(r => r.id));

    let totalRecettes = 0;
    let totalDepenses = 0;

    for (const e of allEntries) {
      // only consider entries belonging to visible registers
      if (!visibleIds.has(e.cashRegisterId)) continue;

      if (e.type === 'RECETTE') {
        // Detect transfer-generated recette: "Transfert depuis caisse ID X: ..."
        const m = e.libelle.match(/Transfert depuis caisse ID (\d+)/i);
        if (m) {
          const sourceId = parseInt(m[1], 10);
          // include only if source is NOT visible (external incoming)
          if (!visibleIds.has(sourceId)) totalRecettes += e.montant;
        } else {
          totalRecettes += e.montant;
        }
      } else if (e.type === 'DEPENSE') {
        // Detect transfer-generated depense: "Transfert vers caisse ID X: ..."
        const m = e.libelle.match(/Transfert vers caisse ID (\d+)/i);
        if (m) {
          const destId = parseInt(m[1], 10);
          // include only if destination is NOT visible (external outgoing)
          if (!visibleIds.has(destId)) totalDepenses += e.montant;
        } else {
          totalDepenses += e.montant;
        }
      }
    }

    // Solde global = sum of balances of visible registers (this matches the cards display)
    const solde = cashRegisters.filter(r => r.view).reduce((acc, r) => acc + (r.balance || 0), 0);

    return { totalRecettesGlobal: totalRecettes, totalDepensesGlobal: totalDepenses, soldeFinalGlobal: solde };
  }, [allEntries, cashRegisters]);



  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/cash-journal/recalculate', {
        method: 'POST',
      });

      if (res.ok) {
        toast.success("Recalcul des soldes effectué avec succès.");
        fetchData(year); // Refresh data after recalculation
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

  const visibleRegisters = useMemo(() => {
    return cashRegisters.filter(r => r.view);
  }, [cashRegisters]);

  // Replace transfer libelle IDs with register names for display
  const getReadableLibelle = (libelle: string) => {
    try {
      // Matches patterns like: "Transfert vers caisse ID 5: ..." or "Transfert depuis caisse ID 3: ..."
      const re = /(Transfert (?:vers|depuis) caisse ID )([0-9]+)(: ?)(.*)/i;
      const m = libelle.match(re);
      if (m) {
        const id = parseInt(m[2], 10);
        const reg = cashRegisters.find(r => r.id === id);
        if (reg) {
          return `${m[1]}${reg.name}${m[3]}${m[4]}`;
        }
      }
    } catch {
      // ignore and return original
    }
    return libelle;
  };

  return (
    <div className="pt-8 ">
       <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Journal de Caisse</h1>
          <div>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm p-2"
              title="Sélectionnez une année"
            >
              <option value="2030">2030</option>
              <option value="2029">2029</option>
              <option value="2028">2028</option>
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 ">
          {peutSaisir && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Gérer la visibilité des caisses">
                <Eye className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium leading-none mb-2">Visibilité des caisses</h4>
                {cashRegisters.map((register) => (
                  <div key={register.id} className="flex items-center justify-between py-1">
                    <span className="text-sm truncate mr-2">{register.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleRegisterVisibility(register)}
                    >
                      {!register.view ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
                {cashRegisters.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune caisse disponible</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          )}

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
          {peutSaisir ? (
            <AddEntryModal
              onEntryAdded={() => fetchData(year)}
              cashRegisters={cashRegisters}
              selectedCashRegisterId={selectedCashRegisterId}
            />
          ) : (
            <p className="text-xs text-muted-foreground self-center max-w-[260px]">
              Consultation seule : les sorties d&apos;argent passent par le circuit budget.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card
          className={cn(
            "cursor-pointer hover:shadow-lg transition-shadow",
            selectedCashRegisterId === null && "border-2 border-primary"
          )}
          onClick={() => startTransition(() => setSelectedCashRegisterId(null))}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Global ({year})</CardTitle>
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
        {visibleRegisters.map((register) => (
          <CashRegisterCard
            key={register.id}
            register={register}
            entries={allEntries}
            isSelected={selectedCashRegisterId === register.id}
            onClick={() => startTransition(() => setSelectedCashRegisterId(register.id))}
            onHide={peutSaisir ? () => toggleRegisterVisibility(register) : undefined}
          />
        ))}
        {peutSaisir && (
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow flex items-center justify-center"
          onClick={() => setAddRegisterModalOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Plus className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Ajouter une caisse</p>
          </CardContent>
        </Card>
        )}
      </div>

      <Card>
        <div className="px-4 py-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-green-600 rounded-sm"></span>
              <span>Recette (vert)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-red-600 rounded-sm"></span>
              <span>Dépense (rouge)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded-sm"></span>
              <span>Approvisionnement (bleu)</span>
            </div>
          </div>
        <div className="relative">
          {isPending && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20">
              <RefreshCcw className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
          <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
          <Table className="min-w-[700px] w-full">
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
                <TableHead>Date Opé. / Saisie</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Type d&apos;Entrée</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="hidden md:table-cell">Fichier📄</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : (
                sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.id}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col text-xs md:text-sm gap-0.5">
                        <span className="font-semibold" title="Date d'opération">
                          {new Date(entry.date_operation).toLocaleString("fr-FR")}
                        </span>
                        <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1" title="Date de saisie dans le système">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Saisie : {new Date(entry.createdAt).toLocaleString("fr-FR")}
                        </span>
                      </div>
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
                              {getReadableLibelle(entry.libelle)}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getReadableLibelle(entry.libelle)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {entry.lotPaiement && (
                        <details className="mt-1 text-xs max-w-[340px]">
                          <summary className="cursor-pointer text-primary">
                            Lot {entry.lotPaiement.reference} — {entry.lotPaiement.nbBeneficiaires} prestataire(s)
                            {entry.lotPaiement.referenceOperateur ? ` · réf. ${entry.lotPaiement.referenceOperateur}` : ''}
                          </summary>
                          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                            {entry.lotPaiement.detail.map((l, i) => (
                              <li key={l.reference ?? i} className="flex justify-between gap-2">
                                <span className="truncate">
                                  {l.beneficiaire}{l.numeroMomo ? ` · ${l.numeroMomo}` : ''}{l.typePaiement ? ` · ${l.typePaiement.toLowerCase()}` : ''}
                                </span>
                                <span className="whitespace-nowrap">{Number(l.montant).toLocaleString('fr-FR')}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {entry.type === "RECETTE"
                        ? entry.isApportDeCaisse
                          ? "Apport de Caisse"
                          : "Recette"
                        : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.type === "RECETTE" ? (
                        entry.isApportDeCaisse ? (
                          <span className="text-blue-600 font-bold">{`+${entry.montant.toLocaleString("fr-FR")} FCFA`}</span>
                        ) : (
                          <span className="text-green-600 font-bold">{`+${entry.montant.toLocaleString("fr-FR")} FCFA`}</span>
                        )
                      ) : entry.type === "DEPENSE" ? (
                        <span className="text-red-600 font-bold">{`-${entry.montant.toLocaleString("fr-FR")} FCFA`}</span>
                      ) : entry.type === "TRANSFERT" ? (
                        <span className="text-purple-600 font-bold">{`${entry.montant.toLocaleString("fr-FR")} FCFA`}</span>
                      ) : (
                        ''
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.solde.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {entry.attachments && entry.attachments.length > 0 ? (
                        <div className="flex flex-col">
                          {entry.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline truncate max-w-[120px]"
                            >
                              {att.fileName}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <UploadAttachmentModal cashJournalId={entry.id} onUploadComplete={() => fetchData(year)} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </div>
      </Card>

      <AddCashRegisterModal open={addRegisterModalOpen} onOpenChange={setAddRegisterModalOpen} onRegisterAdded={() => fetchData(year)} />
    </div>
  );
}
