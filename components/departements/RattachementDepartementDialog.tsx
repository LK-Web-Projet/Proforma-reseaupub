'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POSTES_DEPARTEMENT, peutAvoirDepartement, type DepartementOption } from '@/lib/departements';
import { toast } from 'sonner';

const AUCUN = '__aucun__';

export interface PrestataireARattacher {
  id: string;
  nom: string;
  departementId: string | null;
  posteDepartement: string | null;
}

interface PrestataireListe {
  id: string;
  entreprise: string;
  typeFournisseur: string | null;
  actif: boolean;
  departementId?: string | null;
  posteDepartement?: string | null;
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Rattacher un prestataire (interne ou externe) à un département, changer son poste, ou le retirer
 * de son département. Chaque changement est ajouté à l'historique (date d'effet, motif, auteur).
 * - depuis la fiche d'un prestataire : `prestataire` est fourni ;
 * - depuis la fiche d'un département : `departementFixe` est fourni et on choisit le prestataire.
 */
export function RattachementDepartementDialog({
  open,
  prestataire,
  departementFixe,
  onClose,
  onSuccess,
}: {
  open: boolean;
  prestataire?: PrestataireARattacher | null;
  departementFixe?: { id: string; nom: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [departements, setDepartements] = useState<DepartementOption[]>([]);
  const [prestataires, setPrestataires] = useState<PrestataireListe[]>([]);
  const [prestataireId, setPrestataireId] = useState('');
  const [departementId, setDepartementId] = useState('');
  const [poste, setPoste] = useState('');
  const [dateEffet, setDateEffet] = useState(aujourdhui());
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrestataireId(prestataire?.id ?? '');
    setDepartementId(departementFixe?.id ?? prestataire?.departementId ?? '');
    setPoste(prestataire?.posteDepartement ?? '');
    setDateEffet(aujourdhui());
    setMotif('');
    fetch('/api/departements')
      .then((res) => (res.ok ? res.json() : []))
      .then((liste: DepartementOption[]) => setDepartements(liste.filter((d) => d.actif || d.id === prestataire?.departementId)))
      .catch(() => setDepartements([]));
    if (!prestataire) {
      // Depuis un département : prestataires actifs, internes ou externes (jamais un « Fournisseur »).
      fetch('/api/fournisseurs')
        .then((res) => (res.ok ? res.json() : []))
        .then((liste: PrestataireListe[]) => setPrestataires(liste.filter((p) => p.actif && peutAvoirDepartement(p.typeFournisseur))))
        .catch(() => setPrestataires([]));
    }
  }, [open, prestataire, departementFixe]);

  // Prestataire choisi depuis un département : on reprend son poste actuel s'il y est déjà.
  const choisirPrestataire = (id: string) => {
    setPrestataireId(id);
    const p = prestataires.find((x) => x.id === id);
    setPoste(p && p.departementId === departementFixe?.id ? p.posteDepartement ?? '' : '');
  };

  const retirer = departementId === AUCUN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestataireId) return void toast.error('Choisissez le prestataire.');
    if (!departementId) return void toast.error('Choisissez le département.');
    if (!retirer && !poste) return void toast.error('Choisissez le poste du prestataire.');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/fournisseurs/${prestataireId}/departement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departementId: retirer ? null : departementId,
          poste: retirer ? null : poste,
          dateEffet,
          motif: motif.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : "Erreur lors de l'enregistrement.");
      toast.success(data.message ?? 'Rattachement enregistré.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const prestataireChoisi = prestataires.find((p) => p.id === prestataireId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {departementFixe ? `Rattacher un prestataire à ${departementFixe.nom}` : 'Département et poste'}
          </DialogTitle>
          <DialogDescription>
            {prestataire ? prestataire.nom : 'Prestataires internes et externes uniquement.'} Le changement est conservé dans l&apos;historique.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!prestataire && (
            <div className="space-y-1.5">
              <Label>Prestataire *</Label>
              <Select value={prestataireId} onValueChange={choisirPrestataire}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un prestataire" /></SelectTrigger>
                <SelectContent>
                  {prestataires.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.entreprise}
                      {p.departementId && p.departementId !== departementFixe?.id ? ' (déjà dans un autre département)' : ''}
                      {p.departementId === departementFixe?.id ? ' (déjà dans ce département)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prestataireChoisi?.departementId && prestataireChoisi.departementId !== departementFixe?.id && (
                <p className="text-xs text-amber-700">Il quittera son département actuel : le changement sera noté dans son historique.</p>
              )}
            </div>
          )}
          {!departementFixe && (
            <div className="space-y-1.5">
              <Label>Département *</Label>
              <Select value={departementId} onValueChange={setDepartementId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un département" /></SelectTrigger>
                <SelectContent>
                  {departements.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nom}
                      {!d.actif ? ' (désactivé)' : ''}
                    </SelectItem>
                  ))}
                  {prestataire?.departementId && <SelectItem value={AUCUN}>Aucun département (le retirer)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {!retirer && (
            <div className="space-y-1.5">
              <Label>Poste *</Label>
              <Select value={poste} onValueChange={setPoste}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choisir le poste" /></SelectTrigger>
                <SelectContent>
                  {POSTES_DEPARTEMENT.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Un seul responsable par département.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ratt-date">Date d&apos;effet *</Label>
              <Input id="ratt-date" type="date" value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ratt-motif">Motif (facultatif)</Label>
              <Textarea id="ratt-motif" rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : mutation, promotion, fin de stage…" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting} variant={retirer ? 'destructive' : 'default'}>
              {retirer ? 'Retirer du département' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
