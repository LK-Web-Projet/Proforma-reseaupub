'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, CircleDashed, FileText, Link2, Paperclip, Plus, Receipt, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { cn } from '@/lib/utils';
import {
  etatLiasse,
  NATURE_DEPENSE_LABELS,
  payeSurCommande,
  TYPE_DOCUMENT_COMMANDE_LABELS,
  TYPES_DOCUMENT_COMMANDE,
  type TypeDocumentCommandeValue,
} from '@/lib/commandeFournisseurLiasse';
import { modePaiementLabel } from '@/lib/budgetTypes';

export interface CommandeSuivi {
  id: string;
  numero: string;
  statut: string;
  montantNet: number | string;
  fournisseurId: string;
  ligneBudget: { id: string; designation: string; demandeBudget: { id: string; numero: string; type: string; statut: string } } | null;
  documents: { id: string; kind: string; url: string; fileName: string; createdAt: string; createdByEmail: string }[];
  factures: { id: string; reference: string; montant: number | string; date: string; status: string; pieceJointe: string | null }[];
  depenses: {
    id: string;
    montant: number | string;
    nature: string;
    dateDepense: string;
    nomReceveur: string;
    modePaiement: string;
    annuleeAt: string | null;
    demandeBudgetId: string;
    factureFournisseurId: string | null;
  }[];
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

interface LigneCandidate {
  id: string;
  label: string;
}

/**
 * Suivi d'un bon de commande (procédure de paiement, section 4) : ligne de budget qui le finance,
 * liasse (BC signé, bordereau / attestation, facture, rapport), factures fournisseurs, avances et
 * solde payés depuis le budget. Le solde n'est payable qu'avec la liasse complète.
 */
export function CommandeLiasseCard({ commande, onChange }: { commande: CommandeSuivi; onChange: () => void }) {
  const liasse = etatLiasse(commande.documents, commande.factures);
  const paye = payeSurCommande(commande.depenses);
  const reste = Number(commande.montantNet) - paye;
  const avancesNonJustifiees = commande.depenses.filter((d) => d.nature === 'AVANCE' && !d.annuleeAt && !liasse.complete);
  const paiementsActifs = commande.depenses.some((d) => !d.annuleeAt);
  const annulee = commande.statut === 'ANNULEE';

  const [pieceType, setPieceType] = useState<TypeDocumentCommandeValue | null>(null);
  const [factureOuverte, setFactureOuverte] = useState(false);
  const [ligneOuverte, setLigneOuverte] = useState(false);

  const pieces: { libelle: string; ok: boolean; kind: TypeDocumentCommandeValue }[] = [
    { libelle: 'Bon de commande signé (DG)', ok: liasse.bcSigne, kind: 'BC_SIGNE' },
    { libelle: 'Bordereau de livraison ou attestation de service fait', ok: liasse.livraison, kind: 'BORDEREAU_LIVRAISON' },
    { libelle: 'Facture', ok: liasse.facture, kind: 'FACTURE' },
    { libelle: 'Rapport', ok: liasse.rapport, kind: 'RAPPORT' },
  ];

  return (
    <Card className={cn('border-t-4', liasse.complete ? 'border-t-green-500' : 'border-t-amber-500')}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Budget, liasse et paiements</span>
          <Badge variant="outline" className={liasse.complete ? 'border-green-300 text-green-700' : 'border-amber-300 text-amber-800'}>
            Liasse {liasse.nbPieces}/4{liasse.complete ? ' — complète' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* Ligne de budget */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Financé par</p>
            {commande.ligneBudget ? (
              <Link href={`/budget/demandes/${commande.ligneBudget.demandeBudget.id}`} className="text-primary hover:underline">
                Budget {commande.ligneBudget.demandeBudget.numero} — {commande.ligneBudget.designation}
              </Link>
            ) : (
              <p className="text-amber-800">Aucune ligne de budget : l&apos;avance et le solde ne pourront pas être payés.</p>
            )}
          </div>
          {!paiementsActifs && !annulee && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setLigneOuverte(true)}>
              <Link2 className="h-3.5 w-3.5" /> {commande.ligneBudget ? 'Changer de ligne' : 'Rattacher à une ligne de budget'}
            </Button>
          )}
        </div>

        {/* Liasse */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Liasse</p>
          {pieces.map((p) => (
            <div key={p.kind} className="flex items-center justify-between gap-2">
              <span className={cn('flex items-center gap-2', p.ok ? 'text-green-700' : 'text-muted-foreground')}>
                {p.ok ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />} {p.libelle}
              </span>
              {!annulee && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPieceType(p.kind)}>
                  <Paperclip className="h-3 w-3" /> Joindre
                </Button>
              )}
            </div>
          ))}
          {commande.documents.length > 0 && (
            <div className="rounded-md border divide-y mt-2">
              {commande.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-2 px-3 py-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" title={d.fileName}>{d.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {TYPE_DOCUMENT_COMMANDE_LABELS[d.kind as TypeDocumentCommandeValue] ?? d.kind} · {format(new Date(d.createdAt), 'dd/MM/yyyy')} · {d.createdByEmail}
                    </p>
                  </div>
                  <AttachmentPreviewButton url={d.url} title={d.fileName} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Factures fournisseurs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase">Factures du prestataire</p>
            {!annulee && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setFactureOuverte(true)}>
                <Plus className="h-3 w-3" /> Enregistrer la facture
              </Button>
            )}
          </div>
          {commande.factures.length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucune facture rattachée. Le solde règle une facture : enregistrez-la ici.</p>
          ) : (
            commande.factures.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" /> {f.reference} — {fcfa(Number(f.montant))}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={f.status === 'PAYEE' ? 'border-green-300 text-green-700' : f.status === 'ANNULEE' ? 'text-muted-foreground' : 'border-amber-300 text-amber-800'}>
                    {f.status === 'PAYEE' ? 'Payée' : f.status === 'ANNULEE' ? 'Annulée' : 'À payer'}
                  </Badge>
                  {f.pieceJointe ? <AttachmentPreviewButton url={f.pieceJointe} title={f.reference} /> : <span className="text-[11px] text-amber-700">sans pièce</span>}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Paiements */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase">Paiements (depuis le budget)</p>
          <div className="grid grid-cols-3 gap-2">
            <div><p className="text-[11px] text-muted-foreground">Montant net</p><p className="font-semibold">{fcfa(Number(commande.montantNet))}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Payé</p><p className="font-semibold">{fcfa(paye)}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Reste</p><p className="font-semibold">{fcfa(Math.max(reste, 0))}</p></div>
          </div>
          {avancesNonJustifiees.length > 0 && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
              Avance non justifiée : la liasse est incomplète (manque {liasse.manquantes.join(', ')}). Le solde sera bloqué jusque-là.
            </p>
          )}
          {commande.depenses.map((d) => (
            <div key={d.id} className={cn('flex items-center justify-between gap-2 rounded-md border px-3 py-2', d.annuleeAt && 'opacity-60 line-through')}>
              <span>
                <Badge variant="outline" className={cn('mr-2 text-[10px]', d.nature === 'AVANCE' && !liasse.complete && !d.annuleeAt && 'bg-red-100 text-red-700 border-red-300')}>
                  {NATURE_DEPENSE_LABELS[d.nature] ?? d.nature}
                </Badge>
                {format(new Date(d.dateDepense), 'dd/MM/yyyy')} · {d.nomReceveur} · {modePaiementLabel(d.modePaiement)}
              </span>
              <Link href={`/budget/demandes/${d.demandeBudgetId}`} className="font-medium text-primary hover:underline">{fcfa(Number(d.montant))}</Link>
            </div>
          ))}
          {commande.depenses.length === 0 && (
            <p className="text-xs text-muted-foreground">
              L&apos;avance et le solde se paient depuis la fiche du budget (bouton « Dépense » sur la ligne), une fois le bon validé et signé.
            </p>
          )}
        </div>
      </CardContent>

      <PieceDialog commandeId={commande.id} kind={pieceType} onClose={() => setPieceType(null)} onSuccess={onChange} />
      <FactureDialog commande={commande} open={factureOuverte} onClose={() => setFactureOuverte(false)} onSuccess={onChange} />
      <LigneBudgetDialog commande={commande} open={ligneOuverte} onClose={() => setLigneOuverte(false)} onSuccess={onChange} />
    </Card>
  );
}

function PieceDialog({ commandeId, kind, onClose, onSuccess }: { commandeId: string; kind: TypeDocumentCommandeValue | null; onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<TypeDocumentCommandeValue>('BC_SIGNE');
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (kind) {
      setType(kind);
      setFichiers([]);
    }
  }, [kind]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fichiers.length === 0) return void toast.error('Choisissez au moins un fichier.');
    setEnvoi(true);
    try {
      const data = new FormData();
      data.append('kind', type);
      fichiers.forEach((f) => data.append('fichiers', f));
      const res = await fetch(`/api/fournisseurs/commandes/${commandeId}/documents`, { method: 'POST', body: data });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : "Erreur lors de l'envoi.");
      }
      toast.success('Pièce ajoutée à la liasse.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Joindre une pièce</DialogTitle></DialogHeader>
        <form onSubmit={envoyer} className="space-y-4">
          <div className="space-y-2">
            <Label>Type de pièce</Label>
            <Select value={type} onValueChange={(v) => setType(v as TypeDocumentCommandeValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_DOCUMENT_COMMANDE.map((t) => <SelectItem key={t} value={t}>{TYPE_DOCUMENT_COMMANDE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="piece-fichiers">Fichier(s) (PDF, image…)</Label>
            <Input id="piece-fichiers" type="file" multiple onChange={(e) => setFichiers(Array.from(e.target.files ?? []))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Joindre'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FactureDialog({ commande, open, onClose, onSuccess }: { commande: CommandeSuivi; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [reference, setReference] = useState('');
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [piece, setPiece] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (open) {
      setReference('');
      setMontant(String(Math.max(Number(commande.montantNet) - payeSurCommande(commande.depenses), 0)));
      setPiece(null);
    }
  }, [open, commande]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || !Number(montant)) return void toast.error('Référence et montant requis.');
    setEnvoi(true);
    try {
      const data = new FormData();
      data.append('reference', reference.trim());
      data.append('montant', montant);
      data.append('date', new Date(date).toISOString());
      data.append('fournisseurId', commande.fournisseurId);
      data.append('commandeId', commande.id);
      data.append('status', 'EN_ATTENTE');
      if (piece) data.append('pieceJointe', piece);
      const res = await fetch('/api/factures-fournisseurs', { method: 'POST', body: data });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.message === 'string' ? err.message : "Erreur lors de l'enregistrement de la facture.");
      }
      toast.success('Facture enregistrée et rattachée au bon de commande.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Facture du prestataire — {commande.numero}</DialogTitle></DialogHeader>
        <form onSubmit={envoyer} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fac-ref">Référence de la facture *</Label>
            <Input id="fac-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fac-montant">Montant (XOF) *</Label>
              <Input id="fac-montant" type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fac-date">Date *</Label>
              <Input id="fac-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fac-piece">Pièce (scan de la facture)</Label>
            <Input id="fac-piece" type="file" onChange={(e) => setPiece(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Elle passera « payée » automatiquement au paiement du solde.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DemandeListe {
  id: string;
  numero: string;
  statut: string;
  type: string;
  pourLeCompteDe: string | null;
  lignes: { id: string; designation: string; statutValidation: string }[];
}

function LigneBudgetDialog({ commande, open, onClose, onSuccess }: { commande: CommandeSuivi; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [demandes, setDemandes] = useState<DemandeListe[]>([]);
  const [ligneId, setLigneId] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLigneId(commande.ligneBudget?.id ?? '');
    fetch('/api/demandes-budget')
      .then((res) => (res.ok ? res.json() : []))
      .then(setDemandes)
      .catch(() => setDemandes([]));
  }, [open, commande.ligneBudget?.id]);

  const lignes: LigneCandidate[] = useMemo(
    () =>
      demandes
        .filter((d) => ['SOUMISE', 'VALIDATION_PARTIELLE', 'VALIDEE', 'EN_COURS'].includes(d.statut))
        .flatMap((d) =>
          d.lignes
            .filter((l) => l.statutValidation !== 'RETIREE')
            .map((l) => ({ id: l.id, label: `${d.numero}${d.type === 'CAMPAGNE' ? ' (campagne)' : ''} — ${l.designation}` }))
        ),
    [demandes]
  );

  const enregistrer = async () => {
    if (!ligneId) return void toast.error('Choisissez une ligne de budget.');
    setEnvoi(true);
    try {
      const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ligneBudgetId: ligneId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur.');
      }
      toast.success('Bon de commande rattaché à la ligne de budget.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ligne de budget qui finance {commande.numero}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Select value={ligneId} onValueChange={setLigneId}>
            <SelectTrigger><SelectValue placeholder={lignes.length ? 'Choisir la ligne' : 'Aucun budget ouvert visible'} /></SelectTrigger>
            <SelectContent>
              {lignes.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">L&apos;avance et le solde seront payés sur cette ligne, dans la limite de son plafond.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={enregistrer} disabled={envoi}>{envoi ? 'Enregistrement…' : 'Rattacher'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
