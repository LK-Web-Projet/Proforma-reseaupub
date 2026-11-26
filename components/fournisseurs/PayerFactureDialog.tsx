'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { moyensProposes } from '@/lib/moyensPaiement';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

interface InfosPaiement {
  facture: { id: string; reference: string; montant: number; fournisseur: string } | null;
  commande: { id: string; numero: string; montantNet: number; fournisseur?: string } | null;
  dejaPaye: number;
  reste: number;
  ligne: { id: string; designation: string; budgetId: string; budgetNumero: string; reste: number; proformas?: string[] } | null;
  /**
   * Facture : ce que fera le paiement, d'après son rattachement (jamais choisi ici) — BUDGET (ligne du bon
   * ou de la facture), PROFORMA (campagne sans budget), CAISSE (rien de rattaché). Absent pour une avance.
   */
  mode?: 'BUDGET' | 'PROFORMA' | 'CAISSE';
  proforma?: { id: string; numero: string } | null;
  blocages: string[];
  peutPayer: boolean;
}

/** Ce que l'on paie : une facture (solde, montant fixé) ou une avance sur un bon de commande. */
export type CiblePaiement = { type: 'facture'; id: string } | { type: 'avance'; id: string };

/**
 * « Appliquer le paiement » d'une facture fournisseur (liste des factures, fiche prestataire, fiche
 * du bon) : le montant est fixé au reste à payer et le budget n'est jamais choisi ici — il découle du
 * rattachement (ligne du bon de commande, ou de la facture). Sans budget : sortie de caisse seule (ou
 * dépense sur la proforma d'une campagne sans budget). « Verser une avance » sur un bon de commande :
 * montant libre jusqu'au reste du bon. La preuve de paiement est obligatoire.
 */
export function PayerFactureDialog({
  cible,
  open,
  onClose,
  onPaye,
}: {
  cible: CiblePaiement | null;
  open: boolean;
  onClose: () => void;
  onPaye: () => void;
}) {
  const url = cible
    ? cible.type === 'facture'
      ? `/api/factures-fournisseurs/${cible.id}/payer`
      : `/api/fournisseurs/commandes/${cible.id}/avance`
    : null;
  const avance = cible?.type === 'avance';
  const [montant, setMontant] = useState('');
  const [infos, setInfos] = useState<InfosPaiement | null>(null);
  const [chargement, setChargement] = useState(false);
  const [caisses, setCaisses] = useState<{ id: number; name: string; balance: number }[]>([]);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [modePaiement, setModePaiement] = useState('VIREMENT');
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [preuves, setPreuves] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const { moyens, charge: moyensCharges, caisses: caissesDuMoyen } = useMoyensPaiement();

  // Caisses proposées : visibles et liées au moyen choisi (solde affiché quand il est connu).
  const caissesProposees = useMemo(
    () => caissesDuMoyen(modePaiement).map((c) => ({ ...c, balance: caisses.find((r) => r.id === c.id)?.balance ?? null })),
    [caissesDuMoyen, modePaiement, caisses]
  );
  useEffect(() => {
    setCashRegisterId((actuelle) =>
      caissesProposees.some((c) => String(c.id) === actuelle) ? actuelle : caissesProposees.length === 1 ? String(caissesProposees[0].id) : ''
    );
  }, [caissesProposees]);

  useEffect(() => {
    if (!open || !url) return;
    setInfos(null);
    setPreuves([]);
    setReference('');
    setMontant('');
    setChargement(true);
    Promise.all([
      fetch(url).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Chargement impossible.');
        return d as InfosPaiement;
      }),
      fetch('/api/cash-registers').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([i, c]) => {
        setInfos(i);
        setCaisses(c);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erreur.'))
      .finally(() => setChargement(false));
  }, [open, url]);

  const bloque = !infos || infos.blocages.length > 0 || !infos.peutPayer;

  const payer = async () => {
    if (!infos || !url) return;
    if (avance && !(Number(montant) > 0)) return toast.error("Indiquez le montant de l'avance.");
    if (!cashRegisterId) return toast.error('Choisissez la caisse.');
    if (preuves.length === 0) return toast.error('Joignez la preuve de paiement.');
    setEnvoi(true);
    try {
      const data = new FormData();
      data.append('cashRegisterId', cashRegisterId);
      data.append('datePaiement', datePaiement);
      data.append('modePaiement', modePaiement);
      if (reference) data.append('reference', reference);
      if (avance) data.append('montant', montant);
      preuves.forEach((f) => data.append('preuves', f));
      const res = await fetch(url, { method: 'POST', body: data });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'Paiement refusé.');
      toast.success(
        avance
          ? `Avance de ${fcfa(r.montant)} versée.`
          : r.mode === 'CAISSE'
            ? `Paiement de ${fcfa(r.montant)} sorti de la caisse : facture payée.`
            : `Paiement de ${fcfa(r.montant)} appliqué : facture payée.`
      );
      onPaye();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> {avance ? 'Verser une avance' : 'Appliquer le paiement'}</DialogTitle>
          <DialogDescription>
            {avance
              ? "L'avance sort de la caisse choisie, consomme la ligne de budget et s'impute à la proforma de la campagne. Le solde se paiera depuis la facture, avance déduite."
              : 'Le paiement sort de la caisse choisie et la facture passe « payée ». Le budget et la proforma suivent le rattachement de la facture.'}
          </DialogDescription>
        </DialogHeader>

        {chargement || !infos ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border p-3 space-y-1">
              {infos.facture && <p><span className="text-muted-foreground">Facture</span> <strong>{infos.facture.reference}</strong> — {infos.facture.fournisseur}</p>}
              {infos.commande && (
                <p>
                  <span className="text-muted-foreground">Bon de commande</span> {infos.commande.numero} ({fcfa(infos.commande.montantNet)})
                </p>
              )}
              {infos.ligne && (
                <p>
                  <span className="text-muted-foreground">Ligne de budget</span>{' '}
                  <Link href={`/budget/demandes/${infos.ligne.budgetId}`} className="text-primary hover:underline">
                    {infos.ligne.budgetNumero} — {infos.ligne.designation}
                  </Link>{' '}
                  (reste {fcfa(infos.ligne.reste)})
                </p>
              )}
              {infos.dejaPaye > 0 && <p><span className="text-muted-foreground">Déjà versé (avances)</span> {fcfa(infos.dejaPaye)}</p>}
              {infos.mode && (
                <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700">
                  <p className="font-semibold">Ce paiement va :</p>
                  <ul className="list-disc pl-4">
                    <li>sortir {infos.reste > 0 ? fcfa(infos.reste) : "l'argent"} de la caisse choisie ;</li>
                    {infos.mode === 'BUDGET' && infos.ligne && <li>le retirer de la ligne « {infos.ligne.designation} » du budget {infos.ligne.budgetNumero} ;</li>}
                    {infos.mode === 'BUDGET' && infos.ligne?.proformas && infos.ligne.proformas.length > 0 && (
                      <li>l&apos;enregistrer en dépense sur la proforma {infos.ligne.proformas.join(', ')} ;</li>
                    )}
                    {infos.mode === 'PROFORMA' && infos.proforma && (
                      <li>l&apos;enregistrer en dépense sur la proforma {infos.proforma.numero} (campagne sans budget) ;</li>
                    )}
                    <li>passer la facture « payée »{infos.commande ? ' et le bon de commande « payé »' : ''}.</li>
                  </ul>
                  {infos.mode === 'CAISSE' && <p className="mt-1 text-muted-foreground">Aucun budget n&apos;est rattaché à cette facture : rien n&apos;est retiré d&apos;un budget.</p>}
                </div>
              )}
              <p className="text-base"><span className="text-muted-foreground">{avance ? 'Reste du bon' : 'À payer'}</span> <strong>{fcfa(infos.reste)}</strong></p>
            </div>

            {infos.blocages.length > 0 && (
              <div className="rounded-md border-2 border-red-400 bg-red-50 p-3 space-y-1">
                {infos.blocages.map((b) => (
                  <p key={b} className="flex gap-2 text-red-800"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {b}</p>
                ))}
              </div>
            )}
            {!infos.peutPayer && <p className="text-amber-800">Seul le comptable (droit « Enregistrer les dépenses de budget ») peut appliquer un paiement.</p>}

            {!bloque && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {avance && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="pf-montant">Montant de l&apos;avance (XOF) *</Label>
                    <Input id="pf-montant" type="number" min={0} max={infos.reste} value={montant} onChange={(e) => setMontant(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Moyen de paiement *</Label>
                  <Select value={modePaiement} onValueChange={setModePaiement}>
                    <SelectTrigger><SelectValue placeholder="Choisir le moyen" /></SelectTrigger>
                    <SelectContent>
                      {moyensProposes(moyens, modePaiement).map((m) => (
                        <SelectItem key={m.code} value={m.code}>{m.nom}{!m.actif ? ' (désactivé)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Caisse *</Label>
                  <Select value={cashRegisterId} onValueChange={setCashRegisterId} disabled={caissesProposees.length === 0}>
                    <SelectTrigger><SelectValue placeholder={caissesProposees.length === 0 ? 'Aucune caisse' : 'Choisir la caisse'} /></SelectTrigger>
                    <SelectContent>
                      {caissesProposees.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.balance !== null ? ` — ${fcfa(c.balance)}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {moyensCharges && caissesProposees.length === 0 && (
                    <p className="text-xs text-amber-700">Aucune caisse n&apos;est liée à ce moyen de paiement : voyez Finance → Moyens de paiement.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-date">Date du paiement *</Label>
                  <Input id="pf-date" type="date" value={datePaiement} max={new Date().toISOString().split('T')[0]} onChange={(e) => setDatePaiement(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-ref">Référence (transaction, chèque…)</Label>
                  <Input id="pf-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pf-preuve">Preuve de paiement * (reçu MoMo, ordre de virement, décharge)</Label>
                  <Input id="pf-preuve" type="file" multiple accept="image/*,application/pdf" onChange={(e) => setPreuves(Array.from(e.target.files ?? []))} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={payer} disabled={bloque || envoi} className="gap-2">
            {envoi && <Loader2 className="h-4 w-4 animate-spin" />} {avance ? "Verser l'avance" : `Payer ${infos ? fcfa(infos.reste) : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
