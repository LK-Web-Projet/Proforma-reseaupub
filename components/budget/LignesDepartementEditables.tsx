'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NotebookPen, Paperclip, Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChampAutoHauteur } from '@/components/budget/ChampAutoHauteur';
import { CATEGORIE_DEPENSE_LABELS, CATEGORIE_DEPENSE_VALUES, categorieLabel } from '@/lib/budgetTypes';
import { moyensProposes } from '@/lib/moyensPaiement';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';
import { cn } from '@/lib/utils';
import type { LignePreparation } from '@/components/budget/PreparationBudgetCard';

const MODE_DEFAUT = 'ESPECES';
const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
const jourFr = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd/MM/yyyy', { locale: fr }) : null);

// Même présentation que les lignes du budget ponctuel (DemandeBudgetForm) : une rangée quand la place
// suffit (conteneur ≥ 56rem), deux colonnes sinon, empilé sur téléphone — jamais de défilement horizontal.
const GRILLE = '@4xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]';
const LIBELLE = 'block text-xs font-medium text-muted-foreground @4xl:hidden';
const SELECT_LIGNE = 'w-full min-h-9 data-[size=default]:h-auto whitespace-normal text-left *:data-[slot=select-value]:line-clamp-none';

/** Valeurs saisies d'une ligne (existante ou nouvelle), en texte comme dans les champs. */
interface Brouillon {
  cle: string;
  id?: string;
  designation: string;
  categorie: string;
  modePaiement: string;
  montant: string;
  detail: string;
  dateLimite: string;
  detailOuvert?: boolean;
  /** Ligne existante à supprimer à l'enregistrement. */
  supprimee?: boolean;
  /** Ligne à corriger renvoyée sans changement (« Corrigée telle quelle »). */
  renvoyer?: boolean;
}

const depuisLigne = (l: LignePreparation): Brouillon => ({
  cle: l.id,
  id: l.id,
  designation: l.designation,
  categorie: l.categorie ?? '',
  modePaiement: l.modePaiement ?? MODE_DEFAUT,
  montant: String(Number(l.montant)),
  detail: l.detail ?? '',
  dateLimite: l.dateLimite ? l.dateLimite.slice(0, 10) : '',
});

const CHAMPS = ['designation', 'categorie', 'modePaiement', 'montant', 'detail', 'dateLimite'] as const;
const change = (b: Brouillon, l: LignePreparation) => {
  const o = depuisLigne(l);
  return CHAMPS.some((c) => (c === 'montant' ? Number(b.montant) !== Number(o.montant) : b[c].trim() !== o[c].trim()));
};
const vide = (b: Brouillon) => !b.designation.trim() && !b.categorie && !b.montant.trim() && !b.detail.trim() && !b.dateLimite;

let compteur = 0;
const nouvelle = (): Brouillon => ({ cle: `nouvelle-${++compteur}`, designation: '', categorie: '', modePaiement: MODE_DEFAUT, montant: '', detail: '', dateLimite: '' });

/** Ce que la section remonte à la carte : montants affichés (pour les totaux) et modifications en cours. */
export interface EtatSection {
  montants: { montant: number; modePaiement: string | null }[];
  modifie: boolean;
}

/**
 * Lignes d'un département dans un budget collectif en préparation, modifiables directement comme le
 * budget ponctuel : ses lignes en champs, celles des autres en lecture (le comptable y demande une
 * correction ou les retire). Le total se recalcule pendant la saisie ; « Enregistrer » envoie tout d'un
 * coup (tout ou rien, contrôlé par le serveur).
 */
export function LignesDepartementEditables({
  budgetId,
  departement,
  lignes,
  peutAjouter,
  estModifiable,
  peutCorriger,
  nbDocuments,
  onDocuments,
  onCorrection,
  onRetirer,
  onEtat,
  onEnregistre,
}: {
  budgetId: string;
  departement: { id: string; nom: string };
  lignes: LignePreparation[];
  /** Saisie ouverte pour ce département (invité, date limite non passée ou coordinateur). */
  peutAjouter: boolean;
  estModifiable: (l: LignePreparation) => boolean;
  /** Comptable (« Préparer et soumettre ») sur la ligne d'un autre : correction / retrait. */
  peutCorriger: (l: LignePreparation) => boolean;
  nbDocuments: (ligneId: string) => number;
  onDocuments: (l: LignePreparation, modifiable: boolean) => void;
  onCorrection: (l: LignePreparation) => void;
  onRetirer: (l: LignePreparation) => void;
  onEtat: (depId: string, etat: EtatSection) => void;
  onEnregistre: () => void;
}) {
  const { moyens } = useMoyensPaiement();
  const initiaux = () => Object.fromEntries(lignes.filter(estModifiable).map((l) => [l.id, depuisLigne(l)]));
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>(initiaux);
  const [nouvelles, setNouvelles] = useState<Brouillon[]>([]);
  const [envoi, setEnvoi] = useState(false);

  // Repart des lignes enregistrées à chaque rechargement (après « Enregistrer » ou une action).
  const signature = lignes.map((l) => `${l.id}:${l.montant}:${l.statutValidation}:${l.designation}:${l.categorie}:${l.modePaiement}:${l.dateLimite}:${l.detail}`).join('|');
  useEffect(() => {
    setBrouillons(initiaux());
    setNouvelles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const lignesParId = useMemo(() => new Map(lignes.map((l) => [l.id, l])), [lignes]);
  const aEnvoyer = useMemo(() => {
    const ops: { action: string; ligneId?: string; ligne?: Record<string, unknown>; nom: string; b?: Brouillon }[] = [];
    for (const b of Object.values(brouillons)) {
      const l = lignesParId.get(b.id!);
      if (!l) continue;
      if (b.supprimee) ops.push({ action: 'supprimerLigne', ligneId: l.id, nom: l.designation });
      else if (change(b, l) || b.renvoyer) ops.push({ action: 'modifierLigne', ligneId: l.id, nom: b.designation || l.designation, b });
    }
    for (const b of nouvelles) if (!vide(b)) ops.push({ action: 'ajouterLigne', nom: b.designation || 'nouvelle ligne', b });
    return ops;
  }, [brouillons, nouvelles, lignesParId]);
  const modifie = aEnvoyer.length > 0;

  // Montants affichés : saisis pour ses lignes, enregistrés pour les autres ; sans les lignes retirées / supprimées.
  const montants = useMemo(() => {
    const m: { montant: number; modePaiement: string | null }[] = [];
    for (const l of lignes) {
      if (l.statutValidation === 'RETIREE') continue;
      const b = brouillons[l.id];
      if (b?.supprimee) continue;
      m.push(b ? { montant: Number(b.montant) || 0, modePaiement: b.modePaiement } : { montant: Number(l.montant), modePaiement: l.modePaiement });
    }
    for (const b of nouvelles) m.push({ montant: Number(b.montant) || 0, modePaiement: b.modePaiement });
    return m;
  }, [lignes, brouillons, nouvelles]);
  const total = montants.reduce((s, x) => s + x.montant, 0);
  const nbActives = montants.length;

  useEffect(() => {
    onEtat(departement.id, { montants, modifie });
  }, [departement.id, montants, modifie, onEtat]);

  const majExistante = (id: string, champ: keyof Brouillon, valeur: string | boolean) =>
    setBrouillons((p) => ({ ...p, [id]: { ...p[id], [champ]: valeur } }));
  const majNouvelle = (cle: string, champ: keyof Brouillon, valeur: string | boolean) =>
    setNouvelles((p) => p.map((b) => (b.cle === cle ? { ...b, [champ]: valeur } : b)));

  const annuler = () => {
    setBrouillons(initiaux());
    setNouvelles([]);
  };

  const enregistrer = async () => {
    const operations = [];
    for (const op of aEnvoyer) {
      if (op.action === 'supprimerLigne') {
        operations.push({ action: op.action, ligneId: op.ligneId });
        continue;
      }
      const b = op.b!;
      if (!b.designation.trim()) return void toast.error('Une ligne n’a pas de désignation.');
      if (!b.categorie) return void toast.error(`« ${b.designation.trim()} » : choisissez une catégorie.`);
      if (!(Number(b.montant) > 0)) return void toast.error(`« ${b.designation.trim()} » : indiquez un montant supérieur à 0.`);
      const ligne = {
        departementId: departement.id,
        designation: b.designation.trim(),
        categorie: b.categorie,
        modePaiement: b.modePaiement || MODE_DEFAUT,
        montant: Number(b.montant),
        detail: b.detail.trim() || undefined,
        dateLimite: b.dateLimite || undefined,
      };
      operations.push(op.action === 'modifierLigne' ? { action: op.action, ligneId: op.ligneId, ligne } : { action: op.action, ligne });
    }
    setEnvoi(true);
    try {
      const res = await fetch(`/api/demandes-budget/${budgetId}/preparation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enregistrerLignes', operations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Enregistrement impossible.');
      toast.success(data.message ?? 'Lignes enregistrées.');
      onEnregistre();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  const nomMoyen = (code: string | null) => moyens.find((m) => m.code === code)?.nom ?? code ?? '—';

  /** Champs d'une ligne modifiable (existante ou nouvelle). */
  const champs = (b: Brouillon, maj: (champ: keyof Brouillon, v: string | boolean) => void, actions: ReactNode) => (
    <div className={cn('grid grid-cols-1 @xl:grid-cols-2 gap-3 items-start', GRILLE)}>
      <div className="min-w-0 space-y-1 @xl:col-span-2 @4xl:col-span-1">
        <span className={LIBELLE}>Désignation *</span>
        <ChampAutoHauteur
          value={b.designation}
          onChange={(e) => maj('designation', e.target.value.replace(/\s*\n\s*/g, ' '))}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder="Ex: Carburant des véhicules"
          aria-label="Désignation"
        />
      </div>
      <div className="min-w-0 space-y-1">
        <span className={LIBELLE}>Catégorie *</span>
        <Select value={b.categorie} onValueChange={(v) => maj('categorie', v)}>
          <SelectTrigger className={SELECT_LIGNE} aria-label="Catégorie"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            {CATEGORIE_DEPENSE_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1">
        <span className={LIBELLE}>Moyen de paiement</span>
        <Select value={b.modePaiement || MODE_DEFAUT} onValueChange={(v) => maj('modePaiement', v)}>
          <SelectTrigger className={SELECT_LIGNE} aria-label="Moyen de paiement"><SelectValue /></SelectTrigger>
          <SelectContent>
            {moyensProposes(moyens, b.modePaiement).map((m) => <SelectItem key={m.code} value={m.code}>{m.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1">
        <span className={LIBELLE}>Montant (XOF) *</span>
        <Input type="number" min={0} value={b.montant} onChange={(e) => maj('montant', e.target.value)} aria-label="Montant (XOF)" />
      </div>
      <div className="min-w-0 space-y-1">
        <span className={LIBELLE}>Délai (facultatif)</span>
        <Input type="date" value={b.dateLimite} onChange={(e) => maj('dateLimite', e.target.value)} aria-label="Délai de la ligne" />
      </div>
      <div className="flex items-center justify-end gap-1 @xl:col-span-2 @4xl:col-span-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', b.detail.trim() ? 'text-indigo-700' : 'text-muted-foreground')}
          title={b.detailOuvert ? 'Masquer le détail' : 'Détail : quantités, prix unitaires, fournisseur pressenti (facultatif)'}
          aria-expanded={!!b.detailOuvert}
          onClick={() => maj('detailOuvert', !b.detailOuvert)}
        >
          <NotebookPen className="h-4 w-4" />
        </Button>
        {actions}
      </div>
    </div>
  );

  const boutonDocuments = (l: LignePreparation | null, modifiable: boolean) => {
    if (!l) {
      return (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50" disabled title="Enregistrez d'abord la ligne pour y joindre un document">
          <Paperclip className="h-4 w-4" />
        </Button>
      );
    }
    const n = nbDocuments(l.id);
    if (!modifiable && n === 0) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-8 gap-0.5 px-1.5', n > 0 ? 'text-indigo-700' : 'text-muted-foreground')}
        title={n > 0 ? `${n} document(s) qui justifient cette ligne` : 'Joindre un devis ou un justificatif de prix (facultatif)'}
        onClick={() => onDocuments(l, modifiable)}
      >
        <Paperclip className="h-4 w-4" />
        {n > 0 && <span className="text-xs">{n}</span>}
      </Button>
    );
  };

  return (
    <div className="@container rounded-md border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <p className="text-sm font-semibold">{departement.nom}</p>
        <p className="text-sm">
          <span className="text-muted-foreground">{nbActives} ligne(s) · </span>
          <strong className="tabular-nums">{fcfa(total)}</strong>
        </p>
      </div>

      {lignes.length + nouvelles.length > 0 && (
        <div className={cn('hidden @4xl:grid gap-3 border-b px-3 py-1.5 text-xs font-medium text-muted-foreground', GRILLE)}>
          <span>Désignation</span>
          <span>Catégorie</span>
          <span>Moyen de paiement</span>
          <span>Montant (XOF)</span>
          <span>Délai</span>
          <span className="w-[7.5rem]" aria-hidden="true" />
        </div>
      )}

      <div className="divide-y">
        {lignes.length + nouvelles.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground italic">Aucune ligne saisie pour le moment.</p>
        )}

        {lignes.map((l) => {
          const b = brouillons[l.id];
          const retiree = l.statutValidation === 'RETIREE';
          const aCorriger = l.statutValidation === 'A_CORRIGER';
          const saisie = l.ajouteeParNom || l.ajouteeParEmail;

          if (b && b.supprimee) {
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 bg-red-50/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-red-800 line-through">{l.designation} — {fcfa(Number(l.montant))}</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => majExistante(l.id, 'supprimee', false)}>
                  <Undo2 className="h-3.5 w-3.5" /> Garder la ligne
                </Button>
              </div>
            );
          }

          if (b) {
            return (
              <div key={l.id} className={cn('space-y-2 p-3', aCorriger && 'bg-amber-50/50', change(b, l) && 'bg-blue-50/40')}>
                {champs(
                  b,
                  (champ, v) => majExistante(l.id, champ, v),
                  <>
                    {boutonDocuments(l, true)}
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Supprimer la ligne (à l'enregistrement)" onClick={() => majExistante(l.id, 'supprimee', true)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {b.detailOuvert && (
                  <Textarea rows={3} maxLength={2000} value={b.detail} onChange={(e) => majExistante(l.id, 'detail', e.target.value)} placeholder="Quantités, prix unitaires, fournisseur pressenti, justification…" aria-label="Détail de la ligne" />
                )}
                {aCorriger && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-normal whitespace-normal">À corriger : {l.motifDecision}</Badge>
                    {!change(b, l) && (
                      <Button type="button" variant="ghost" size="sm" className={cn('h-7 text-xs', b.renvoyer ? 'text-green-700' : 'text-amber-800')} onClick={() => majExistante(l.id, 'renvoyer', !b.renvoyer)}>
                        {b.renvoyer ? '✓ Sera renvoyée telle quelle' : 'Corrigée telle quelle'}
                      </Button>
                    )}
                  </div>
                )}
                {saisie && <p className="text-[11px] text-muted-foreground">Saisie par {saisie}</p>}
              </div>
            );
          }

          // Lecture seule : ligne d'un autre (ou saisie fermée), ou ligne retirée.
          return (
            <div key={l.id} className={cn('space-y-1 px-3 py-2 text-sm', retiree && 'opacity-60')}>
              <div className={cn('grid grid-cols-1 @xl:grid-cols-2 gap-x-3 gap-y-1 items-center', GRILLE)}>
                <p className={cn('min-w-0 font-medium break-words @xl:col-span-2 @4xl:col-span-1', retiree && 'line-through')}>{l.designation}</p>
                <p className="min-w-0 text-xs text-muted-foreground @4xl:text-sm @4xl:text-foreground">{categorieLabel(l.categorie)}</p>
                <p className="min-w-0 text-xs text-muted-foreground @4xl:text-sm @4xl:text-foreground">{nomMoyen(l.modePaiement)}</p>
                <p className={cn('font-semibold tabular-nums', retiree && 'line-through')}>{fcfa(Number(l.montant))}</p>
                <p className="text-xs text-muted-foreground @4xl:text-sm">{jourFr(l.dateLimite) ?? '—'}</p>
                <div className="flex items-center justify-end gap-1 @xl:col-span-2 @4xl:col-span-1">
                  {boutonDocuments(l, false)}
                  {peutCorriger(l) && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-700" onClick={() => onCorrection(l)}>Correction</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-700" onClick={() => onRetirer(l)}>Retirer</Button>
                    </>
                  )}
                </div>
              </div>
              {l.detail && <p className="text-[11px] text-muted-foreground whitespace-pre-line">{l.detail}</p>}
              {aCorriger && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-normal whitespace-normal">À corriger : {l.motifDecision}</Badge>}
              {retiree && l.motifDecision && <p className="text-[11px] text-red-700">Retirée : {l.motifDecision}</p>}
              {saisie && <p className="text-[11px] text-muted-foreground">Saisie par {saisie}</p>}
            </div>
          );
        })}

        {nouvelles.map((b) => (
          <div key={b.cle} className="space-y-2 bg-green-50/40 p-3">
            {champs(
              b,
              (champ, v) => majNouvelle(b.cle, champ, v),
              <>
                {boutonDocuments(null, true)}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Retirer cette nouvelle ligne" onClick={() => setNouvelles((p) => p.filter((x) => x.cle !== b.cle))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {b.detailOuvert && (
              <Textarea rows={3} maxLength={2000} value={b.detail} onChange={(e) => majNouvelle(b.cle, 'detail', e.target.value)} placeholder="Quantités, prix unitaires, fournisseur pressenti, justification…" aria-label="Détail de la ligne" />
            )}
          </div>
        ))}
      </div>

      {(peutAjouter || modifie) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
          {peutAjouter ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setNouvelles((p) => [...p, nouvelle()])}>
              <Plus className="h-4 w-4" /> Ajouter une ligne
            </Button>
          ) : (
            <span />
          )}
          {modifie && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-amber-700">Modifications non enregistrées</span>
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={annuler} disabled={envoi}>
                <RotateCcw className="h-4 w-4" /> Annuler
              </Button>
              <Button type="button" size="sm" className="gap-1" onClick={() => void enregistrer()} loading={envoi} disabled={envoi}>
                <Save className="h-4 w-4" /> Enregistrer ({aEnvoyer.length})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
