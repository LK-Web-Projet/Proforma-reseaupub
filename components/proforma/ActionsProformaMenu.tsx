'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next-nprogress-bar';
import { CheckCircle, Eye, MoreHorizontal, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDroits } from '@/components/DroitsProvider';

/** Statuts depuis lesquels une proforma peut être validée depuis la liste. */
const STATUTS_VALIDABLES = ['Brouillon', 'Envoyer'];

export interface ProformaPourActions {
  id: string;
  numero: string;
  objet?: string | null;
  statut: string;
  documents?: { type: string }[];
}

/**
 * Pourquoi la proforma ne se modifie plus (mêmes règles que le bouton « Modifier » de la fiche), ou
 * null si elle est modifiable.
 */
export function raisonNonModifiable(f: ProformaPourActions, peut: (cle: string) => boolean): string | null {
  if (!['proforma.modifier', 'proforma.changerStatut', 'proforma.valider', 'proforma.annuler'].some(peut)) return 'droit manquant';
  if (['Payer', 'Solde'].includes(f.statut)) return 'paiement en cours';
  if (f.documents?.some((d) => d.type === 'BON_COMMANDE' || d.type === 'FACTURE_NORMALISEE')) return 'bon ou facture joint';
  return null;
}

/**
 * Menu « … » d'une ligne de la liste des proformas : ouvrir, valider (droit « Valider »), modifier
 * (ouvre la fiche directement en mode modification). Le serveur refait tous les contrôles.
 */
export function ActionsProformaMenu({ facture, onValidee }: { facture: ProformaPourActions; onValidee: (id: string) => void }) {
  const { peut } = useDroits();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const validable = peut('proforma.valider') && STATUTS_VALIDABLES.includes(facture.statut);
  const raisonModif = raisonNonModifiable(facture, peut);

  const valider = async () => {
    setEnvoi(true);
    try {
      const res = await fetch(`/api/factures/${facture.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'Valider' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Validation impossible.');
      toast.success(`Proforma ${facture.numero} validée.`);
      setConfirmation(false);
      onValidee(facture.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions sur la proforma ${facture.numero}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground truncate">{facture.numero}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/facture/${facture.id}`}>
              <Eye className="h-4 w-4" /> Ouvrir la proforma
            </Link>
          </DropdownMenuItem>
          {validable && (
            <DropdownMenuItem onSelect={() => setConfirmation(true)}>
              <CheckCircle className="h-4 w-4 text-green-600" /> Valider la proforma
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={!!raisonModif} onSelect={() => router.push(`/facture/${facture.id}?modifier=1`)}>
            <Pencil className="h-4 w-4" /> Modifier
            {raisonModif && <span className="ml-auto pl-2 text-[10px] text-muted-foreground">{raisonModif}</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmation} onOpenChange={(o) => !o && !envoi && setConfirmation(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider la proforma {facture.numero} ?</DialogTitle>
            <DialogDescription>
              {facture.objet ? `${facture.objet}. ` : ''}La validation est notée dans l&apos;historique et l&apos;équipe est prévenue. Une
              proforma validée attend ensuite sa facture normalisée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(false)} disabled={envoi}>Annuler</Button>
            <Button onClick={valider} loading={envoi} disabled={envoi} className="bg-green-600 hover:bg-green-700">
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
