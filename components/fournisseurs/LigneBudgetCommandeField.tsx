'use client';

import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface LigneBudgetCommandeOption {
  id: string;
  designation: string;
  budgetId: string;
  budgetNumero: string;
  budgetType: string;
  plafond: number;
  consomme: number;
  engage: number;
  reste: number;
}

interface Reponse {
  aBudget: boolean;
  budgets: { id: string; numero: string; statut: string; ouvert: boolean }[];
  lignes: LigneBudgetCommandeOption[];
}

const AUCUNE = '__aucune__';
const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F`;

/**
 * Ligne de budget qui finance un bon de commande, proposée selon SA proforma :
 * - proforma liée à un budget → lignes accordées de ce budget uniquement, choix OBLIGATOIRE
 *   (présélectionnée s'il n'y en a qu'une) ; le bon est alors validé dès sa création ;
 * - pas de proforma, ou proforma sans budget → lignes des budgets sans proforma (mensuel…), facultatif.
 * Chaque ligne affiche ce qui reste à engager ; une ligne trop juste pour le bon est désactivée.
 */
export function LigneBudgetCommandeField({
  proformaId,
  commandeId,
  montantNet,
  value,
  onChange,
}: {
  proformaId: string;
  /** Bon en cours de modification : son propre montant n'est pas compté comme déjà engagé. */
  commandeId?: string;
  montantNet: number;
  value: string;
  onChange: (ligneBudgetId: string) => void;
}) {
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState(false);
  // Ligne déjà rattachée à l'ouverture (modification) : conservée même si elle n'est plus proposée
  // (ligne pas encore accordée), tant que la proforma ne change pas.
  const initial = useRef({ proformaId, value });

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur(false);
    const qs = new URLSearchParams();
    if (proformaId) qs.set('proformaId', proformaId);
    if (commandeId) qs.set('commandeId', commandeId);
    fetch(`/api/fournisseurs/commandes/lignes-budget?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: Reponse) => !annule && setDonnees(d))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, [proformaId, commandeId]);

  // Ligne qui n'est plus proposée (proforma changée) : on la retire ; une seule ligne au budget de
  // la proforma : on la présélectionne.
  useEffect(() => {
    if (!donnees) return;
    const ids = donnees.lignes.map((l) => l.id);
    const ligneInitiale = proformaId === initial.current.proformaId && value === initial.current.value;
    if (value && !ids.includes(value) && !ligneInitiale) onChange('');
    else if (!value && donnees.aBudget && donnees.lignes.length === 1) onChange(donnees.lignes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees]);

  if (erreur) return <p className="text-xs text-destructive">Impossible de charger les lignes de budget.</p>;
  if (!donnees) return <p className="text-xs text-muted-foreground">Chargement des lignes de budget…</p>;

  const { aBudget, budgets, lignes } = donnees;
  const choisie = lignes.find((l) => l.id === value);
  const horsListe = !!value && !choisie;
  const numeros = budgets.map((b) => b.numero).join(', ');

  if (aBudget && lignes.length === 0 && !value) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
        Cette proforma a un budget ({numeros}) mais aucune ligne accordée n&apos;est ouverte : le bon de commande pourra être
        émis une fois le budget validé par la DG.
      </div>
    );
  }
  if (!aBudget && lignes.length === 0 && !value) return null;

  return (
    <div className="space-y-1.5">
      <Label>
        Ligne de budget {aBudget ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(facultatif)</span>}
      </Label>
      <Select value={value || (aBudget ? '' : AUCUNE)} onValueChange={(v) => onChange(v === AUCUNE ? '' : v)}>
        <SelectTrigger className={aBudget && !value ? 'border-destructive' : undefined}>
          <SelectValue placeholder={`Choisir la ligne du budget ${numeros}`} />
        </SelectTrigger>
        <SelectContent>
          {!aBudget && <SelectItem value={AUCUNE}>Aucune (circuit de validation par la DG)</SelectItem>}
          {horsListe && <SelectItem value={value}>Ligne actuelle (pas encore accordée)</SelectItem>}
          {lignes.map((l) => (
            <SelectItem key={l.id} value={l.id} disabled={montantNet > l.reste + 0.5}>
              {l.budgetNumero} — {l.designation} · reste à engager {fcfa(l.reste)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choisie ? (
        montantNet > choisie.reste + 0.5 ? (
          <p className="text-xs text-destructive">
            Le bon ({fcfa(montantNet)}) dépasse ce qui reste à engager sur cette ligne ({fcfa(choisie.reste)}) : réduisez le bon ou
            demandez un dépassement.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Plafond {fcfa(choisie.plafond)} · dépensé {fcfa(choisie.consomme)} · autres bons en cours {fcfa(choisie.engage)}. Le bon
            sera <strong>validé dès son enregistrement</strong> ; joignez ensuite le scan du bon signé (aucun paiement sans lui).
          </p>
        )
      ) : aBudget && !value ? (
        <p className="text-xs text-destructive">Obligatoire : cette proforma a un budget ({numeros}).</p>
      ) : null}
    </div>
  );
}
