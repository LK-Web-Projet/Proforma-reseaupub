"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

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

interface CashRegisterCardProps {
  register: CashRegister;
  entries: CashJournalEntry[];
  isSelected: boolean;
  onClick: () => void;
  onHide?: () => void;
}

export const CashRegisterCard = ({ register, entries, isSelected, onClick, onHide }: CashRegisterCardProps) => {
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
        "cursor-pointer hover:shadow-lg transition-shadow relative group",
        isSelected && "border-2 border-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex-1 mr-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="truncate max-w-[150px] cursor-pointer">
                  {register.name}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p> {register.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <div className="flex items-center gap-2">
          {onHide && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              title="Masquer cette caisse"
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
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
