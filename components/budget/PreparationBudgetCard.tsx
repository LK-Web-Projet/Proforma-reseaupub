'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, Check, Info, Pencil, Plus, RotateCcw, Send, Trash2, UserCog, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORIE_DEPENSE_LABELS, CATEGORIE_DEPENSE_VALUES, categorieLabel } from '@/lib/budgetTypes';
import { moyensProposes } from '@/lib/moyensPaiement';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';
import { cn } from '@/lib/utils';

export interface LignePreparation {
  id: string;
  designation: string;
  montant: number | string;
  categorie: string | null;
  modePaiement: string | null;
  detail: string | null;
  dateLimite: string | null;
  departementId: string | null;
  departement?: { id: string; nom: string } | null;
  statutValidation: string;
  motifDecision: string | null;
  ajouteeParEmail?: string | null;
  ajouteeParNom?: string | null;
}

export interface BudgetPreparation {
  id: string;
  numero: string;
  statut: string;
  collectif?: boolean;
  dateLimiteSaisie?: string | null;
  responsableEmail?: string | null;
  responsableNom?: string | null;
  requesterEmail: string;
  requesterName?: string | null;
  pretASoumettreAt?: string | null;
  departementsInvites?: { departementId: string; departement: { id: string; nom: string } }[];
  lignes: LignePreparation[];
  vuePartielle?: boolean;
  preparation?: {
    toutVoir: boolean;
    responsable: boolean;
    preparer: boolean;
    saisieOuverte: boolean;
    departementsSaisie: { id: string; nom: string }[];
    mesDepartements: string[];
    email: string;
  };
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
const jourFr = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd/MM/yyyy', { locale: fr }) : null);

async function envoyerAction(id: string, corps: Record<string, unknown>) {
  const res = await fetch(`/api/demandes-budget/${id}/preparation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Action impossible.');
  return data.message as string;
}

/** Ajout ou modification d'une ligne de son département pendant la préparation. */
function LigneDialog({
  budgetId,
  departements,
  ligne,
  open,
  onClose,
  onFait,
}: {
  budgetId: string;
  departements: { id: string; nom: string }[];
  ligne: LignePreparation | null;
  open: boolean;
  onClose: () => void;
  onFait: () => void;
}) {
  const { moyens } = useMoyensPaiement();
  const [v, setV] = useState({ departementId: '', designation: '', categorie: '', modePaiement: 'ESPECES', montant: '', detail: '', dateLimite: '' });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setV(
      ligne
        ? {
            departementId: ligne.departementId ?? '',
            designation: ligne.designation,
            categorie: ligne.categorie ?? '',
            modePaiement: ligne.modePaiement ?? 'ESPECES',
            montant: String(Number(ligne.montant)),
            detail: ligne.detail ?? '',
            dateLimite: ligne.dateLimite ? ligne.dateLimite.slice(0, 10) : '',
          }
        : { departementId: departements.length === 1 ? departements[0].id : '', designation: '', categorie: '', modePaiement: 'ESPECES', montant: '', detail: '', dateLimite: '' }
    );
  }, [open, ligne, departements]);

  const enregistrer = async () => {
    if (!v.departementId) return void toast.error('Choisissez le département.');
    if (!v.designation.trim()) return void toast.error('Indiquez la désignation.');
    if (!v.categorie) return void toast.error('Choisissez une catégorie.');
    if (!(Number(v.montant) > 0)) return void toast.error('Indiquez un montant supérieur à 0.');
    setEnvoi(true);
    try {
      const donnees = {
        departementId: v.departementId,
        designation: v.designation.trim(),
        categorie: v.categorie,
        modePaiement: v.modePaiement,
        montant: Number(v.montant),
        detail: v.detail.trim() || undefined,
        dateLimite: v.dateLimite || undefined,
      };
      toast.success(await envoyerAction(budgetId, ligne ? { action: 'modifierLigne', ligneId: ligne.id, ligne: donnees } : { action: 'ajouterLigne', ligne: donnees }));
      onFait();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !envoi && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ligne ? 'Modifier la ligne' : 'Ajouter une ligne'}</DialogTitle>
          {ligne?.statutValidation === 'A_CORRIGER' && ligne.motifDecision && (
            <DialogDescription className="text-amber-800">À corriger : {ligne.motifDecision}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Département *</label>
            <Select value={v.departementId} onValueChange={(x) => setV((p) => ({ ...p, departementId: x }))}>
              <SelectTrigger><SelectValue placeholder="Choisir le département" /></SelectTrigger>
              <SelectContent>
                {departements.map((d) => <SelectItem key={d.id} value={d.id}>{d.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Désignation *</label>
            <Input value={v.designation} onChange={(e) => setV((p) => ({ ...p, designation: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Catégorie *</label>
            <Select value={v.categorie} onValueChange={(x) => setV((p) => ({ ...p, categorie: x }))}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {CATEGORIE_DEPENSE_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Moyen de paiement prévu *</label>
            <Select value={v.modePaiement} onValueChange={(x) => setV((p) => ({ ...p, modePaiement: x }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {moyensProposes(moyens, v.modePaiement).map((m) => <SelectItem key={m.code} value={m.code}>{m.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Montant (XOF) *</label>
            <Input type="number" min={0} value={v.montant} onChange={(e) => setV((p) => ({ ...p, montant: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Délai (facultatif)</label>
            <Input type="date" value={v.dateLimite} onChange={(e) => setV((p) => ({ ...p, dateLimite: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Détail (facultatif)</label>
            <Textarea rows={2} maxLength={2000} value={v.detail} onChange={(e) => setV((p) => ({ ...p, detail: e.target.value }))} placeholder="Quantités, prix unitaires, fournisseur pressenti…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={envoi}>Annuler</Button>
          <Button onClick={enregistrer} loading={envoi} disabled={envoi}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DialogueAction =
  | { type: 'correction' | 'retirerLigne'; ligne: LignePreparation }
  | { type: 'inviter' }
  | { type: 'dateLimite' }
  | { type: 'transferer' }
  | { type: 'soumettre' }
  | null;

/**
 * Budget collectif : départements invités, leurs lignes et leur total, actions de préparation selon
 * les droits — chacun ses lignes ; le comptable demande une correction, retire, soumet à la direction
 * ou rouvre ; le responsable invite, fixe la date limite, transfère et signale « prêt ».
 */
export function PreparationBudgetCard({ demande, onChange }: { demande: BudgetPreparation; onChange: () => void }) {
  const p = demande.preparation;
  const enPreparation = demande.statut === 'EN_PREPARATION';
  const [ligneDialog, setLigneDialog] = useState<{ open: boolean; ligne: LignePreparation | null }>({ open: false, ligne: null });
  const [dialogue, setDialogue] = useState<DialogueAction>(null);
  const [texte, setTexte] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [tousDepartements, setTousDepartements] = useState<{ id: string; nom: string }[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const invites = useMemo(() => demande.departementsInvites ?? [], [demande.departementsInvites]);
  const coordinateur = !!p && (p.responsable || p.preparer);
  const moi = p?.email?.toLowerCase() ?? '';
  const saLigne = (l: LignePreparation) => !!p && ((!!l.departementId && p.mesDepartements.includes(l.departementId)) || l.ajouteeParEmail?.toLowerCase() === moi);

  // Départements affichés : tous les invités (vue complète), sinon les siens.
  const sections = useMemo(() => {
    const visibles = p?.toutVoir ? invites.map((i) => i.departement) : invites.map((i) => i.departement).filter((d) => p?.mesDepartements.includes(d.id) || demande.lignes.some((l) => l.departementId === d.id));
    return visibles.map((d) => {
      const lignes = demande.lignes.filter((l) => l.departementId === d.id);
      const actives = lignes.filter((l) => l.statutValidation !== 'RETIREE');
      return { departement: d, lignes, total: actives.reduce((s, l) => s + Number(l.montant), 0), nb: actives.length };
    });
  }, [invites, demande.lignes, p]);
  const total = sections.reduce((s, x) => s + x.total, 0);
  const sansSaisie = sections.filter((s) => s.nb === 0).length;
  const aCorriger = demande.lignes.filter((l) => l.statutValidation === 'A_CORRIGER').length;

  useEffect(() => {
    if (dialogue?.type !== 'inviter') return;
    fetch('/api/departements?actifs=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: { id: string; nom: string }[]) => setTousDepartements(d.filter((x) => !invites.some((i) => i.departementId === x.id))))
      .catch(() => setTousDepartements([]));
  }, [dialogue, invites]);

  const ouvrir = (d: DialogueAction) => {
    setTexte(d?.type === 'dateLimite' ? (demande.dateLimiteSaisie ?? '').slice(0, 10) : '');
    setSelection([]);
    setDialogue(d);
  };

  const executer = async (corps: Record<string, unknown>) => {
    setEnvoi(true);
    try {
      toast.success(await envoyerAction(demande.id, corps));
      setDialogue(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = (l: LignePreparation) => {
    if (!window.confirm(`Supprimer la ligne « ${l.designation} » ?`)) return;
    void executer({ action: 'supprimerLigne', ligneId: l.id });
  };

  if (!demande.collectif || !p) return null;

  return (
    <Card className={cn('shadow-sm', enPreparation ? 'border-2 border-violet-300' : 'border-violet-200')}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 text-violet-800">
              <Users className="h-4 w-4" /> {enPreparation ? 'Budget collectif en préparation' : 'Budget collectif'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>Responsable : <strong className="text-foreground">{demande.responsableNom || demande.responsableEmail || demande.requesterName || demande.requesterEmail}</strong></span>
              <span className={cn(!p.saisieOuverte && enPreparation && 'text-red-700 font-medium')}>
                <CalendarClock className="inline h-3 w-3 mr-0.5" />
                Date limite de saisie : {jourFr(demande.dateLimiteSaisie) ?? 'aucune'}
                {!p.saisieOuverte && enPreparation ? ' (passée)' : ''}
              </span>
              <span>{invites.length} département(s) invité(s)</span>
              {demande.pretASoumettreAt && enPreparation && <span className="text-green-700">Signalé prêt le {jourFr(demande.pretASoumettreAt)}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {enPreparation && p.departementsSaisie.length > 0 && (
              <Button size="sm" className="gap-1" onClick={() => setLigneDialog({ open: true, ligne: null })}>
                <Plus className="h-4 w-4" /> Ajouter une ligne
              </Button>
            )}
            {enPreparation && coordinateur && (
              <>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => ouvrir({ type: 'inviter' })}><Users className="h-4 w-4" /> Inviter</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => ouvrir({ type: 'dateLimite' })}><CalendarClock className="h-4 w-4" /> Date limite</Button>
              </>
            )}
            {coordinateur && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => ouvrir({ type: 'transferer' })}><UserCog className="h-4 w-4" /> Responsable</Button>
            )}
            {enPreparation && p.responsable && !p.preparer && (
              <Button size="sm" variant="outline" className="gap-1 text-green-700" onClick={() => void executer({ action: 'pret' })} loading={envoi} disabled={envoi}>
                <Check className="h-4 w-4" /> Prêt à soumettre
              </Button>
            )}
            {enPreparation && p.preparer && (
              <Button size="sm" className="gap-1 bg-violet-700 hover:bg-violet-800" onClick={() => ouvrir({ type: 'soumettre' })}>
                <Send className="h-4 w-4" /> Soumettre à la direction
              </Button>
            )}
            {demande.statut === 'SOUMISE' && p.preparer && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => void executer({ action: 'rouvrir' })} loading={envoi} disabled={envoi}>
                <RotateCcw className="h-4 w-4" /> Rouvrir la préparation
              </Button>
            )}
          </div>
        </div>
        {demande.vuePartielle && (
          <p className="flex gap-2 rounded-md bg-violet-50 p-2 text-xs text-violet-900">
            <Info className="h-4 w-4 shrink-0" /> Vous voyez les lignes de vos départements, leur total et ce qui les concerne.
          </p>
        )}
        {enPreparation && p.preparer && (aCorriger > 0 || sansSaisie > 0) && (
          <p className="flex gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {aCorriger > 0 ? `${aCorriger} ligne(s) attendent leur correction. ` : ''}
            {sansSaisie > 0 ? `${sansSaisie} département(s) n'ont encore rien saisi.` : ''}
          </p>
        )}
      </CardHeader>

      {enPreparation && (
        <CardContent className="space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun de vos départements n&apos;est invité à ce budget.</p>
          ) : (
            sections.map(({ departement, lignes, total: totalDep, nb }) => (
              <div key={departement.id} className="rounded-md border">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <p className="text-sm font-semibold">{departement.nom}</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{nb} ligne(s) · </span>
                    <strong>{fcfa(totalDep)}</strong>
                  </p>
                </div>
                {lignes.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground italic">Aucune ligne saisie pour le moment.</p>
                ) : (
                  <ul className="divide-y">
                    {lignes.map((l) => {
                      const retiree = l.statutValidation === 'RETIREE';
                      const modifiable = !retiree && saLigne(l);
                      return (
                        <li key={l.id} className={cn('flex flex-col sm:flex-row sm:items-start gap-2 px-3 py-2 text-sm', retiree && 'opacity-60')}>
                          <div className="min-w-0 flex-1">
                            <p className={cn('font-medium break-words', retiree && 'line-through')}>{l.designation}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {categorieLabel(l.categorie)}
                              {l.dateLimite ? ` · délai ${jourFr(l.dateLimite)}` : ''}
                              {l.ajouteeParNom || l.ajouteeParEmail ? ` · saisie par ${l.ajouteeParNom || l.ajouteeParEmail}` : ''}
                            </p>
                            {l.detail && <p className="text-[11px] text-muted-foreground whitespace-pre-line">{l.detail}</p>}
                            {l.statutValidation === 'A_CORRIGER' && (
                              <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-amber-800 font-normal whitespace-normal">À corriger : {l.motifDecision}</Badge>
                            )}
                            {retiree && l.motifDecision && <p className="text-[11px] text-red-700">Retirée : {l.motifDecision}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className={cn('font-semibold whitespace-nowrap', retiree && 'line-through')}>{fcfa(Number(l.montant))}</span>
                            {modifiable && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier" onClick={() => setLigneDialog({ open: true, ligne: l })}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Supprimer" onClick={() => supprimer(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                            {p.preparer && !retiree && !saLigne(l) && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-700" onClick={() => ouvrir({ type: 'correction', ligne: l })}>Correction</Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-700" onClick={() => ouvrir({ type: 'retirerLigne', ligne: l })}>Retirer</Button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground mr-2">{p.toutVoir ? 'Total du budget' : 'Total de vos départements'} :</span>
            <strong>{fcfa(total)}</strong>
          </div>
        </CardContent>
      )}

      <LigneDialog
        budgetId={demande.id}
        departements={ligneDialog.ligne?.departement ? [ligneDialog.ligne.departement, ...p.departementsSaisie.filter((d) => d.id !== ligneDialog.ligne?.departementId)] : p.departementsSaisie}
        ligne={ligneDialog.ligne}
        open={ligneDialog.open}
        onClose={() => setLigneDialog({ open: false, ligne: null })}
        onFait={onChange}
      />

      <Dialog open={!!dialogue} onOpenChange={(o) => !o && !envoi && setDialogue(null)}>
        <DialogContent className="sm:max-w-md">
          {dialogue && (dialogue.type === 'correction' || dialogue.type === 'retirerLigne') && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogue.type === 'correction' ? 'Demander une correction' : 'Retirer la ligne'}</DialogTitle>
                <DialogDescription>
                  « {dialogue.ligne.designation} » ({fcfa(Number(dialogue.ligne.montant))}) — {dialogue.ligne.departement?.nom}. Le département est prévenu.
                </DialogDescription>
              </DialogHeader>
              <Textarea rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={dialogue.type === 'correction' ? 'Ce qu’il faut corriger' : 'Motif du retrait'} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogue(null)} disabled={envoi}>Annuler</Button>
                <Button
                  className={dialogue.type === 'retirerLigne' ? 'bg-red-600 hover:bg-red-700' : undefined}
                  loading={envoi}
                  disabled={envoi || texte.trim().length < 3}
                  onClick={() => void executer({ action: dialogue.type, ligneId: dialogue.ligne.id, motif: texte })}
                >
                  {dialogue.type === 'correction' ? 'Demander la correction' : 'Retirer'}
                </Button>
              </DialogFooter>
            </>
          )}
          {dialogue?.type === 'inviter' && (
            <>
              <DialogHeader>
                <DialogTitle>Inviter des départements</DialogTitle>
                <DialogDescription>Leurs membres sont prévenus et pourront saisir leurs lignes.</DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {tousDepartements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tous les départements actifs sont déjà invités.</p>
                ) : (
                  tousDepartements.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <input type="checkbox" checked={selection.includes(d.id)} onChange={() => setSelection((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
                      {d.nom}
                    </label>
                  ))
                )}
              </div>
              {invites.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs font-medium mb-1">Déjà invités (retirer un département sans ligne) :</p>
                  <div className="flex flex-wrap gap-1">
                    {invites.map((i) => (
                      <Badge key={i.departementId} variant="secondary" className="gap-1 font-normal">
                        {i.departement.nom}
                        <button type="button" title="Retirer ce département" disabled={envoi} onClick={() => void executer({ action: 'retirerInvitation', departementId: i.departementId })}>
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogue(null)} disabled={envoi}>Fermer</Button>
                <Button loading={envoi} disabled={envoi || selection.length === 0} onClick={() => void executer({ action: 'inviter', departementIds: selection })}>Inviter</Button>
              </DialogFooter>
            </>
          )}
          {dialogue?.type === 'dateLimite' && (
            <>
              <DialogHeader>
                <DialogTitle>Date limite de saisie</DialogTitle>
                <DialogDescription>Après cette date, seuls le responsable et le comptable peuvent encore saisir. Un rappel part la veille.</DialogDescription>
              </DialogHeader>
              <Input type="date" value={texte} onChange={(e) => setTexte(e.target.value)} className="max-w-[200px]" />
              <DialogFooter>
                <Button variant="outline" onClick={() => void executer({ action: 'dateLimite', dateLimiteSaisie: null })} disabled={envoi}>Aucune date</Button>
                <Button loading={envoi} disabled={envoi || !texte} onClick={() => void executer({ action: 'dateLimite', dateLimiteSaisie: texte })}>Enregistrer</Button>
              </DialogFooter>
            </>
          )}
          {dialogue?.type === 'transferer' && (
            <>
              <DialogHeader>
                <DialogTitle>Changer de responsable</DialogTitle>
                <DialogDescription>Adresse e-mail du compte qui coordonnera ce budget (invitations, date limite).</DialogDescription>
              </DialogHeader>
              <Input type="email" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="prenom.nom@…" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogue(null)} disabled={envoi}>Annuler</Button>
                <Button loading={envoi} disabled={envoi || !texte.includes('@')} onClick={() => void executer({ action: 'transferer', email: texte })}>Transférer</Button>
              </DialogFooter>
            </>
          )}
          {dialogue?.type === 'soumettre' && (
            <>
              <DialogHeader>
                <DialogTitle>Soumettre le budget {demande.numero} à la direction ?</DialogTitle>
                <DialogDescription>
                  {sections.reduce((s, x) => s + x.nb, 0)} ligne(s) de {sections.filter((x) => x.nb > 0).length} département(s), pour {fcfa(total)}. La saisie se ferme et la
                  validation ligne par ligne commence.
                </DialogDescription>
              </DialogHeader>
              {(aCorriger > 0 || sansSaisie > 0) && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                  {aCorriger > 0 ? `${aCorriger} ligne(s) attendent encore leur correction (la soumission sera refusée). ` : ''}
                  {sansSaisie > 0 ? `${sansSaisie} département(s) n'ont rien saisi.` : ''}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogue(null)} disabled={envoi}>Annuler</Button>
                <Button className="bg-violet-700 hover:bg-violet-800" loading={envoi} disabled={envoi} onClick={() => void executer({ action: 'soumettre' })}>Soumettre</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
