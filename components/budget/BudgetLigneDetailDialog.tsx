'use client';

import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarClock, NotebookText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CLASSES_DELAI, libelleDelai, type EtatDelaiLigne } from '@/lib/budgetDelai';
import { cn } from '@/lib/utils';

export interface BudgetLigneDetailCible {
  designation: string;
  statutLibelle: string;
  categorie: string;
  modePaiement: string;
  demande: number;
  /** null = ligne pas (encore) accordée. */
  accorde: number | null;
  consomme: number;
  reste: number;
  detail: string | null;
  dateLimite: string | null;
  etatDelai: EtatDelaiLigne | null;
  motifDecision: string | null;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

/**
 * Fenêtre « Détail » d'une ligne de budget : rappelle la ligne (statut, montants, délai) et affiche
 * le détail saisi par le demandeur. Lecture seule, ouverte à tous ceux qui voient le budget.
 */
export function BudgetLigneDetailDialog({
  numeroBudget,
  ligne,
  onClose,
}: {
  numeroBudget: string;
  ligne: BudgetLigneDetailCible | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!ligne} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {ligne && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 leading-snug">{ligne.designation}</DialogTitle>
              <DialogDescription>
                Ligne du budget {numeroBudget} · {ligne.statutLibelle}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="font-normal text-muted-foreground">{ligne.categorie}</Badge>
              <Badge variant="outline" className="font-normal text-muted-foreground" title="Moyen de paiement prévu">
                {ligne.modePaiement}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Demandé</dt>
                <dd className="font-medium">{formatMontant(ligne.demande)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Accordé</dt>
                <dd className="font-medium">{ligne.accorde === null ? '—' : formatMontant(ligne.accorde)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Consommé</dt>
                <dd className="font-medium">{formatMontant(ligne.consomme)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reste</dt>
                <dd className="font-medium">{formatMontant(ligne.reste)}</dd>
              </div>
            </dl>

            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {ligne.dateLimite ? (
                <>
                  <span>
                    Délai de la ligne : <strong>{format(new Date(ligne.dateLimite), 'EEEE d MMMM yyyy', { locale: fr })}</strong>
                  </span>
                  {ligne.etatDelai && ligne.etatDelai !== 'TERMINE' && (
                    <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', CLASSES_DELAI[ligne.etatDelai])}>
                      {libelleDelai(ligne.etatDelai, ligne.dateLimite)}
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Pas de délai particulier pour cette ligne.</span>
              )}
            </div>

            {ligne.motifDecision && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Décision du valideur :</strong> {ligne.motifDecision}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <NotebookText className="h-4 w-4 text-indigo-700" /> Détail
              </p>
              {ligne.detail ? (
                <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3 text-sm leading-relaxed">
                  {ligne.detail}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun détail n&apos;a été renseigné pour cette ligne.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
