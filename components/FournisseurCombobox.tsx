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

// Using the same type definition as in the FournisseurModal
export type Fournisseur = {
  id: string;
  nom: string | null;
  prenom: string | null;
  entreprise: string;
  email: string;
  contact: string;
  domaineActivite: string;
  adresse: string;
};

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
            : "Sélectionner un fournisseur"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un fournisseur..." />
          <CommandList>
            <CommandEmpty>Aucun fournisseur trouvé.</CommandEmpty>
            <CommandGroup>
              {fournisseurs.map((fournisseur) => (
                <CommandItem
                  key={fournisseur.id}
                  value={fournisseur.entreprise} // Search by entreprise name
                  onSelect={() => {
                    onChange(fournisseur.id === value ? "" : fournisseur.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === fournisseur.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {fournisseur.entreprise}
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
                Nouveau fournisseur
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
