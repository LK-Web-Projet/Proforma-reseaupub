'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, Megaphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceCombobox, type InvoiceOption } from '@/components/InvoiceCombobox';
import type { LigneBudgetCommandeOption } from '@/components/fournisseurs/LigneBudgetCommandeField';
import { typeBudgetLabel } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

export interface RattachementCommande {
  /** null = pas encore choisi. */
  campagne: boolean | null;
  proformaId: string;
  ligneBudgetId: string;
}

interface Reponse {
  aBudget: boolean;
  budgets: { id: string; numero: string; statut: string; ouvert: boolean }[];
  lignes: LigneBudgetCommandeOption[];
}

const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F`;

/** Rattachement de départ d'un bon existant : campagne s'il a une proforma, hors campagne s'il a une ligne. */
export function rattachementInitial(c?: { proformaId?: string | null; ligneBudgetId?: string | null } | null): RattachementCommande {
  const proformaId = c?.proformaId ?? '';
  const ligneBudgetId = c?.ligneBudgetId ?? '';
  return { campagne: proformaId ? true : ligneBudgetId ? false : null, proformaId, ligneBudgetId };
}

/**
 * Rattachement obligatoire d'un bon de commande (même règle que le serveur,
 * refusRattachementCommande) :
 * - « Campagne » → la proforma, puis la ligne de SON budget s'il existe (obligatoire ; budget pas
 *   encore validé : le bon ne peut pas être émis). Proforma sans budget : validation directe par la
 *   direction depuis la fiche du bon.
 * - « Hors campagne » → un budget validé qui n'est pas de campagne (mensuel, ponctuel…), puis sa ligne.
 * Avec une ligne accordée, le bon est validé dès son enregistrement. `onEtat` reçoit ce qui manque
 * (message) ou null quand le rattachement est complet.
 */
export function RattachementCommandeField({
  valeur,
  onChange,
  invoices,
  montantNet,
  commandeId,
  onEtat,
}: {
  valeur: RattachementCommande;
  onChange: (v: RattachementCommande) => void;
  invoices: InvoiceOption[];
  montantNet: number;
  /** Bon en cours de modification : son propre montant n'est pas compté comme déjà engagé. */
  commandeId?: string;
  onEtat: (message: string | null) => void;
}) {
  const { campagne, proformaId, ligneBudgetId } = valeur;
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [budgetChoisi, setBudgetChoisi] = useState('');
  // Ligne d'un bon existant, conservée tant que son rattachement ne change pas (elle peut ne plus être proposée).
  const initial = useRef({ proformaId, ligneBudgetId });

  // Lignes proposées : celles du budget de la proforma (campagne) ou des budgets hors campagne.
  const doitCharger = campagne === false || (campagne === true && !!proformaId);
  useEffect(() => {
    if (!doitCharger) {
      setDonnees(null);
      return;
    }
    let annule = false;
    setDonnees(null);
    setErreurChargement(false);
    const qs = new URLSearchParams();
    if (campagne && proformaId) qs.set('proformaId', proformaId);
    if (commandeId) qs.set('commandeId', commandeId);
    fetch(`/api/fournisseurs/commandes/lignes-budget?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: Reponse) => !annule && setDonnees(d))
      .catch(() => !annule && setErreurChargement(true));
    return () => {
      annule = true;
    };
  }, [doitCharger, campagne, proformaId, commandeId]);

  const budgetsHorsCampagne = useMemo(() => {
    const map = new Map<string, { id: string; numero: string; type: string; periode: string | null; nbLignes: number }>();
    for (const l of donnees?.lignes ?? []) {
      const b = map.get(l.budgetId) ?? { id: l.budgetId, numero: l.budgetNumero, type: l.budgetType, periode: l.budgetPeriode, nbLignes: 0 };
      b.nbLignes += 1;
      map.set(l.budgetId, b);
    }
    return [...map.values()];
  }, [donnees]);

  // Hors campagne : le budget se déduit de la ligne déjà choisie.
  useEffect(() => {
    if (campagne !== false || !donnees || !ligneBudgetId) return;
    const l = donnees.lignes.find((x) => x.id === ligneBudgetId);
    if (l) setBudgetChoisi(l.budgetId);
  }, [campagne, donnees, ligneBudgetId]);

  // Ligne qui n'est plus proposée (rattachement changé) : on la retire.
  useEffect(() => {
    if (!donnees || !ligneBudgetId) return;
    const estInitiale = proformaId === initial.current.proformaId && ligneBudgetId === initial.current.ligneBudgetId;
    if (!estInitiale && !donnees.lignes.some((l) => l.id === ligneBudgetId)) onChange({ ...valeur, ligneBudgetId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees]);

  const lignesAffichees = campagne === false ? (donnees?.lignes ?? []).filter((l) => l.budgetId === budgetChoisi) : donnees?.lignes ?? [];
  const choisie = donnees?.lignes.find((l) => l.id === ligneBudgetId);
  const ligneHorsListe = !!ligneBudgetId && !!donnees && !choisie;
  const numeros = (donnees?.budgets ?? []).map((b) => b.numero).join(', ');
  const budgetFerme = campagne === true && !!donnees?.aBudget && !donnees.budgets.some((b) => b.ouvert);
  const directe = campagne === true && !!proformaId && !!donnees && !donnees.aBudget;
  const tropJuste = !!choisie && montantNet > choisie.reste + 0.5;

  // Ce qui manque encore (même règle que le serveur) ; null = rattachement complet.
  const message = useMemo(() => {
    if (campagne === null) return 'Indiquez si le bon de commande est pour une campagne ou non.';
    if (campagne && !proformaId) return 'Choisissez la proforma de la campagne.';
    if (!donnees) return erreurChargement ? 'Impossible de charger les budgets : réessayez.' : 'Chargement des budgets…';
    if (budgetFerme) return `Le budget ${numeros} de cette proforma n'est pas encore validé : attendez sa validation pour émettre le bon.`;
    if (directe) return null;
    if (!ligneBudgetId) return campagne ? `Choisissez la ligne du budget ${numeros} qui finance le bon.` : 'Choisissez le budget, puis la ligne qui finance le bon.';
    if (tropJuste) return 'Le bon dépasse ce qui reste à engager sur cette ligne : réduisez le bon ou demandez un dépassement.';
    return null;
  }, [campagne, proformaId, donnees, erreurChargement, budgetFerme, directe, ligneBudgetId, tropJuste, numeros]);

  useEffect(() => {
    onEtat(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const changerCampagne = (v: boolean) => {
    if (v === campagne) return;
    setBudgetChoisi('');
    onChange({ campagne: v, proformaId: '', ligneBudgetId: '' });
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label>Ce bon de commande est-il pour une campagne ? *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
          {[
            { v: true, titre: 'Campagne', sous: 'Lié à la proforma du client', icon: Megaphone },
            { v: false, titre: 'Hors campagne', sous: 'Budget mensuel, ponctuel…', icon: Building2 },
          ].map((o) => (
            <button
              key={o.titre}
              type="button"
              role="radio"
              aria-checked={campagne === o.v}
              onClick={() => changerCampagne(o.v)}
              className={cn(
                'flex items-center gap-3 rounded-md border p-3 text-left transition-colors',
                campagne === o.v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'
              )}
            >
              <o.icon className={cn('h-5 w-5 shrink-0', campagne === o.v ? 'text-primary' : 'text-muted-foreground')} />
              <span>
                <span className="block text-sm font-semibold">{o.titre}</span>
                <span className="block text-[11px] text-muted-foreground">{o.sous}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {campagne === true && (
        <div className="space-y-1.5">
          <Label>Proforma de la campagne *</Label>
          <InvoiceCombobox
            invoices={invoices}
            value={proformaId}
            placeholder="Choisir la proforma de la campagne"
            onChange={(id) => onChange({ ...valeur, proformaId: id, ligneBudgetId: '' })}
          />
          <p className="text-[11px] text-muted-foreground">Une seule proforma par bon de commande : validée, payée ou soldée.</p>
        </div>
      )}

      {erreurChargement && <p className="text-xs text-destructive">Impossible de charger les budgets.</p>}
      {doitCharger && !donnees && !erreurChargement && <p className="text-xs text-muted-foreground">Chargement des budgets…</p>}

      {budgetFerme && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Cette proforma a un budget ({numeros}) qui n&apos;est pas encore validé : le bon de commande ne peut pas être émis tant que la
          Direction ne l&apos;a pas validé.
        </div>
      )}

      {directe && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
          Cette proforma n&apos;a pas de budget : le bon reste en brouillon et la <strong>direction le valide directement</strong> depuis sa fiche.
          Le scan du bon signé restera à joindre avant tout paiement.
        </div>
      )}

      {campagne === false && donnees && (
        budgetsHorsCampagne.length === 0 && !ligneHorsListe ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Aucun budget hors campagne validé n&apos;a de ligne accordée : faites d&apos;abord valider un budget mensuel ou ponctuel.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label>Budget *</Label>
            <Select
              value={budgetChoisi}
              onValueChange={(id) => {
                setBudgetChoisi(id);
                onChange({ ...valeur, ligneBudgetId: '' });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choisir le budget" /></SelectTrigger>
              <SelectContent>
                {budgetsHorsCampagne.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.numero} · {typeBudgetLabel(b.type)}
                    {b.periode ? ` · ${format(new Date(b.periode), 'MMMM yyyy', { locale: fr })}` : ''} · {b.nbLignes} ligne(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      )}

      {donnees && !budgetFerme && !directe && (campagne === true || budgetChoisi || ligneHorsListe) && (
        <div className="space-y-1.5">
          <Label>Ligne de budget *{campagne && numeros ? ` (budget ${numeros})` : ''}</Label>
          <Select value={ligneBudgetId} onValueChange={(id) => onChange({ ...valeur, ligneBudgetId: id })}>
            <SelectTrigger><SelectValue placeholder="Choisir la ligne" /></SelectTrigger>
            <SelectContent>
              {ligneHorsListe && <SelectItem value={ligneBudgetId}>Ligne actuelle (n&apos;est plus proposée)</SelectItem>}
              {lignesAffichees.map((l) => (
                <SelectItem key={l.id} value={l.id} disabled={montantNet > l.reste + 0.5}>
                  {campagne ? `${l.budgetNumero} — ` : ''}{l.designation} · reste à engager {fcfa(l.reste)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {campagne && lignesAffichees.length === 0 && !ligneHorsListe && (
            <p className="text-xs text-destructive">Aucune ligne accordée n&apos;est ouverte sur ce budget.</p>
          )}
          {choisie &&
            (tropJuste ? (
              <p className="text-xs text-destructive">
                Le bon ({fcfa(montantNet)}) dépasse ce qui reste à engager sur cette ligne ({fcfa(choisie.reste)}) : réduisez le bon ou demandez un
                dépassement.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Plafond {fcfa(choisie.plafond)} · dépensé {fcfa(choisie.consomme)} · autres bons en cours {fcfa(choisie.engage)}. Le bon sera{' '}
                <strong>validé dès son enregistrement</strong> ; joignez ensuite le scan du bon signé (aucun paiement sans lui).
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
