'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { normaliserNomDepartement } from '@/lib/departements';
import { toast } from 'sonner';

export interface DepartementFormData {
  id?: string;
  nom: string;
  code: string | null;
  description: string | null;
  emailContact: string | null;
  telephone: string | null;
  codeAnalytique: string | null;
  couleur: string | null;
  enveloppeMensuelle: number | null;
}

const VIDE = { nom: '', code: '', description: '', emailContact: '', telephone: '', codeAnalytique: '', couleur: '', enveloppeMensuelle: '' };

/**
 * Création ou modification d'un département. Seul le nom est obligatoire ; il est enregistré en
 * MAJUSCULES (aperçu sous le champ). Le responsable n'est pas saisi ici : c'est le prestataire
 * rattaché au département avec le poste « Responsable de département ».
 */
export function DepartementDialog({
  open,
  departement,
  onClose,
  onSuccess,
}: {
  open: boolean;
  /** null = création. */
  departement: DepartementFormData | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(VIDE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      departement
        ? {
            nom: departement.nom,
            code: departement.code ?? '',
            description: departement.description ?? '',
            emailContact: departement.emailContact ?? '',
            telephone: departement.telephone ?? '',
            codeAnalytique: departement.codeAnalytique ?? '',
            couleur: departement.couleur ?? '',
            enveloppeMensuelle: departement.enveloppeMensuelle === null ? '' : String(departement.enveloppeMensuelle),
          }
        : VIDE
    );
  }, [open, departement]);

  const champ = (cle: keyof typeof VIDE) => ({
    value: form[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [cle]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (normaliserNomDepartement(form.nom).length < 2) return void toast.error('Le nom du département est requis.');
    setIsSubmitting(true);
    try {
      const res = await fetch(departement?.id ? `/api/departements/${departement.id}` : '/api/departements', {
        method: departement?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, enveloppeMensuelle: form.enveloppeMensuelle === '' ? null : Number(form.enveloppeMensuelle) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : "Erreur lors de l'enregistrement.");
      toast.success(departement?.id ? 'Département modifié.' : `Département « ${data.nom} » créé.`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const apercuNom = form.nom.trim() ? normaliserNomDepartement(form.nom) : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{departement?.id ? 'Modifier le département' : 'Nouveau département'}</DialogTitle>
          <DialogDescription>Seul le nom est obligatoire. Les autres informations peuvent être complétées plus tard.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dep-nom">Nom *</Label>
              <Input id="dep-nom" {...champ('nom')} placeholder="Ex. : RESSOURCES HUMAINES" autoFocus maxLength={80} />
              {apercuNom && apercuNom !== form.nom && (
                <p className="text-xs text-muted-foreground">
                  Enregistré comme : <span className="font-medium text-foreground">{apercuNom}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-code">Code court</Label>
              <Input id="dep-code" {...champ('code')} placeholder="Ex. : RH" maxLength={12} className="uppercase" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-description">Description</Label>
            <Textarea id="dep-description" rows={3} maxLength={1000} {...champ('description')} placeholder="Rôle du département, périmètre, activités…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dep-email">E-mail de contact</Label>
              <Input id="dep-email" type="email" {...champ('emailContact')} placeholder="service@reseaupub.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-tel">Téléphone</Label>
              <Input id="dep-tel" {...champ('telephone')} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-analytique">Code comptable (centre de coût)</Label>
              <Input id="dep-analytique" {...champ('codeAnalytique')} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-enveloppe">Montant mensuel indicatif (XOF)</Label>
              <Input id="dep-enveloppe" type="number" min={0} step="1" {...champ('enveloppeMensuelle')} placeholder="Pour comparer aux dépenses du mois" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-couleur">Couleur (graphiques)</Label>
            <div className="flex items-center gap-2">
              <input
                id="dep-couleur"
                type="color"
                value={form.couleur || '#4f46e5'}
                onChange={(e) => setForm((p) => ({ ...p, couleur: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
              />
              {form.couleur ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm((p) => ({ ...p, couleur: '' }))}>
                  Aucune couleur
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Facultatif</span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {departement?.id ? 'Enregistrer' : 'Créer le département'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
