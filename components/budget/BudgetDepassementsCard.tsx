'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { TrendingUp, CheckCircle2, XCircle } from 'lucide-react';

export interface BudgetDepassement {
  id: string;
  ligneId: string;
  montant: number;
  motif: string;
  statut: 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';
  demandeParEmail: string;
  demandeParNom: string | null;
  decideParEmail: string | null;
  decideAt: string | null;
  motifRejet: string | null;
  createdAt: string;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value);

const STATUT_META: Record<BudgetDepassement['statut'], { label: string; className: string }> = {
  EN_ATTENTE: { label: 'En attente', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  APPROUVE: { label: 'Approuvé', className: 'bg-green-50 text-green-700 border-green-200' },
  REJETE: { label: 'Refusé', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Dépassements d'un budget. L'administrateur (canValidateMensuel) approuve ou refuse ceux en
 * attente, sauf ceux qu'il a lui-même demandés (règle aussi appliquée côté serveur).
 */
export function BudgetDepassementsCard({
  demandeId,
  depassements,
  lignesParId,
  peutDecider,
  userEmail,
  onChange,
}: {
  demandeId: string;
  depassements: BudgetDepassement[];
  lignesParId: Map<string, string>;
  peutDecider: boolean;
  userEmail: string | null;
  onChange: () => void;
}) {
  const [refusId, setRefusId] = useState<string | null>(null);
  const [motifRejet, setMotifRejet] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (depassements.length === 0) return null;

  const decider = async (depassementId: string, decision: 'APPROUVE' | 'REJETE', motif?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/depassements/${depassementId}/decider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, motifRejet: motif }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la décision.');
      }
      toast.success(decision === 'APPROUVE' ? 'Dépassement approuvé : plafond de la ligne augmenté.' : 'Dépassement refusé.');
      setRefusId(null);
      setMotifRejet('');
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-t-4 border-t-orange-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-orange-700">
          <TrendingUp className="h-4 w-4" />
          Dépassements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {depassements.map((d) => {
          const propre = !!userEmail && userEmail.toLowerCase() === d.demandeParEmail.toLowerCase();
          return (
            <div key={d.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {lignesParId.get(d.ligneId) ?? 'Ligne'} — +{formatMontant(Number(d.montant))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Demandé par {d.demandeParNom || d.demandeParEmail} le {format(new Date(d.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                <Badge variant="outline" className={STATUT_META[d.statut].className}>{STATUT_META[d.statut].label}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap">{d.motif}</p>
              {d.statut !== 'EN_ATTENTE' && d.decideParEmail && (
                <p className="text-xs text-muted-foreground">
                  {d.statut === 'APPROUVE' ? 'Approuvé' : 'Refusé'} par {d.decideParEmail}
                  {d.decideAt ? ` le ${format(new Date(d.decideAt), 'dd MMM yyyy', { locale: fr })}` : ''}
                  {d.motifRejet ? ` — ${d.motifRejet}` : ''}
                </p>
              )}
              {d.statut === 'EN_ATTENTE' && peutDecider && (
                propre ? (
                  <p className="text-xs text-muted-foreground italic">Vous avez demandé ce dépassement : un autre administrateur doit en décider.</p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" disabled={isSubmitting} onClick={() => decider(d.id, 'APPROUVE')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200 hover:bg-red-50" disabled={isSubmitting} onClick={() => setRefusId(d.id)}>
                      <XCircle className="h-3.5 w-3.5" /> Refuser
                    </Button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!refusId} onOpenChange={(open) => !open && setRefusId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser le dépassement</DialogTitle>
          </DialogHeader>
          <Textarea rows={3} value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} placeholder="Motif du refus" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusId(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={isSubmitting || !motifRejet.trim()}
              onClick={() => refusId && decider(refusId, 'REJETE', motifRejet.trim())}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
