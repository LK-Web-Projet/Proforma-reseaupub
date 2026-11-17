'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Ajout après coup du justificatif d'une dépense enregistrée « sans justificatif ». */
export function BudgetJustificatifDialog({
  demandeId,
  depenseId,
  onClose,
  onSuccess,
}: {
  demandeId: string;
  depenseId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depenseId || files.length === 0) return void toast.error('Sélectionnez au moins un fichier.');
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('depenseId', depenseId);
      files.forEach((f) => data.append('preuves', f));
      const res = await fetch(`/api/demandes-budget/${demandeId}/documents`, { method: 'POST', body: data });
      if (!res.ok) {
        const err = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
        throw new Error(typeof err?.error === 'string' ? err.error : "Erreur lors de l'ajout du justificatif.");
      }
      toast.success('Justificatif ajouté — la dépense est désormais justifiée.');
      setFiles([]);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!depenseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter le justificatif</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="file"
            multiple
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              const tooBig = selected.find((f) => f.size > MAX_FILE_SIZE_BYTES);
              if (tooBig) {
                toast.error(`Le fichier "${tooBig.name}" dépasse la taille maximale autorisée (10 Mo).`);
                e.target.value = '';
                return;
              }
              setFiles(selected);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Envoi...' : 'Ajouter'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
