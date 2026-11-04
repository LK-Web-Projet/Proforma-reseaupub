'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DOCUMENT_UPLOAD_TYPES, DocumentUploadType, ATTACHMENT_TYPE_LABELS } from '@/lib/demandeBudgetAttachmentTypes';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// 10 Mo — même limite que côté serveur (lib/uploadDemandeBudget.ts).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface DocumentRow {
  type: DocumentUploadType;
  file: File | null;
}

interface DemandeBudgetAddDocumentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  demandeId: string;
}

export function DemandeBudgetAddDocumentsDialog({ isOpen, onClose, onSuccess, demandeId }: DemandeBudgetAddDocumentsDialogProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>([{ type: 'DEVIS', file: null }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addDocument = () => setDocuments((prev) => [...prev, { type: 'DEVIS', file: null }]);
  const removeDocument = (index: number) => setDocuments((prev) => prev.filter((_, i) => i !== index));
  const updateDocumentType = (index: number, type: DocumentUploadType) => {
    setDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], type };
      return next;
    });
  };
  const updateDocumentFile = (index: number, file: File | null) => {
    setDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], file };
      return next;
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDocuments([{ type: 'DEVIS', file: null }]);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const documentsValides = documents.filter((d) => d.file);
    if (documentsValides.length === 0) {
      toast.error('Sélectionnez au moins un fichier à ajouter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      documentsValides.forEach((doc) => {
        if (doc.file) data.append(`documents_${doc.type}`, doc.file);
      });

      const res = await fetch(`/api/demandes-budget/${demandeId}/documents`, { method: 'POST', body: data });
      if (!res.ok) {
        const errorData = res.headers.get('content-type')?.includes('application/json')
          ? await res.json()
          : null;
        throw new Error(
          typeof errorData?.error === 'string'
            ? errorData.error
            : "Erreur lors de l'ajout des documents (le fichier est peut-être trop volumineux)."
        );
      }

      toast.success('Document(s) ajouté(s) avec succès !');
      onSuccess();
      handleOpenChange(false);
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des documents</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={doc.type} onValueChange={(v) => updateDocumentType(index, v as DocumentUploadType)}>
                  <SelectTrigger className="w-[200px] shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_UPLOAD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{ATTACHMENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > MAX_FILE_SIZE_BYTES) {
                      toast.error(`Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
                      e.target.value = "";
                      return;
                    }
                    updateDocumentFile(index, file);
                  }}
                />
                {documents.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDocument(index)}
                    className="text-red-500 hover:text-red-700 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addDocument}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
          </Button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
