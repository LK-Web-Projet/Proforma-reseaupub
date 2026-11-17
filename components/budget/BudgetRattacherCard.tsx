'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODE_PAIEMENT_OPTIONS } from '@/lib/budgetTypes';

export interface DepenseARattacher {
  id: string;
  montant: number | string;
  datePaiement: string;
  reference: string | null;
  /** CAMPTRACK : reçue sans ligne de budget ; PROFORMA : saisie sur la proforma avant le budget. */
  origine?: 'CAMPTRACK' | 'PROFORMA';
  invoice: { numero: string };
  cashJournalEntry: { id: number; libelle: string; cashRegister: { name: string } } | null;
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

/**
 * Dépenses d'une proforma de ce budget qui ne sont sur aucun budget — reçues de Camptrack sans ligne
 * de budget, ou saisies sur la proforma avant le budget : le comptable les rattache à une ligne
 * (plafond contrôlé, aucun nouveau mouvement de caisse).
 */
export function BudgetRattacherCard({
  demandeId,
  depenses,
  lignes,
  peutRattacher,
  onSuccess,
}: {
  demandeId: string;
  depenses: DepenseARattacher[];
  lignes: { id: string; designation: string; reste: number }[];
  peutRattacher: boolean;
  onSuccess: () => void;
}) {
  const [cible, setCible] = useState<DepenseARattacher | null>(null);
  const [ligneId, setLigneId] = useState('');
  const [modePaiement, setModePaiement] = useState('MOBILE_MONEY');
  const [nomReceveur, setNomReceveur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (depenses.length === 0) return null;

  const ouvrir = (d: DepenseARattacher) => {
    setCible(d);
    setLigneId('');
    setModePaiement(d.origine === 'PROFORMA' ? 'ESPECES' : 'MOBILE_MONEY');
    setNomReceveur(d.origine === 'PROFORMA' ? d.reference ?? '' : 'Prestataires (Camptrack)');
  };

  const rattacher = async () => {
    if (!cible || !ligneId) return void toast.error('Choisissez la ligne de budget.');
    setEnvoi(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/rattacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paiementId: cible.id, ligneId, modePaiement, nomReceveur: nomReceveur.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors du rattachement.');
      }
      toast.success('Dépense rattachée à la ligne de budget.');
      setCible(null);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Card className="border-t-4 border-t-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {depenses.length} dépense(s) hors budget à rattacher
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Dépenses de la campagne qui ne sont sur aucune ligne : paiements reçus de Camptrack sans ligne de budget, ou dépenses saisies
          sur la proforma avant le budget. Rattachez chacune à sa ligne : le plafond est contrôlé, la caisse n&apos;est pas touchée une
          seconde fois.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {depenses.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">
                <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {d.origine === 'PROFORMA' ? 'Avant le budget' : 'Camptrack'}
                </span>
                {d.cashJournalEntry?.libelle ?? d.reference ?? 'Dépense'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(d.datePaiement), 'dd/MM/yyyy')} · proforma {d.invoice.numero}
                {d.cashJournalEntry ? ` · ${d.cashJournalEntry.cashRegister.name} · écriture n° ${d.cashJournalEntry.id}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-semibold">{fcfa(Number(d.montant))}</span>
              {peutRattacher && (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => ouvrir(d)}>
                  <Link2 className="h-3.5 w-3.5" /> Rattacher
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!cible} onOpenChange={(o) => !o && setCible(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rattacher à une ligne de budget</DialogTitle></DialogHeader>
          {cible && (
            <div className="space-y-4">
              <p className="text-sm">{cible.cashJournalEntry?.libelle} — <strong>{fcfa(Number(cible.montant))}</strong></p>
              <div className="space-y-2">
                <Label>Ligne de budget *</Label>
                <Select value={ligneId} onValueChange={setLigneId}>
                  <SelectTrigger><SelectValue placeholder="Choisir la ligne" /></SelectTrigger>
                  <SelectContent>
                    {lignes.map((l) => (
                      <SelectItem key={l.id} value={l.id} disabled={l.reste + 0.005 < Number(cible.montant)}>
                        {l.designation} — reste {fcfa(l.reste)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Moyen de paiement</Label>
                  <Select value={modePaiement} onValueChange={setModePaiement}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODE_PAIEMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rat-receveur">Receveur</Label>
                  <Input id="rat-receveur" value={nomReceveur} onChange={(e) => setNomReceveur(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCible(null)}>Annuler</Button>
            <Button onClick={rattacher} disabled={envoi}>{envoi ? 'Rattachement…' : 'Rattacher'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
