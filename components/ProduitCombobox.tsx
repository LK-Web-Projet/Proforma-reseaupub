'use client';

import * as React from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface Produit {
  id: string;
  nom: string;
  prixUnitaire: number;
  actif: boolean;
}

const formatPrix = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(value);

interface ProduitComboboxProps {
  produits: Produit[];
  value: string; // produitId
  onChange: (value: string) => void;
  onAddNew: () => void;
}

export function ProduitCombobox({
  produits,
  value,
  onChange,
  onAddNew,
}: ProduitComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedProduit = produits.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selectedProduit ? selectedProduit.nom : "Sélectionner un produit"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un produit..." />
          <CommandList>
            <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
            <CommandGroup>
              {produits.map((produit) => (
                <CommandItem
                  key={produit.id}
                  value={produit.nom}
                  onSelect={() => {
                    onChange(produit.id === value ? "" : produit.id);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center min-w-0">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === produit.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{produit.nom}</span>
                    {!produit.actif && (
                      <Badge variant="outline" className="ml-2 shrink-0 font-normal text-muted-foreground">
                        Inactif
                      </Badge>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatPrix(produit.prixUnitaire)}
                  </span>
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onAddNew();
                }}
                className="cursor-pointer"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Nouveau produit
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
