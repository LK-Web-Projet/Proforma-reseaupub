
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface UploadAttachmentModalProps {
  cashJournalId: number;
  onUploadComplete: () => void;
}

export function UploadAttachmentModal({ cashJournalId, onUploadComplete }: UploadAttachmentModalProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      toast.error("Veuillez sélectionner au moins un fichier.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await fetch(`/api/cash-journal/${cashJournalId}/upload`,
       {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success(`${files.length} fichier(s) uploadé(s) avec succès.`);
        onUploadComplete();
        setOpen(false);
        setFiles(null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Échec de l'upload des fichiers.");
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
      toast.error("Une erreur est survenue lors de l'upload.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uploader des pièces justificatives</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="files">Fichiers</label>
            <Input
              id="files"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              required
            />
          </div>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? "Envoi en cours..." : "Uploader"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
