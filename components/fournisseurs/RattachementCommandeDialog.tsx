'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { InvoiceOption } from '@/components/InvoiceCombobox';
import { RattachementCommandeField, rattachementInitial, type RattachementCommande } from '@/components/fournisseurs/RattachementCommandeField';

/** Seules les proformas confirmées côté client peuvent être associées à un bon de commande. */
const STATUTS_PROFORMA_ASSOCIABLES = ['Valider', 'Payer', 'Solde'];

/**
 * Rattachement d'un bon EN BROUILLON depuis sa fiche (bouton « Rattacher à un budget » /
 * « Changer le rattachement ») : même circuit que le formulaire — campagne ou hors campagne, puis
 * proforma (et ligne de son budget) ou budget puis ligne. Enregistré par PATCH (proforma + ligne) ;
 * une ligne accordée valide le bon d'office.
 */
export function RattachementCommandeDialog({
  commande,
  open,
  onClose,
  onSuccess,
}: {
  commande: { id: string; numero: string; montantNet: number | string; ligneBudget: { id: string } | null; proformas?: { invoice: { id: string } }[] };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rattachement, setRattachement] = useState<RattachementCommande>(rattachementInitial());
  const [erreur, setErreur] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRattachement(rattachementInitial({ proformaId: commande.proformas?.[0]?.invoice.id, ligneBudgetId: commande.ligneBudget?.id }));
    fetch('/api/factures')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: (InvoiceOption & { statut: string })[]) => setInvoices(data.filter((inv) => STATUTS_PROFORMA_ASSOCIABLES.includes(inv.statut))))
      .catch(() => setInvoices([]));
  }, [open, commande.proformas, commande.ligneBudget?.id]);

  const enregistrer = async () => {
    if (erreur) return void toast.error(erreur);
    setEnvoi(true);
    try {
      const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proformaId: rattachement.campagne ? rattachement.proformaId || null : null,
          ligneBudgetId: rattachement.ligneBudgetId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur.');
      toast.success(data.statut === 'VALIDEE' ? `Bon ${commande.numero} rattaché et validé.` : `Bon ${commande.numero} rattaché.`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !envoi && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rattacher le bon {commande.numero}</DialogTitle>
          <DialogDescription>
            Pour une campagne : la proforma, puis la ligne de son budget. Hors campagne : un budget validé (mensuel, ponctuel…), puis sa ligne.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RattachementCommandeField
            key={commande.id}
            valeur={rattachement}
            onChange={setRattachement}
            invoices={invoices}
            montantNet={Number(commande.montantNet)}
            commandeId={commande.id}
            onEtat={setErreur}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={envoi}>Annuler</Button>
          <Button onClick={enregistrer} loading={envoi} disabled={envoi || !!erreur}>Rattacher</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
