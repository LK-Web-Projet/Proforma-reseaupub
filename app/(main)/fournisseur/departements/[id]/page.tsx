'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, ArrowRightLeft, Building2, Mail, Pencil, Phone, UserPlus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DepartementDialog, type DepartementFormData } from '@/components/departements/DepartementDialog';
import { RattachementDepartementDialog, type PrestataireARattacher } from '@/components/departements/RattachementDepartementDialog';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import { useDroits } from '@/components/DroitsProvider';
import { COULEURS_POSTE, isPosteDepartement, libellePoste, POSTE_RESPONSABLE, POSTES_DEPARTEMENT } from '@/lib/departements';
import { typeBudgetLabel } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FicheDepartement extends DepartementFormData {
  id: string;
  actif: boolean;
  createdAt: string;
  prestataires: {
    id: string;
    nomAffiche: string;
    typeFournisseur: string | null;
    actif: boolean;
    posteDepartement: string | null;
  }[];
  historique: {
    id: string;
    dateEffet: string;
    motif: string | null;
    auteurNom: string | null;
    prestataire: { id: string; nom: string };
    sens: 'ARRIVEE' | 'DEPART' | 'POSTE';
    ancienDepartement: string | null;
    nouveauDepartement: string | null;
    ancienPoste: string | null;
    nouveauPoste: string | null;
  }[];
  depensesParMois: { mois: string; depense: number; nbDepenses: number }[];
  lignesEnCours: {
    id: string;
    designation: string;
    budget: { id: string; numero: string; type: string };
    plafond: number;
    consomme: number;
    reste: number;
  }[];
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);
const libelleMois = (cle: string) => format(new Date(`${cle}-15T12:00:00`), 'MMMM yyyy', { locale: fr });

/** Fiche d'un département : informations, prestataires par poste, dépenses par mois, historique. */
export default function DepartementFichePage() {
  const { id } = useParams<{ id: string }>();
  const { peut } = useDroits();
  const [fiche, setFiche] = useState<FicheDepartement | null>(null);
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(false);
  const [rattachement, setRattachement] = useState<{ open: boolean; prestataire: PrestataireARattacher | null }>({ open: false, prestataire: null });

  const charger = useCallback(async () => {
    try {
      const res = await fetch(`/api/departements/${id}`);
      if (!res.ok) throw new Error();
      setFiche(await res.json());
    } catch {
      toast.error('Impossible de charger le département.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Prestataires actifs classés par poste (responsable d'abord), puis les inactifs.
  const prestatairesTries = useMemo(() => {
    const ordre = (p: string | null) => {
      const i = POSTES_DEPARTEMENT.findIndex((x) => x.value === p);
      return i < 0 ? 99 : i;
    };
    return [...(fiche?.prestataires ?? [])].sort(
      (a, b) => Number(b.actif) - Number(a.actif) || ordre(a.posteDepartement) - ordre(b.posteDepartement) || a.nomAffiche.localeCompare(b.nomAffiche, 'fr')
    );
  }, [fiche]);

  if (loading) return <div className="max-w-6xl mx-auto text-muted-foreground">Chargement…</div>;
  if (!fiche) return <div className="max-w-6xl mx-auto">Département introuvable.</div>;

  const responsable = fiche.prestataires.find((p) => p.actif && p.posteDepartement === POSTE_RESPONSABLE);
  const moisCourant = fiche.depensesParMois[fiche.depensesParMois.length - 1];
  const maxDepense = Math.max(1, ...fiche.depensesParMois.map((m) => m.depense), fiche.enveloppeMensuelle ?? 0);
  const resteEnCours = fiche.lignesEnCours.reduce((s, l) => s + l.reste, 0);
  const peutRattacher = peut('fournisseurs.affecterDepartement');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <DepartementDialog open={edition} departement={fiche} onClose={() => setEdition(false)} onSuccess={charger} />
      <RattachementDepartementDialog
        open={rattachement.open}
        prestataire={rattachement.prestataire}
        departementFixe={rattachement.prestataire ? null : { id: fiche.id, nom: fiche.nom }}
        onClose={() => setRattachement({ open: false, prestataire: null })}
        onSuccess={charger}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full shrink-0">
            <Link href="/fournisseur/departements" aria-label="Retour aux départements"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
              {fiche.couleur && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: fiche.couleur }} aria-hidden="true" />}
              {fiche.nom}
              {fiche.code && <Badge variant="outline" className="font-normal">{fiche.code}</Badge>}
              {!fiche.actif && <Badge variant="outline" className="font-normal bg-gray-50 text-gray-600">Désactivé</Badge>}
            </h1>
            {fiche.description && <p className="text-sm text-muted-foreground mt-1 max-w-3xl whitespace-pre-wrap">{fiche.description}</p>}
          </div>
        </div>
        {peut('fournisseurs.departementModifier') && (
          <Button variant="outline" onClick={() => setEdition(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Responsable</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {responsable ? (
              <Link href={`/fournisseur/${responsable.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                <UserRound className="h-4 w-4 text-indigo-700" /> {responsable.nomAffiche}
              </Link>
            ) : (
              <p className="text-muted-foreground">Aucun responsable désigné.</p>
            )}
            {fiche.emailContact && <p className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {fiche.emailContact}</p>}
            {fiche.telephone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {fiche.telephone}</p>}
            {fiche.codeAnalytique && <p className="text-muted-foreground">Code comptable : {fiche.codeAnalytique}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Dépensé en {moisCourant ? libelleMois(moisCourant.mois) : 'ce mois'}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMontant(moisCourant?.depense ?? 0)}</p>
            {fiche.enveloppeMensuelle !== null ? (
              <div className="mt-2 space-y-1">
                <BudgetProgressBar consomme={moisCourant?.depense ?? 0} prevu={fiche.enveloppeMensuelle} />
                <p className="text-xs text-muted-foreground">Montant mensuel indicatif : {formatMontant(fiche.enveloppeMensuelle)}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{moisCourant?.nbDepenses ?? 0} dépense(s) ce mois-ci</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">Reste à dépenser (budgets en cours)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMontant(resteEnCours)}</p>
            <p className="text-xs text-muted-foreground mt-1">{fiche.lignesEnCours.length} ligne(s) accordée(s) sur des budgets ouverts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Dépenses des 6 derniers mois</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {fiche.depensesParMois.map((m) => (
              <div key={m.mois} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                <span className="capitalize text-muted-foreground">{libelleMois(m.mois)}</span>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden" title={`${m.nbDepenses} dépense(s)`}>
                  <div
                    className={cn('h-full rounded-full', fiche.enveloppeMensuelle !== null && m.depense > fiche.enveloppeMensuelle ? 'bg-red-500' : 'bg-indigo-600')}
                    style={{ width: `${(m.depense / maxDepense) * 100}%`, backgroundColor: fiche.couleur && !(fiche.enveloppeMensuelle !== null && m.depense > fiche.enveloppeMensuelle) ? fiche.couleur : undefined }}
                  />
                </div>
                <span className="font-medium text-right whitespace-nowrap">{formatMontant(m.depense)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Dépenses réellement enregistrées (non annulées) sur les lignes de budget de ce département, par mois de la dépense.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Prestataires ({fiche.prestataires.filter((p) => p.actif).length})</CardTitle>
          {peutRattacher && fiche.actif && (
            <Button size="sm" onClick={() => setRattachement({ open: true, prestataire: null })}>
              <UserPlus className="mr-2 h-4 w-4" /> Rattacher un prestataire
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {prestatairesTries.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Aucun prestataire rattaché.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Prestataire</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Type</TableHead>
                    {peutRattacher && <TableHead className="text-right pr-6">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prestatairesTries.map((p) => (
                    <TableRow key={p.id} className={cn(!p.actif && 'opacity-60')}>
                      <TableCell className="pl-6 whitespace-normal">
                        <Link href={`/fournisseur/${p.id}`} className="font-medium hover:underline">{p.nomAffiche}</Link>
                        {!p.actif && <span className="text-xs text-muted-foreground"> · inactif</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-normal', isPosteDepartement(p.posteDepartement) && COULEURS_POSTE[p.posteDepartement])}>
                          {libellePoste(p.posteDepartement)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.typeFournisseur || 'Prestataire interne'}</TableCell>
                      {peutRattacher && (
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRattachement({
                                open: true,
                                prestataire: { id: p.id, nom: p.nomAffiche, departementId: fiche.id, posteDepartement: p.posteDepartement },
                              })
                            }
                          >
                            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Changer
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lignes de budget en cours ({fiche.lignesEnCours.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {fiche.lignesEnCours.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Aucune ligne accordée sur un budget ouvert.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Ligne</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead className="text-right">Plafond</TableHead>
                    <TableHead className="text-right">Consommé</TableHead>
                    <TableHead className="text-right pr-6">Reste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fiche.lignesEnCours.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-6 whitespace-normal">{l.designation}</TableCell>
                      <TableCell>
                        <Link href={`/budget/demandes/${l.budget.id}`} className="hover:underline">{l.budget.numero}</Link>
                        <span className="text-xs text-muted-foreground"> · {typeBudgetLabel(l.budget.type)}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatMontant(l.plafond)}</TableCell>
                      <TableCell className="text-right">{formatMontant(l.consomme)}</TableCell>
                      <TableCell className="text-right pr-6 font-medium">{formatMontant(l.reste)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Historique des mouvements</CardTitle></CardHeader>
        <CardContent>
          {fiche.historique.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {fiche.historique.map((h) => (
                <li key={h.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 border-b last:border-0 pb-3 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/fournisseur/${h.prestataire.id}`} className="font-medium hover:underline">{h.prestataire.nom}</Link>{' '}
                    {h.sens === 'ARRIVEE' && (
                      <span>
                        arrive comme <strong>{libellePoste(h.nouveauPoste)}</strong>
                        {h.ancienDepartement ? ` (venant de ${h.ancienDepartement})` : ''}
                      </span>
                    )}
                    {h.sens === 'DEPART' && (
                      <span>
                        quitte le département{h.nouveauDepartement ? ` pour ${h.nouveauDepartement}` : ''}
                        {h.ancienPoste ? ` (était ${libellePoste(h.ancienPoste).toLowerCase()})` : ''}
                      </span>
                    )}
                    {h.sens === 'POSTE' && (
                      <span>
                        change de poste : {libellePoste(h.ancienPoste)} → <strong>{libellePoste(h.nouveauPoste)}</strong>
                      </span>
                    )}
                    {h.motif && <p className="text-muted-foreground italic mt-0.5">{h.motif}</p>}
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right shrink-0">
                    {format(new Date(h.dateEffet), 'dd/MM/yyyy')}
                    {h.auteurNom ? ` · par ${h.auteurNom}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
