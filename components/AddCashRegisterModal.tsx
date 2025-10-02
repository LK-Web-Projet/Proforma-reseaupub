"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface AddCashRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegisterAdded: () => void;
}

export function AddCashRegisterModal({ open, onOpenChange, onRegisterAdded }: AddCashRegisterModalProps) {
  const [newRegisterName, setNewRegisterName] = useState('');
  const [isAddingRegister, setIsAddingRegister] = useState(false);

  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegisterName.trim()) {
      toast.error("Le nom de la caisse ne peut pas être vide.");
      return;
    }

    setIsAddingRegister(true);
    try {
      const res = await fetch('/api/cash-registers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRegisterName }),
      });

      if (res.ok) {
        toast.success("Caisse ajoutée avec succès.");
        setNewRegisterName('');
        onOpenChange(false);
        onRegisterAdded();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Échec de l'ajout de la caisse.");
      }
    } catch (error) {
      console.error('Failed to add cash register:', error);
      toast.error("Une erreur est survenue lors de l'ajout de la caisse.");
    } finally {
      setIsAddingRegister(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une nouvelle caisse</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddRegister} className="space-y-4">
          <div>
            <label htmlFor="newRegisterName">Nom de la caisse</label>
            <Input
              id="newRegisterName"
              value={newRegisterName}
              onChange={(e) => setNewRegisterName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isAddingRegister}>
            {isAddingRegister ? "Ajout en cours..." : "Ajouter la caisse"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
