'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FournisseurForm } from './FournisseurForm';
import { toast } from "sonner";

// This type is shared between the modal and the form
export type Fournisseur = {
  id: string;
  nom: string | null;
  prenom: string | null;
  entreprise: string;
  email: string;
  contact: string;
  domaineActivite: string;
  adresse: string;
};

interface FournisseurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Fournisseur | null;
}

export function FournisseurModal({ isOpen, onClose, onSuccess, initialData }: FournisseurModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: Omit<Fournisseur, 'id'>) => {
    setIsSubmitting(true);
    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/fournisseurs/${initialData.id}` : '/api/fournisseurs';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Une erreur est survenue.');
      }

      toast.success(initialData ? 'Fournisseur mis à jour avec succès !' : 'Fournisseur créé avec succès !');
      onSuccess(); // Refetch data on parent page
      onClose(); // Close modal
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(String(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Modifier le fournisseur' : 'Ajouter un nouveau fournisseur'}
          </DialogTitle>
        </DialogHeader>
        <FournisseurForm 
          onSubmit={handleSubmit} 
          initialData={initialData} 
          isSubmitting={isSubmitting} 
        />
      </DialogContent>
    </Dialog>
  );
}
