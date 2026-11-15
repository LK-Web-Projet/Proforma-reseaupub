'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MODE_PAIEMENT_OPTIONS } from '@/lib/budgetTypes';
import { etatLiasse, payeSurCommande } from '@/lib/commandeFournisseurLiasse';

// 10 Mo — même limite que côté serveur (lib/uploadDemandeBudget.ts).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;


const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

interface CashRegisterOption {
  id: number;
  name: string;
  balance: number;
}

/** Bon de commande financé par la ligne (avance / solde) — voir lib/commandeFournisseurLiasse.ts. */
export interface CommandeDeLigne {
  id: string;
  numero: string;
  statut: string;
  montantNet: number | string;
  fournisseur: { entreprise: string };
  documents: { kind: string }[];
  factures: { id: string; reference: string; montant: number | string; status: string; pieceJointe: string | null }[];
  depenses: { montant: number | string; annuleeAt: string | null }[];
}

export interface BudgetDepenseDialogLigne {
  id: string;
  designation: string;
  reste: number;
  // Moyen de paiement prévu sur la ligne (pré-sélectionné ; null = celui de la demande).
  modePaiement?: string | null;
  commandes?: CommandeDeLigne[];
}

// Valeur du choix « Paiement » : dépense simple, ou "<commandeId>|AVANCE" / "<commandeId>|SOLDE".
const PAIEMENT_SIMPLE = 'NORMALE';

interface BudgetDepenseDialogProps {
  demandeId: string;
  ligne: BudgetDepenseDialogLigne | null;
  proformas: { id: string; numero: string; objet: string }[];
  defaultModePaiement: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Saisie d'une dépense réelle sur une ligne de budget par le comptable. La dépense crée une
 * écriture DEPENSE dans la caisse choisie (voir app/api/demandes-budget/[id]/depenses/route.ts).
 */
export function BudgetDepenseDialog({ demandeId, ligne, proformas, defaultModePaiement, onClose, onSuccess }: BudgetDepenseDialogProps) {
  const [cashRegisters, setCashRegisters] = useState<CashRegisterOption[]>([]);
  const [montant, setMontant] = useState('');
  const [dateDepense, setDateDepense] = useState(new Date().toISOString().split('T')[0]);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [nomReceveur, setNomReceveur] = useState('');
  const [modePaiement, setModePaiement] = useState(defaultModePaiement);
  const [invoiceId, setInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [preuves, setPreuves] = useState<File[]>([]);
  const [sansJustificatif, setSansJustificatif] = useState(false);
  const [motifSansJustificatif, setMotifSansJustificatif] = useState('');
  const [paiement, setPaiement] = useState(PAIEMENT_SIMPLE);
  const [factureFournisseurId, setFactureFournisseurId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [commandeChoisieId, natureChoisie] = paiement === PAIEMENT_SIMPLE ? [null, 'NORMALE'] : paiement.split('|');
  const commandeChoisie = ligne?.commandes?.find((c) => c.id === commandeChoisieId) ?? null;
  const liasse = commandeChoisie ? etatLiasse(commandeChoisie.documents, commandeChoisie.factures) : null;
  const resteCommande = commandeChoisie ? Number(commandeChoisie.montantNet) - payeSurCommande(commandeChoisie.depenses) : 0;
  const facturesAPayer = commandeChoisie?.factures.filter((f) => f.status === 'EN_ATTENTE') ?? [];
  const commandePayable = (c: CommandeDeLigne) => (c.statut === 'VALIDEE' || c.statut === 'LIVREE') && etatLiasse(c.documents).bcSigne;

  const choisirPaiement = (valeur: string) => {
    setPaiement(valeur);
    setFactureFournisseurId('');
    if (valeur === PAIEMENT_SIMPLE || !ligne) return;
    const [cid] = valeur.split('|');
    const c = ligne.commandes?.find((x) => x.id === cid);
    if (!c) return;
    const resteC = Number(c.montantNet) - payeSurCommande(c.depenses);
    setMontant(String(Math.max(Math.min(ligne.reste, resteC), 0)));
    setNomReceveur(c.fournisseur.entreprise);
    const enAttente = c.factures.filter((f) => f.status === 'EN_ATTENTE');
    if (enAttente.length === 1) setFactureFournisseurId(enAttente[0].id);
  };

  useEffect(() => {
    fetch('/api/cash-registers')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCashRegisters)
      .catch(() => setCashRegisters([]));
  }, []);

  // Réinitialise le formulaire à chaque ouverture sur une nouvelle ligne.
  useEffect(() => {
    if (!ligne) return;
    setMontant(ligne.reste > 0 ? String(ligne.reste) : '');
    setDateDepense(new Date().toISOString().split('T')[0]);
    setNomReceveur('');
    setModePaiement(ligne?.modePaiement || defaultModePaiement);
    setInvoiceId(proformas.length === 1 ? proformas[0].id : '');
    setNotes('');
    setPreuves([]);
    setSansJustificatif(false);
    setMotifSansJustificatif('');
    setPaiement(PAIEMENT_SIMPLE);
    setFactureFournisseurId('');
  }, [ligne, proformas, defaultModePaiement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligne) return;

    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return void toast.error('Indiquez un montant valide.');
    if (montantNum > ligne.reste + 0.005) {
      return void toast.error(`Budget de la ligne atteint : il reste ${formatMontant(ligne.reste)}.`);
    }
    if (commandeChoisie) {
      if (montantNum > resteCommande + 0.005) {
        return void toast.error(`Montant supérieur au reste du bon de commande : il reste ${formatMontant(resteCommande)}.`);
      }
      if (natureChoisie === 'SOLDE' && !liasse?.complete) {
        return void toast.error(`Liasse incomplète : manque ${liasse?.manquantes.join(', ')}.`);
      }
      if (natureChoisie === 'SOLDE' && !factureFournisseurId) {
        return void toast.error('Choisissez la facture fournisseur réglée par ce solde.');
      }
    }
    if (!cashRegisterId) return void toast.error('Choisissez la caisse concernée.');
    if (!nomReceveur.trim()) return void toast.error('Le nom du receveur est requis.');
    if (proformas.length > 1 && !invoiceId) return void toast.error('Choisissez la proforma à laquelle imputer la dépense.');
    if (preuves.length === 0 && !sansJustificatif) {
      return void toast.error('Joignez un justificatif, ou cochez « Dépense sans justificatif ».');
    }
    if (preuves.length === 0 && !motifSansJustificatif.trim()) {
      return void toast.error("Indiquez le motif de l'absence de justificatif.");
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('ligneId', ligne.id);
      data.append('montant', String(montantNum));
      data.append('dateDepense', new Date(dateDepense).toISOString());
      data.append('cashRegisterId', cashRegisterId);
      data.append('nomReceveur', nomReceveur.trim());
      data.append('modePaiement', modePaiement);
      if (invoiceId) data.append('invoiceId', invoiceId);
      if (commandeChoisie) {
        data.append('commandeId', commandeChoisie.id);
        data.append('nature', natureChoisie);
        if (natureChoisie === 'SOLDE') data.append('factureFournisseurId', factureFournisseurId);
      }
      if (notes.trim()) data.append('notes', notes.trim());
      data.append('sansJustificatif', String(preuves.length === 0 && sansJustificatif));
      if (preuves.length === 0) data.append('motifSansJustificatif', motifSansJustificatif.trim());
      preuves.forEach((f) => data.append('preuves', f));

      const res = await fetch(`/api/demandes-budget/${demandeId}/depenses`, { method: 'POST', body: data });
      if (!res.ok) {
        const err = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
        throw new Error(typeof err?.error === 'string' ? err.error : "Erreur lors de l'enregistrement de la dépense.");
      }
      toast.success('Dépense enregistrée et inscrite au journal de caisse.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!ligne} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer une dépense</DialogTitle>
        </DialogHeader>
        {ligne && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{ligne.designation}</p>
              <p className="text-muted-foreground">Reste disponible : <strong>{formatMontant(ligne.reste)}</strong></p>
            </div>

            {(ligne.commandes?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Paiement</Label>
                <Select value={paiement} onValueChange={choisirPaiement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PAIEMENT_SIMPLE}>Dépense simple (hors bon de commande)</SelectItem>
                    {ligne.commandes!.map((c) => (
                      <React.Fragment key={c.id}>
                        <SelectItem value={`${c.id}|AVANCE`} disabled={!commandePayable(c)}>
                          Avance — {c.numero} ({c.fournisseur.entreprise})
                        </SelectItem>
                        <SelectItem value={`${c.id}|SOLDE`} disabled={!commandePayable(c) || !etatLiasse(c.documents, c.factures).complete}>
                          Solde — {c.numero} ({c.fournisseur.entreprise})
                        </SelectItem>
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
                {ligne.commandes!.some((c) => !commandePayable(c)) && (
                  <p className="text-xs text-muted-foreground">Un bon non validé ou sans scan signé ne peut pas être payé.</p>
                )}
                {commandeChoisie && liasse && (
                  <div className={`rounded-md border p-3 text-xs space-y-1 ${liasse.complete ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p>
                      Bon de commande <strong>{commandeChoisie.numero}</strong> : reste à payer <strong>{formatMontant(resteCommande)}</strong> sur {formatMontant(Number(commandeChoisie.montantNet))}.
                    </p>
                    <p>
                      Liasse {liasse.nbPieces}/4{liasse.complete ? ' — complète' : ` — manque : ${liasse.manquantes.join(', ')}`}
                      {natureChoisie === 'AVANCE' && !liasse.complete ? ". L'avance restera « non justifiée » jusqu'à la liasse complète." : ''}
                    </p>
                  </div>
                )}
                {natureChoisie === 'SOLDE' && (
                  <div className="space-y-2">
                    <Label>Facture fournisseur réglée *</Label>
                    <Select value={factureFournisseurId} onValueChange={setFactureFournisseurId}>
                      <SelectTrigger><SelectValue placeholder={facturesAPayer.length ? 'Choisir la facture' : 'Aucune facture en attente sur ce bon'} /></SelectTrigger>
                      <SelectContent>
                        {facturesAPayer.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.reference} — {formatMontant(Number(f.montant))}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dep-montant">Montant (XOF) *</Label>
                <Input id="dep-montant" type="number" step="0.01" min={0} max={ligne.reste} value={montant} onChange={(e) => setMontant(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dep-date">Date *</Label>
                <Input id="dep-date" type="date" value={dateDepense} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDateDepense(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Caisse *</Label>
                <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                  <SelectTrigger><SelectValue placeholder="Choisir la caisse" /></SelectTrigger>
                  <SelectContent>
                    {cashRegisters.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} — {formatMontant(c.balance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement *</Label>
                <Select value={modePaiement} onValueChange={setModePaiement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODE_PAIEMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dep-receveur">Nom du receveur *</Label>
                <Input id="dep-receveur" value={nomReceveur} onChange={(e) => setNomReceveur(e.target.value)} required />
              </div>
              {proformas.length > 0 && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Proforma imputée *</Label>
                  <Select value={invoiceId} onValueChange={setInvoiceId}>
                    <SelectTrigger><SelectValue placeholder="Choisir la proforma" /></SelectTrigger>
                    <SelectContent>
                      {proformas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.numero} — {p.objet}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">La dépense apparaîtra dans les paiements de cette proforma.</p>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dep-notes">Notes</Label>
                <Textarea id="dep-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="dep-preuves">Justificatif (facture, reçu…)</Label>
                <Input
                  id="dep-preuves"
                  type="file"
                  multiple
                  disabled={sansJustificatif}
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
                    if (tooBig) {
                      toast.error(`Le fichier "${tooBig.name}" dépasse la taille maximale autorisée (10 Mo).`);
                      e.target.value = '';
                      return;
                    }
                    setPreuves(files);
                  }}
                />
              </div>
              {preuves.length === 0 && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={sansJustificatif} onCheckedChange={setSansJustificatif} />
                    Dépense sans justificatif
                  </label>
                  {sansJustificatif && (
                    <Input
                      placeholder="Motif (ex. achat sans facture, reçu à venir…) *"
                      value={motifSansJustificatif}
                      onChange={(e) => setMotifSansJustificatif(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer la dépense'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
