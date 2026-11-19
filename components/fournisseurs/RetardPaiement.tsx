'use client';

import { AlarmClock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EtatEcheance, RetardPrestataire } from '@/lib/retardPaiement';

/**
 * Signal visuel des retards de paiement des factures prestataires (délai selon le type :
 * Fournisseur 30 j, interne 7 j, externe 3 j — Paramètres > Rôles).
 * - ligne du tableau : classe `ligne-retard` (rouge, fond clignotant — app/globals.css) ;
 * - bouton rouge clignotant « En retard · n j » qui ouvre le paiement ;
 * - sous la date : l'échéance, en orange quand elle approche.
 */

export const classeLigneRetard = (echeance?: EtatEcheance | null) => (echeance?.enRetard ? 'ligne-retard' : '');

const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

export function libelleRetard(echeance: EtatEcheance): string {
  return `En retard de ${jours(echeance.joursRetard)} (échéance du ${format(new Date(echeance.echeance), 'dd/MM/yyyy')}, délai ${echeance.delai} j)`;
}

/** Échéance sous la date de la facture. */
export function EcheanceFacture({ echeance }: { echeance?: EtatEcheance | null }) {
  if (!echeance) return null;
  const date = format(new Date(echeance.echeance), 'dd/MM/yyyy');
  if (echeance.enRetard) {
    return <p className="text-[11px] font-semibold text-red-700">Échue le {date}</p>;
  }
  return (
    <p className={cn('text-[11px]', echeance.echeanceProche ? 'font-semibold text-amber-700' : 'text-muted-foreground')}>
      Échéance {date}
      {echeance.echeanceProche && (echeance.joursRestants === 0 ? " · aujourd'hui" : ` · dans ${jours(echeance.joursRestants)}`)}
    </p>
  );
}

/** Bouton rouge clignotant d'une facture en retard : ouvre « Appliquer le paiement ». */
export function BoutonRetardPaiement({ echeance, onClick }: { echeance: EtatEcheance; onClick: () => void }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      title={`${libelleRetard(echeance)} — cliquer pour appliquer le paiement`}
      className="relative h-8 gap-1.5 bg-red-600 text-white shadow-sm shadow-red-600/40 hover:bg-red-700 animate-pulse hover:animate-none"
    >
      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
      </span>
      <AlarmClock className="h-3.5 w-3.5" />
      En retard · {echeance.joursRetard} j — Payer
    </Button>
  );
}

/** Pastille clignotante d'un prestataire qui a des factures en retard (liste des prestataires). */
export function PastilleRetardPrestataire({
  retard,
  onClick,
}: {
  retard: RetardPrestataire;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${retard.nombre} facture(s) en retard de paiement, ${new Intl.NumberFormat('fr-FR').format(retard.montant)} XOF — jusqu'à ${jours(retard.joursMax)} de retard`}
      className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm shadow-red-600/40 animate-pulse hover:animate-none hover:bg-red-700"
    >
      <AlarmClock className="h-3 w-3" />
      {retard.nombre} en retard · {retard.joursMax} j
    </button>
  );
}
