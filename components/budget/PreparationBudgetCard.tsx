'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, Check, Info, RotateCcw, Send, UserCog, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { totauxParModePaiement } from '@/lib/budgetTypes';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';
import { LignesDepartementEditables, type EtatSection } from '@/components/budget/LignesDepartementEditables';
import { DocumentsLigneDialog, type DocumentLigne } from '@/components/budget/DocumentsLigneDialog';
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
  /** Documents du budget ; ceux qui ont un `ligneId` justifient une ligne (joints pendant la préparation). */
  attachments?: DocumentLigne[];
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
  const [documentsDe, setDocumentsDe] = useState<{ ligne: LignePreparation; modifiable: boolean } | null>(null);
  const [etats, setEtats] = useState<Record<string, EtatSection>>({});
  const { moyens } = useMoyensPaiement();
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
  // Totaux en direct : montants saisis (même pas encore enregistrés) remontés par chaque département.
  const onEtat = useCallback((depId: string, etat: EtatSection) => setEtats((p) => ({ ...p, [depId]: etat })), []);
  const montantsAffiches = sections.flatMap((s) => etats[s.departement.id]?.montants ?? s.lignes.filter((l) => l.statutValidation !== 'RETIREE').map((l) => ({ montant: Number(l.montant), modePaiement: l.modePaiement })));
  const total = montantsAffiches.reduce((s, x) => s + x.montant, 0);
  const totauxParMode = totauxParModePaiement(montantsAffiches, 'ESPECES', moyens).filter((x) => x.demande > 0);
  const nonEnregistre = sections.some((s) => etats[s.departement.id]?.modifie);
  useEffect(() => {
    if (!nonEnregistre) return;
    const prevenir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', prevenir);
    return () => window.removeEventListener('beforeunload', prevenir);
  }, [nonEnregistre]);
  const documentsLigne = (ligneId: string) => (demande.attachments ?? []).filter((a) => a.ligneId === ligneId);
  const saisiePour = new Set(p?.departementsSaisie.map((d) => d.id) ?? []);
  // Modifiable par ce compte : sa ligne, non retirée, et saisie ouverte (une ligne à corriger le reste après la date limite).
  const estModifiable = (l: LignePreparation) =>
    enPreparation && l.statutValidation !== 'RETIREE' && saLigne(l) && !!l.departementId && (saisiePour.has(l.departementId) || l.statutValidation === 'A_CORRIGER');
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
            sections.map(({ departement, lignes }) => (
              <LignesDepartementEditables
                key={departement.id}
                budgetId={demande.id}
                departement={departement}
                lignes={lignes}
                peutAjouter={saisiePour.has(departement.id)}
                estModifiable={estModifiable}
                peutCorriger={(l) => p.preparer && l.statutValidation !== 'RETIREE' && !saLigne(l)}
                nbDocuments={(id) => documentsLigne(id).length}
                onDocuments={(ligne, modifiable) => setDocumentsDe({ ligne, modifiable })}
                onCorrection={(ligne) => ouvrir({ type: 'correction', ligne })}
                onRetirer={(ligne) => ouvrir({ type: 'retirerLigne', ligne })}
                onEtat={onEtat}
                onEnregistre={onChange}
              />
            ))
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="text-base">
              <span className="text-muted-foreground mr-2">{p.toutVoir ? 'Total du budget' : 'Total de vos départements'} :</span>
              <strong className="tabular-nums">{fcfa(total)}</strong>
            </div>
            {totauxParMode.length > 1 && (
              <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {totauxParMode.map((x) => (
                  <span key={x.mode}>{x.label} : <span className="font-medium text-foreground">{fcfa(x.demande)}</span></span>
                ))}
              </div>
            )}
            {nonEnregistre && <p className="text-xs text-amber-700">Certaines lignes ne sont pas encore enregistrées : les totaux en tiennent compte.</p>}
          </div>
        </CardContent>
      )}

      <DocumentsLigneDialog
        budgetId={demande.id}
        ligne={documentsDe?.ligne ?? null}
        documents={documentsDe ? documentsLigne(documentsDe.ligne.id) : []}
        modifiable={!!documentsDe?.modifiable}
        open={!!documentsDe}
        onClose={() => setDocumentsDe(null)}
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
