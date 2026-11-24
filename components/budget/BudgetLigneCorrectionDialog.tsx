'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIE_DEPENSE_VALUES, CATEGORIE_DEPENSE_LABELS, MODE_PAIEMENT_OPTIONS } from '@/lib/budgetTypes';
import { toast } from 'sonner';
import type { DepartementOption } from '@/lib/departements';

export interface BudgetLigneCorrectionCible {
  id: string;
  designation: string;
  categorie: string | null;
  modePaiement?: string | null;
  montant: number;
  detail?: string | null;
  dateLimite?: string | null;
  departementId?: string | null;
  motifDecision: string | null;
  mode: 'MODIFIER' | 'RETIRER';
}

/**
 * Le demandeur traite une ligne renvoyée en correction : la modifier (elle repart en validation)
 * ou la retirer du budget (le budget peut alors être entièrement validé sans elle).
 */
export function BudgetLigneCorrectionDialog({
  demandeId,
  ligne,
  onClose,
  onSuccess,
}: {
  demandeId: string;
  ligne: BudgetLigneCorrectionCible | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [designation, setDesignation] = useState('');
  const [categorie, setCategorie] = useState('');
  const [modePaiement, setModePaiement] = useState('');
  const [montant, setMontant] = useState('');
  const [detail, setDetail] = useState('');
  const [departementId, setDepartementId] = useState('');
  const [departements, setDepartements] = useState<DepartementOption[]>([]);
  const [dateLimite, setDateLimite] = useState('');
  const [reponse, setReponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!ligne) return;
    setDesignation(ligne.designation);
    setCategorie(ligne.categorie ?? '');
    setModePaiement(ligne.modePaiement ?? '');
    setMontant(String(ligne.montant));
    setDetail(ligne.detail ?? '');
    setDepartementId(ligne.departementId ?? '');
    // Départements actifs ; celui de la ligne reste proposé même s'il a été désactivé.
    fetch('/api/departements')
      .then((res) => (res.ok ? res.json() : []))
      .then((liste: DepartementOption[]) => setDepartements(liste.filter((d) => d.actif || d.id === ligne.departementId)))
      .catch(() => setDepartements([]));
    setDateLimite(ligne.dateLimite ? ligne.dateLimite.slice(0, 10) : '');
    setReponse('');
  }, [ligne]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ligne) return;
    let body: Record<string, unknown>;
    if (ligne.mode === 'MODIFIER') {
      const m = Number(montant);
      if (!designation.trim()) return void toast.error('La désignation est requise.');
      if (!departementId) return void toast.error('Choisissez le département de la ligne.');
      if (!categorie) return void toast.error('Choisissez une catégorie.');
      if (!m || m <= 0) return void toast.error('Indiquez un montant valide.');
      body = {
        action: 'MODIFIER',
        designation: designation.trim(),
        categorie,
        departementId,
        montant: m,
        modePaiement: modePaiement || undefined,
        // Toujours envoyés : une chaîne vide efface le détail ou le délai.
        detail: detail.trim(),
        dateLimite,
        reponse: reponse.trim() || undefined,
      };
    } else {
      body = { action: 'RETIRER', reponse: reponse.trim() || undefined };
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/lignes/${ligne.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la correction.');
      }
      toast.success(ligne.mode === 'MODIFIER' ? 'Ligne corrigée : elle repart en validation.' : 'Ligne retirée du budget.');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!ligne} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ligne?.mode === 'MODIFIER' ? 'Corriger la ligne' : 'Retirer la ligne du budget ?'}</DialogTitle>
        </DialogHeader>
        {ligne && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {ligne.motifDecision && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Correction demandée :</strong> {ligne.motifDecision}
              </div>
            )}
            {ligne.mode === 'MODIFIER' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="corr-designation">Désignation *</Label>
                  <Input id="corr-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Département *</Label>
                  <Select value={departementId} onValueChange={setDepartementId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Département de la ligne" /></SelectTrigger>
                    <SelectContent>
                      {departements.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nom}
                          {!d.actif ? ' (désactivé)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Catégorie *</Label>
                    <Select value={categorie} onValueChange={setCategorie}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIE_DEPENSE_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corr-montant">Montant (XOF) *</Label>
                    <Input id="corr-montant" type="number" min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Moyen de paiement prévu</Label>
                    <Select value={modePaiement} onValueChange={setModePaiement}>
                      <SelectTrigger><SelectValue placeholder="Moyen de paiement" /></SelectTrigger>
                      <SelectContent>
                        {MODE_PAIEMENT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="corr-delai">Délai (facultatif)</Label>
                    <Input id="corr-delai" type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corr-detail">Détail de la ligne (facultatif)</Label>
                  <Textarea
                    id="corr-detail"
                    rows={3}
                    maxLength={2000}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Quantités, prix unitaires, fournisseur pressenti, justification…"
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                « {ligne.designation} » sortira du budget (elle restera visible, barrée). Si toutes les autres lignes sont accordées, le budget sera validé.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="corr-reponse">Réponse au valideur (facultatif)</Label>
              <Textarea id="corr-reponse" rows={2} value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="Ex. : devis joint, quantité revue…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" loading={isSubmitting} disabled={isSubmitting} variant={ligne.mode === 'RETIRER' ? 'destructive' : 'default'}>
                {isSubmitting ? 'Envoi...' : ligne.mode === 'MODIFIER' ? 'Renvoyer en validation' : 'Retirer la ligne'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
