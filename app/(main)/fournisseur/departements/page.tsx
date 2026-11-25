'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Pencil, PlusCircle, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DepartementDialog, type DepartementFormData } from '@/components/departements/DepartementDialog';
import { useDroits } from '@/components/DroitsProvider';
import { useActionEnCours } from '@/lib/useActionEnCours';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DepartementListe extends DepartementFormData {
  id: string;
  actif: boolean;
  nbPrestataires: number;
  nbLignesBudget: number;
  responsable: { id: string; nom: string } | null;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

/** Prestataires → Départements : liste, création, modification, activation. */
export default function DepartementsPage() {
  const { peut } = useDroits();
  const { enCours, lancer } = useActionEnCours();
  const [departements, setDepartements] = useState<DepartementListe[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [afficherInactifs, setAfficherInactifs] = useState(false);
  const [edition, setEdition] = useState<{ open: boolean; departement: DepartementFormData | null }>({ open: false, departement: null });

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/departements');
      if (!res.ok) throw new Error();
      setDepartements(await res.json());
    } catch {
      toast.error('Impossible de charger les départements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return departements.filter(
      (d) =>
        (afficherInactifs || d.actif) &&
        (!q || [d.nom, d.code, d.description, d.responsable?.nom].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [departements, recherche, afficherInactifs]);
  const nbInactifs = departements.filter((d) => !d.actif).length;

  const basculerActif = (d: DepartementListe) =>
    lancer(d.id, async () => {
      const res = await fetch(`/api/departements/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !d.actif }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(typeof data.error === 'string' ? data.error : 'Erreur.');
      toast.success(d.actif ? `${d.nom} désactivé : il n'est plus proposé sur les nouvelles lignes.` : `${d.nom} réactivé.`);
      await charger();
    });

  return (
    <div className="max-w-6xl mx-auto">
      <DepartementDialog
        open={edition.open}
        departement={edition.departement}
        onClose={() => setEdition({ open: false, departement: null })}
        onSuccess={charger}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-indigo-700" /> Départements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque ligne de budget est rattachée à un département ; les prestataires internes et externes peuvent l&apos;être aussi.
          </p>
        </div>
        {peut('fournisseurs.departementCreer') && (
          <Button onClick={() => setEdition({ open: true, departement: null })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nouveau département
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (nom, code, responsable…)" className="pl-9" />
        </div>
        {nbInactifs > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={afficherInactifs} onCheckedChange={setAfficherInactifs} />
            Afficher les désactivés ({nbInactifs})
          </label>
        )}
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Département</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead className="text-center">Prestataires</TableHead>
              <TableHead className="text-center">Lignes de budget</TableHead>
              <TableHead className="text-right">Mensuel indicatif</TableHead>
              <TableHead className="text-center">Actif</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chargement…</TableCell>
              </TableRow>
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun département.</TableCell>
              </TableRow>
            ) : (
              visibles.map((d) => (
                <TableRow key={d.id} className={cn(!d.actif && 'opacity-60')}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/fournisseur/departements/${d.id}`} className="font-medium hover:underline flex items-center gap-2">
                      {d.couleur && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.couleur }} aria-hidden="true" />}
                      {d.nom}
                      {d.code && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{d.code}</Badge>}
                    </Link>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-md">{d.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.responsable ? (
                      <Link href={`/fournisseur/${d.responsable.id}`} className="flex items-center gap-1.5 hover:underline">
                        <UserRound className="h-3.5 w-3.5 text-indigo-700" /> {d.responsable.nom}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{d.nbPrestataires}</TableCell>
                  <TableCell className="text-center">{d.nbLignesBudget}</TableCell>
                  <TableCell className="text-right text-sm">
                    {d.enveloppeMensuelle !== null ? formatMontant(d.enveloppeMensuelle) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={d.actif}
                      disabled={!peut('fournisseurs.departementActiver') || enCours(d.id)}
                      onCheckedChange={() => basculerActif(d)}
                      aria-label={d.actif ? `Désactiver ${d.nom}` : `Réactiver ${d.nom}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {peut('fournisseurs.departementModifier') && (
                        <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEdition({ open: true, departement: d })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/fournisseur/departements/${d.id}`}>Fiche</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
