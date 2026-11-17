'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export type InvoiceOption = {
  id: string;
  numero: string;
  objet: string;
  client?: { nom: string } | null;
};

interface InvoiceComboboxProps {
  invoices: InvoiceOption[];
  /** Id de la proforma choisie, ou '' si aucune. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Choix d'UNE proforma (bon de commande, budget) : un bon ou un budget n'est associé qu'à une seule
 * proforma. Recherche par numéro, objet ou client ; la croix retire le choix.
 */
export function InvoiceCombobox({ invoices, value, onChange, placeholder = 'Associer une proforma (optionnel)', disabled }: InvoiceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const choisie = invoices.find((inv) => inv.id === value);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
            <span className="truncate text-left">
              {choisie ? `${choisie.numero} — ${choisie.objet}${choisie.client?.nom ? ` (${choisie.client.nom})` : ''}` : value ? 'Proforma sélectionnée' : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Rechercher une proforma..." />
            <CommandList>
              <CommandEmpty>Aucune proforma trouvée.</CommandEmpty>
              <CommandGroup>
                {invoices.map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={`${invoice.numero} ${invoice.objet} ${invoice.client?.nom ?? ''}`}
                    onSelect={() => {
                      onChange(invoice.id === value ? '' : invoice.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === invoice.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span className="text-sm">{invoice.numero} — {invoice.objet}</span>
                      {invoice.client?.nom && <span className="text-xs text-muted-foreground">{invoice.client.nom}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => onChange('')} aria-label="Retirer la proforma">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
