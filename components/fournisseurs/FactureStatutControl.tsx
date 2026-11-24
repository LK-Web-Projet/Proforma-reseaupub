'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { FactureFournisseurStatusBadge, StatusDot } from '@/components/FactureFournisseurStatusBadge';
import { useDroits } from '@/components/DroitsProvider';
import { LIBELLES_STATUT_FACTURE, transitionsFacture, type StatutFacture } from '@/lib/factureStatut';
import { moyensProposes } from '@/lib/moyensPaiement';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';

export interface FactureStatutInfo {
  id: string;
  reference: string;
  status: StatutFacture;
  commandeId?: string | null;
  ligneBudgetId?: string | null;
  /** Renseignés si la facture a été marquée payée hors plateforme. */
  paiementManuelDate?: string | null;
  paiementManuelMode?: string | null;
}

interface HistoriqueEntree {
  id: string;
  ancienStatut: StatutFacture;
  nouveauStatut: StatutFacture;
  datePaiement: string | null;
  preuve: string | null;
  reference: string | null;
  motif: string | null;
  auteurEmail: string;
  auteurNom: string | null;
  createdAt: string;
  moyenPaiement: { nom: string } | null;
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const RAISONS: Record<string, string> = {
  'par le budget': 'par « Appliquer le paiement »',
  'droit manquant': 'droit manquant',
};

/**
 * Statut d'une facture de prestataire : étiquette, menu des changements permis (selon les droits et
 * la facture) et historique. « Payée » sans paiement demande le moyen de paiement, la date et la
 * preuve ; les autres changements, un motif facultatif. Le serveur refait tous les contrôles.
 */
export function FactureStatutControl({ facture, onChange }: { facture: FactureStatutInfo; onChange: () => void }) {
  const { peut } = useDroits();
  const { moyens, libelle } = useMoyensPaiement();
  const [cible, setCible] = useState<StatutFacture | null>(null);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [historique, setHistorique] = useState<HistoriqueEntree[] | null>(null);
  const [modePaiement, setModePaiement] = useState('');
  const [datePaiement, setDatePaiement] = useState(aujourdhui());
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState('');
  const [preuve, setPreuve] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const transitions = transitionsFacture(facture, peut);
  const modifiable = transitions.some((t) => t.possible);
  const horsPlateforme = facture.status === 'PAYEE' && !!facture.paiementManuelDate;

  const ouvrir = (statut: StatutFacture) => {
    setCible(statut);
    setModePaiement('');
    setDatePaiement(aujourdhui());
    setReference('');
    setMotif('');
    setPreuve(null);
  };

  useEffect(() => {
    if (!historiqueOuvert) return;
    setHistorique(null);
    fetch(`/api/factures-fournisseurs/${facture.id}/statut`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => setHistorique(d.historiqueStatut ?? []))
      .catch(() => {
        setHistorique([]);
        toast.error("Impossible de charger l'historique.");
      });
  }, [historiqueOuvert, facture.id]);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cible) return;
    if (cible === 'PAYEE') {
      if (!modePaiement) return void toast.error('Choisissez le moyen de paiement utilisé.');
      if (!datePaiement) return void toast.error('Indiquez la date du paiement.');
      if (!preuve) return void toast.error('Joignez la preuve du paiement.');
    }
    setEnvoi(true);
    try {
      const data = new FormData();
      data.append('statut', cible);
      if (cible === 'PAYEE') {
        data.append('modePaiement', modePaiement);
        data.append('datePaiement', datePaiement);
        data.append('reference', reference);
        data.append('preuve', preuve!);
      } else {
        data.append('motif', motif);
      }
      const res = await fetch(`/api/factures-fournisseurs/${facture.id}/statut`, { method: 'POST', body: data });
      const reponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(reponse.message || reponse.error || 'Erreur lors du changement de statut.');
      toast.success(`Facture ${facture.reference} : « ${LIBELLES_STATUT_FACTURE[cible]} ».`);
      setCible(null);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  const etiquette = (
    <span className="inline-flex flex-col items-start gap-0.5">
      <FactureFournisseurStatusBadge status={facture.status} animate={false} />
      {horsPlateforme && (
        <span className="text-[10px] text-muted-foreground">
          hors plateforme · {libelle(facture.paiementManuelMode)}
        </span>
      )}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {modifiable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded-md hover:bg-muted/60 p-0.5 cursor-pointer" aria-label="Changer le statut">
              {etiquette}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Changer le statut</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {transitions.map((t) => (
              <DropdownMenuItem key={t.statut} disabled={!t.possible} onSelect={() => ouvrir(t.statut)}>
                <StatusDot status={t.statut} animate={false} />
                {t.statut === 'PAYEE' && facture.status === 'EN_ATTENTE' ? 'Payée (réglée hors plateforme)' : LIBELLES_STATUT_FACTURE[t.statut]}
                {!t.possible && t.raison && <span className="ml-auto pl-3 text-[10px] text-muted-foreground">{RAISONS[t.raison] ?? t.raison}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        etiquette
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setHistoriqueOuvert(true)}>
              <History className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Historique du statut</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Changement de statut */}
      <Dialog open={!!cible} onOpenChange={(o) => !o && setCible(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {cible === 'PAYEE' ? 'Marquer la facture payée' : `Passer la facture « ${cible ? LIBELLES_STATUT_FACTURE[cible] : ''} »`}
            </DialogTitle>
            <DialogDescription>
              Facture {facture.reference} — actuellement « {LIBELLES_STATUT_FACTURE[facture.status]} ».
              {cible === 'PAYEE' && ' Paiement fait hors plateforme : aucune sortie de caisse, la facture est seulement notée payée.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={valider} className="space-y-4">
            {cible === 'PAYEE' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Moyen de paiement *</Label>
                    <Select value={modePaiement} onValueChange={setModePaiement}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Choisir le moyen" /></SelectTrigger>
                      <SelectContent>
                        {moyensProposes(moyens).map((m) => (
                          <SelectItem key={m.code} value={m.code}>{m.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`fs-date-${facture.id}`}>Date du paiement *</Label>
                    <Input id={`fs-date-${facture.id}`} type="date" value={datePaiement} max={aujourdhui()} onChange={(e) => setDatePaiement(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fs-ref-${facture.id}`}>Référence (facultatif)</Label>
                  <Input id={`fs-ref-${facture.id}`} value={reference} maxLength={200} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction, de chèque, de virement…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fs-preuve-${facture.id}`}>Preuve du paiement *</Label>
                  <Input id={`fs-preuve-${facture.id}`} type="file" accept="image/*,application/pdf" onChange={(e) => setPreuve(e.target.files?.[0] ?? null)} required />
                  <p className="text-xs text-muted-foreground">Reçu, ordre de virement, capture Mobile Money, décharge…</p>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`fs-motif-${facture.id}`}>Motif (facultatif)</Label>
                <Textarea id={`fs-motif-${facture.id}`} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : facture en double, erreur de saisie…" />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCible(null)}>Annuler</Button>
              <Button type="submit" loading={envoi} disabled={envoi} variant={cible === 'ANNULEE' ? 'destructive' : 'default'}>
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Historique */}
      <Dialog open={historiqueOuvert} onOpenChange={setHistoriqueOuvert}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historique du statut — {facture.reference}</DialogTitle>
            <DialogDescription>Changements faits à la main. Les paiements appliqués depuis le budget apparaissent sur la fiche du budget.</DialogDescription>
          </DialogHeader>
          {historique === null ? (
            <p className="text-sm text-muted-foreground py-4">Chargement…</p>
          ) : historique.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucun changement fait à la main.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto space-y-3 text-sm">
              {historique.map((h) => (
                <li key={h.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {LIBELLES_STATUT_FACTURE[h.ancienStatut]} → <strong>{LIBELLES_STATUT_FACTURE[h.nouveauStatut]}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.createdAt), 'dd/MM/yyyy HH:mm')} · {h.auteurNom ?? h.auteurEmail}
                    </span>
                  </div>
                  {h.moyenPaiement && (
                    <p className="text-xs text-muted-foreground">
                      Payée par {h.moyenPaiement.nom}
                      {h.datePaiement ? ` le ${format(new Date(h.datePaiement), 'dd/MM/yyyy')}` : ''}
                      {h.reference ? ` — réf. ${h.reference}` : ''}
                    </p>
                  )}
                  {h.motif && <p className="text-xs italic text-muted-foreground">{h.motif}</p>}
                  {h.preuve && <AttachmentPreviewButton url={h.preuve} title={`Preuve de paiement — ${facture.reference}`} />}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
}
