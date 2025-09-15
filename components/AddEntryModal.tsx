
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export function AddEntryModal({ onEntryAdded, soldeFinal }: { onEntryAdded: () => void, soldeFinal: number }) {
  const getLocalDatetime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [type, setType] = useState('RECETTE');
  const [montant, setMontant] = useState('');
  const [dateOperation, setDateOperation] = useState(getLocalDatetime());
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const montantValue = parseFloat(montant);
    if (montant && montantValue === 0) {
      toast.error('Le montant ne peut pas être zéro');
      setIsSubmitDisabled(true);
    } else if (type === 'DEPENSE' && montant && montantValue > soldeFinal) {
      toast.error('Les fonds disponibles ne sont pas suffisants');
      setIsSubmitDisabled(true);
    } else {
      setIsSubmitDisabled(false);
    }
  }, [montant, type, soldeFinal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/cash-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          libelle,
          type,
          montant: parseFloat(montant),
          date_operation: dateOperation,
        }),
      });

      if (res.ok) {
        onEntryAdded();
        setOpen(false);
        setLibelle('');
        setType('RECETTE');
        setMontant('');
        setDateOperation(getLocalDatetime());
      }
    } catch (error) {
      console.error('Failed to add cash journal entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDateOperation(getLocalDatetime());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Toaster richColors />
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Ajouter une opération
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une opération</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="date_operation">Date de l&apos;opération</label>
            <Input
              id="date_operation"
              type="datetime-local"
              value={dateOperation}
              onChange={(e) => setDateOperation(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="libelle">Libellé</label>
            <Input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="type">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECETTE">Recette</SelectItem>
                <SelectItem value="DEPENSE">Dépense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="montant">Montant</label>
            <Input
              id="montant"
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitDisabled || isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Ajouter"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

