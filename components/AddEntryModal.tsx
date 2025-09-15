
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

export function AddEntryModal({ onEntryAdded }: { onEntryAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState('');
  const [type, setType] = useState('RECETTE');
  const [montant, setMontant] = useState('');
  const [dateOperation, setDateOperation] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        setDateOperation(new Date().toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Failed to add cash journal entry:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <label htmlFor="date_operation">Date de l'opération</label>
            <Input
              id="date_operation"
              type="date"
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
          <Button type="submit">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
