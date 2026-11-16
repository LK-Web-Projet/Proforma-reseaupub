'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CommandeDeLigne } from '@/components/budget/BudgetDepenseDialog';

export interface LigneDepenseOption {
  id: string;
  designation: string;
  modePaiement: string | null;
  reste: number;
  commandes: CommandeDeLigne[];
}

export interface BudgetDepenseOption {
  id: string;
  numero: string;
  statut: string;
  modePaiement: string;
  depensable: boolean;
  lignes: LigneDepenseOption[];
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

/**
 * Dépense depuis la fiche proforma d'une campagne QUI A UN BUDGET : on choisit d'abord la ligne de
 * budget payée (la dépense sera ensuite saisie comme depuis la fiche budget — même opération).
 */
export function ChoixLigneBudgetDialog({
  open,
  budgets,
  onClose,
  onChoisir,
}: {
  open: boolean;
  budgets: BudgetDepenseOption[];
  onClose: () => void;
  onChoisir: (budget: BudgetDepenseOption, ligne: LigneDepenseOption) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Sur quelle ligne de budget ?</DialogTitle>
          <DialogDescription>
            Cette campagne a un budget : chaque dépense est enregistrée sur une de ses lignes accordées (caisse, budget, proforma et bon de
            commande sont mis à jour ensemble).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {budgets.map((b) => (
            <div key={b.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <Link href={`/budget/demandes/${b.id}`} className="text-sm font-semibold text-primary hover:underline">Budget {b.numero}</Link>
                {!b.depensable && <span className="text-xs text-amber-700">pas encore validé ou clôturé — aucune dépense possible</span>}
              </div>
              {b.depensable && b.lignes.length === 0 && <p className="text-xs text-muted-foreground">Aucune ligne accordée.</p>}
              {b.lignes.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.designation}</p>
                    <p className="text-xs text-muted-foreground">
                      Reste {fcfa(l.reste)}{l.commandes.length > 0 ? ` · ${l.commandes.length} bon(s) de commande` : ''}
                    </p>
                  </div>
                  <Button size="sm" disabled={l.reste <= 0} onClick={() => onChoisir(b, l)}>Dépense</Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
