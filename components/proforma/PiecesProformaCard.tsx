'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, BellRing, CheckCircle2, ExternalLink, FileText, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DELAI_RELANCE_DEFAUT,
  echeanceRelance,
  etatPiecesProforma,
  LIBELLES_DOCUMENT_PROFORMA,
  TYPES_DOCUMENT_PROFORMA,
  type TypeDocumentProformaValue,
} from '@/lib/proformaPieces';
import { cn } from '@/lib/utils';

export interface DocumentProforma {
  id: string;
  type: TypeDocumentProformaValue;
  url: string;
  fileName: string | null;
  precision: string | null;
  numeroFacture: string | null;
  montant: number | string | null;
  dateEmission: string | null;
  dateEnvoiClient: string | null;
  delaiRelanceJours: number | null;
  ajouteParNom: string | null;
  ajouteParEmail: string | null;
  createdAt: string;
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const jourIso = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const jourFr = (iso: string | Date | null) => (iso ? format(new Date(iso), 'dd/MM/yyyy') : '—');
const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

const COULEURS_TYPE: Record<TypeDocumentProformaValue, string> = {
  BON_COMMANDE: 'text-blue-600',
  FACTURE_NORMALISEE: 'text-green-600',
  ATTESTATION_BONNE_FIN: 'text-violet-600',
  AUTRE: 'text-slate-500',
};

/** Fenêtre d'ajout (fichier + informations) ou de modification (informations seulement) d'une pièce. */
function DocumentProformaDialog({
  open,
  invoiceId,
  typeInitial,
  document,
  onClose,
  onSuccess,
}: {
  open: boolean;
  invoiceId: string;
  typeInitial: TypeDocumentProformaValue;
  /** Pièce à modifier ; null = ajout. */
  document: DocumentProforma | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<TypeDocumentProformaValue>(typeInitial);
  const [fichier, setFichier] = useState<File | null>(null);
  const [precision, setPrecision] = useState('');
  const [numeroFacture, setNumeroFacture] = useState('');
  const [montant, setMontant] = useState('');
  const [dateEmission, setDateEmission] = useState(aujourdhui());
  const [dateEnvoiClient, setDateEnvoiClient] = useState(aujourdhui());
  const [delai, setDelai] = useState(String(DELAI_RELANCE_DEFAUT));
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFichier(null);
    if (document) {
      setType(document.type);
      setPrecision(document.precision ?? '');
      setNumeroFacture(document.numeroFacture ?? '');
      setMontant(document.montant === null ? '' : String(document.montant));
      setDateEmission(jourIso(document.dateEmission) || aujourdhui());
      setDateEnvoiClient(jourIso(document.dateEnvoiClient));
      setDelai(String(document.delaiRelanceJours ?? DELAI_RELANCE_DEFAUT));
      return;
    }
    setType(typeInitial);
    setPrecision('');
    setNumeroFacture('');
    setMontant('');
    setDateEmission(aujourdhui());
    setDateEnvoiClient(aujourdhui());
    // Délai proposé : réglage de l'entreprise (Paramètres).
    fetch(`/api/factures/${invoiceId}/documents`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDelai(String(d?.delaiRelanceDefaut ?? DELAI_RELANCE_DEFAUT)))
      .catch(() => setDelai(String(DELAI_RELANCE_DEFAUT)));
  }, [open, document, typeInitial, invoiceId]);

  const facture = type === 'FACTURE_NORMALISEE';
  const echeance = facture && dateEnvoiClient && Number(delai) > 0 ? echeanceRelance(dateEnvoiClient, Number(delai)) : null;

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document && !fichier) return void toast.error('Choisissez le fichier à joindre.');
    if (facture && !dateEmission) return void toast.error("Indiquez la date d'émission de la facture.");
    setEnvoi(true);
    try {
      const champs = { precision, numeroFacture, montant, dateEmission, dateEnvoiClient, delaiRelanceJours: delai };
      let res: Response;
      if (document) {
        res = await fetch(`/api/factures/${invoiceId}/documents/${document.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(champs),
        });
      } else {
        const data = new FormData();
        data.append('type', type);
        data.append('file', fichier!);
        Object.entries(champs).forEach(([k, v]) => data.append(k, v));
        res = await fetch(`/api/factures/${invoiceId}/documents`, { method: 'POST', body: data });
      }
      const reponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(reponse.error || "Erreur lors de l'enregistrement.");
      toast.success(document ? 'Pièce mise à jour.' : `${LIBELLES_DOCUMENT_PROFORMA[type]} ajoutée.`);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{document ? `Modifier : ${LIBELLES_DOCUMENT_PROFORMA[document.type]}` : 'Ajouter une pièce'}</DialogTitle>
          <DialogDescription>
            {facture
              ? "L'échéance de paiement se calcule à partir de la date d'envoi au client : date d'envoi + délai de relance."
              : 'La pièce est rangée avec les autres documents de la proforma.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={valider} className="space-y-4">
          {!document && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sorte de pièce *</Label>
                <Select value={type} onValueChange={(v) => setType(v as TypeDocumentProformaValue)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES_DOCUMENT_PROFORMA.map((t) => (
                      <SelectItem key={t} value={t}>{LIBELLES_DOCUMENT_PROFORMA[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="piece-fichier">Fichier *</Label>
                <Input id="piece-fichier" type="file" accept="image/*,application/pdf" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="piece-precision">Précision (facultatif)</Label>
            <Input id="piece-precision" value={precision} maxLength={200} onChange={(e) => setPrecision(e.target.value)} placeholder={facture ? 'Ex. : Acompte 50 %, Solde…' : ''} />
          </div>
          {facture && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="piece-numero">N° de facture (facultatif)</Label>
                  <Input id="piece-numero" value={numeroFacture} maxLength={80} onChange={(e) => setNumeroFacture(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piece-montant">Montant facturé (facultatif)</Label>
                  <Input id="piece-montant" type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="piece-emission">Émise le *</Label>
                  <Input id="piece-emission" type="date" value={dateEmission} max={aujourdhui()} onChange={(e) => setDateEmission(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piece-envoi">Envoyée au client le</Label>
                  <Input id="piece-envoi" type="date" value={dateEnvoiClient} min={dateEmission || undefined} max={aujourdhui()} onChange={(e) => setDateEnvoiClient(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piece-delai">Relance après (jours) *</Label>
                  <Input id="piece-delai" type="number" min={1} max={365} value={delai} onChange={(e) => setDelai(e.target.value)} required />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {echeance
                  ? `Paiement à réclamer à partir du ${format(echeance, 'dd/MM/yyyy')} s'il n'est pas soldé.`
                  : "Sans date d'envoi, pas de relance : renseignez-la dès que la facture part chez le client."}
              </p>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={envoi} disabled={envoi}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pièces de la proforma : alertes (facture normalisée manquante, paiement à réclamer), état du
 * dossier (complet ou ce qui manque), liste des pièces, ajout, modification et retrait.
 * `demandeAjout` ouvre la fenêtre d'ajout depuis l'extérieur (ex. juste après un encaissement).
 */
export function PiecesProformaCard({
  invoiceId,
  statut,
  resteAPayer,
  aRecette,
  documents,
  peutJoindre,
  demandeAjout,
  onDemandeAjoutTraitee,
  onChange,
}: {
  invoiceId: string;
  statut: string;
  resteAPayer: number;
  aRecette: boolean;
  documents: DocumentProforma[];
  peutJoindre: boolean;
  demandeAjout?: TypeDocumentProformaValue | null;
  onDemandeAjoutTraitee?: () => void;
  onChange: () => void;
}) {
  const [dialogue, setDialogue] = useState<{ open: boolean; type: TypeDocumentProformaValue; document: DocumentProforma | null }>({
    open: false,
    type: 'FACTURE_NORMALISEE',
    document: null,
  });
  const [aRetirer, setARetirer] = useState<DocumentProforma | null>(null);
  const [retrait, setRetrait] = useState(false);

  useEffect(() => {
    if (!demandeAjout || !peutJoindre) return;
    setDialogue({ open: true, type: demandeAjout, document: null });
    onDemandeAjoutTraitee?.();
  }, [demandeAjout, peutJoindre, onDemandeAjoutTraitee]);

  const etat = useMemo(() => etatPiecesProforma({ statut, resteAPayer, aRecette, documents }), [statut, resteAPayer, aRecette, documents]);
  const relanceDe = (id: string) => etat.relances.find((r) => r.documentId === id);

  const retirer = async () => {
    if (!aRetirer) return;
    setRetrait(true);
    try {
      const res = await fetch(`/api/factures/${invoiceId}/documents/${aRetirer.id}`, { method: 'DELETE' });
      const reponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(reponse.error || 'Retrait impossible.');
      toast.success('Pièce retirée (le retrait est noté dans l’historique).');
      setARetirer(null);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setRetrait(false);
    }
  };

  return (
    <Card className={cn('border-none shadow-md', etat.alerteRouge && 'ring-2 ring-red-500')}>
      <DocumentProformaDialog
        open={dialogue.open}
        invoiceId={invoiceId}
        typeInitial={dialogue.type}
        document={dialogue.document}
        onClose={() => setDialogue((d) => ({ ...d, open: false }))}
        onSuccess={onChange}
      />
      <Dialog open={!!aRetirer} onOpenChange={(o) => !o && setARetirer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Retirer cette pièce ?</DialogTitle>
            <DialogDescription>
              {aRetirer ? `${LIBELLES_DOCUMENT_PROFORMA[aRetirer.type]} — ${aRetirer.fileName ?? ''}` : ''}. Le retrait est noté dans l&apos;historique de la proforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARetirer(null)}>Annuler</Button>
            <Button variant="destructive" loading={retrait} disabled={retrait} onClick={retirer}>Retirer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardHeader className="pb-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-slate-500">
            <FileText className="w-4 h-4 text-blue-500" /> Pièces de la proforma
          </CardTitle>
          <div className="flex items-center gap-2">
            {etat.dossierComplet ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Dossier complet
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Manque : {etat.manquants.join(', ')}</span>
            )}
            {peutJoindre && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setDialogue({ open: true, type: etat.factureManquante ? 'FACTURE_NORMALISEE' : 'ATTESTATION_BONNE_FIN', document: null })}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Ajouter une pièce
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {etat.factureManquante && (
          <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold">Facture normalisée manquante</p>
              <p className="text-xs">
                {aRecette ? 'Une recette a déjà été encaissée' : 'La proforma est validée'} : joignez la facture normalisée émise au client.
              </p>
            </div>
            {peutJoindre && (
              <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700" onClick={() => setDialogue({ open: true, type: 'FACTURE_NORMALISEE', document: null })}>
                Joindre
              </Button>
            )}
          </div>
        )}
        {etat.relances.filter((r) => r.enRetard).map((r) => (
          <div key={r.documentId} className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <BellRing className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
            <p>
              <span className="font-semibold">Paiement à réclamer</span> — {r.libelle} : échéance du {jourFr(r.echeance)}
              {r.joursRestants < 0 ? ` (dépassée de ${-r.joursRestants} j)` : " (aujourd'hui)"}. Reste à encaisser : <strong>{fcfa(resteAPayer)}</strong>.
            </p>
          </div>
        ))}
        {etat.relanceProche && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <BellRing className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Échéance de paiement proche : {etat.relances.filter((r) => r.proche).map((r) => `${r.libelle} le ${jourFr(r.echeance)}`).join(', ')}.</p>
          </div>
        )}
        {etat.envoiNonRenseigne && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Date d&apos;envoi au client non renseignée : la relance de paiement ne peut pas être calculée. Modifiez la facture pour l&apos;indiquer.
          </p>
        )}

        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune pièce jointe.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {documents.map((d) => {
              const relance = relanceDe(d.id);
              return (
                <li key={d.id} className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={cn('text-xs font-bold uppercase', COULEURS_TYPE[d.type])}>
                      {LIBELLES_DOCUMENT_PROFORMA[d.type]}
                      {d.precision ? <span className="ml-1 font-normal normal-case text-muted-foreground">— {d.precision}</span> : null}
                    </p>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline break-all">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {d.fileName ?? 'Voir le document'}
                    </a>
                    {d.type === 'FACTURE_NORMALISEE' && (
                      <p className="text-xs text-muted-foreground">
                        {d.numeroFacture ? `N° ${d.numeroFacture} · ` : ''}
                        {d.montant !== null && d.montant !== '' ? `${fcfa(Number(d.montant))} · ` : ''}
                        émise le {jourFr(d.dateEmission)} · {d.dateEnvoiClient ? `envoyée le ${jourFr(d.dateEnvoiClient)}` : 'pas encore envoyée'} · relance à {d.delaiRelanceJours ?? DELAI_RELANCE_DEFAUT} j
                        {relance && (
                          <span className={cn('ml-1 font-semibold', relance.enRetard ? 'text-red-700' : relance.proche ? 'text-amber-700' : 'text-slate-600')}>
                            → échéance {jourFr(relance.echeance)}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Ajoutée le {jourFr(d.createdAt)}{d.ajouteParNom || d.ajouteParEmail ? ` par ${d.ajouteParNom ?? d.ajouteParEmail}` : ''}
                    </p>
                  </div>
                  {peutJoindre && (
                    <div className="flex gap-1 shrink-0">
                      {d.type === 'FACTURE_NORMALISEE' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier les dates" onClick={() => setDialogue({ open: true, type: d.type, document: d })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Retirer" onClick={() => setARetirer(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
