'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type InvoiceOption = {
  id: string;
  numero: string;
  objet: string;
  client?: { nom: string } | null;
};

interface InvoiceMultiComboboxProps {
  invoices: InvoiceOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function InvoiceMultiCombobox({ invoices, value, onChange }: InvoiceMultiComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedInvoices = invoices.filter((inv) => value.includes(inv.id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedInvoices.length > 0
              ? `${selectedInvoices.length} proforma(s) sélectionnée(s)`
              : 'Associer des proformas (optionnel)'}
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
                    onSelect={() => toggle(invoice.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(invoice.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm">{invoice.numero} — {invoice.objet}</span>
                      {invoice.client?.nom && (
                        <span className="text-xs text-muted-foreground">{invoice.client.nom}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedInvoices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedInvoices.map((invoice) => (
            <Badge key={invoice.id} variant="outline" className="gap-1.5 py-1.5 pl-3 pr-2 font-normal">
              {invoice.numero}
              <button
                type="button"
                onClick={() => remove(invoice.id)}
                className="rounded-full hover:bg-muted p-0.5"
                aria-label={`Retirer ${invoice.numero}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
