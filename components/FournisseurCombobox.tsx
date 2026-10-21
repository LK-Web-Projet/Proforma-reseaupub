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
import { TYPE_FOURNISSEUR_COLORS, resolveTypeFournisseur } from "@/lib/typeFournisseur";
import type { Fournisseur } from "@/components/FournisseurModal";

export type { Fournisseur };

interface FournisseurComboboxProps {
  fournisseurs: Fournisseur[];
  value: string; // Should be the ID of the fournisseur
  onChange: (value: string) => void;
  onAddNew: () => void;
}

export function FournisseurCombobox({
  fournisseurs,
  value,
  onChange,
  onAddNew,
}: FournisseurComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedFournisseur = fournisseurs.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedFournisseur
            ? selectedFournisseur.entreprise
            : "Sélectionner un prestataire"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un prestataire..." />
          <CommandList>
            <CommandEmpty>Aucun prestataire trouvé.</CommandEmpty>
            <CommandGroup>
              {fournisseurs.map((fournisseur) => {
                const type = resolveTypeFournisseur(fournisseur.typeFournisseur);
                return (
                  <CommandItem
                    key={fournisseur.id}
                    value={fournisseur.entreprise} // Search by entreprise name
                    onSelect={() => {
                      onChange(fournisseur.id === value ? "" : fournisseur.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === fournisseur.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {fournisseur.entreprise}
                    </span>
                    <Badge variant="outline" className={cn("font-normal shrink-0", TYPE_FOURNISSEUR_COLORS[type])}>
                      {type}
                    </Badge>
                  </CommandItem>
                );
              })}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onAddNew();
                }}
                className="cursor-pointer"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Nouveau prestataire
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
