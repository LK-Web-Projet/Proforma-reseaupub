"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  isApportDeCaisse?: boolean;
}

interface CashRegister {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

interface CashRegisterCardProps {
  register: CashRegister;
  entries: CashJournalEntry[];
  isSelected: boolean;
  onClick: () => void;
}

export const CashRegisterCard = ({ register, entries, isSelected, onClick }: CashRegisterCardProps) => {
  const { registerRecettes, registerDepenses } = useMemo(() => {
    const registerRecettes = entries
      .filter((e) => e.cashRegisterId === register.id && e.type === "RECETTE")
      .reduce((acc, curr) => acc + curr.montant, 0);
    const registerDepenses = entries
      .filter((e) => e.cashRegisterId === register.id && e.type === "DEPENSE")
      .reduce((acc, curr) => acc + curr.montant, 0);
    return { registerRecettes, registerDepenses };
  }, [entries, register.id]);

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-lg transition-shadow",
        isSelected && "border-2 border-primary"
      )}
      onClick={onClick}
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
};
