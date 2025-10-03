"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Switch } from '@/components/ui/switch'; // Import Switch component

interface CashRegister {
  id: number;
  name: string;
  balance: number;
  createdAt: string;
}

interface AddEntryModalProps {
  onEntryAdded: () => void;
  cashRegisters: CashRegister[];
  selectedCashRegisterId: number | null;
}

export function AddEntryModal({ onEntryAdded, cashRegisters, selectedCashRegisterId }: AddEntryModalProps) {
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
  const [cashRegisterId, setCashRegisterId] = useState<string>('');
  const [destinationCashRegisterId, setDestinationCashRegisterId] = useState<string>('');
  const [isApportDeCaisse, setIsApportDeCaisse] = useState(false); // New state for apport de caisse
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (selectedCashRegisterId !== null) {
      setCashRegisterId(selectedCashRegisterId.toString());
    } else if (cashRegisters.length > 0) {
      // Default to the first register if none is selected
      setCashRegisterId(cashRegisters[0].id.toString());
    }
  }, [selectedCashRegisterId, cashRegisters]);

  useEffect(() => {
    if (!open) return;

    const montantValue = parseFloat(montant);
    let disable = false;
    let msg = '';

    if (!libelle.trim() || !montant || montantValue <= 0 || !dateOperation || !cashRegisterId) {
      disable = true;
      msg = 'Veuillez remplir tous les champs requis et s\'assurer que le montant est positif.';
    }

    const currentCashRegister = cashRegisters.find(reg => reg.id.toString() === cashRegisterId);

    if (currentCashRegister && (type === 'DEPENSE' || type === 'TRANSFERT')) {
      if (montantValue > currentCashRegister.balance) {
        disable = true;
        msg = `Fonds insuffisants dans la caisse ${currentCashRegister.name}. Solde actuel: ${currentCashRegister.balance.toLocaleString('fr-FR')} FCFA`;
      }
    }

    if (type === 'TRANSFERT') {
      if (!destinationCashRegisterId || cashRegisterId === destinationCashRegisterId) {
        disable = true;
        if (!msg) msg = 'Veuillez sélectionner une caisse de destination différente de la source.';
      }
    }

    setIsSubmitDisabled(disable);
    setErrorMessage(msg);

  }, [open, libelle, montant, dateOperation, type, cashRegisterId, destinationCashRegisterId, cashRegisters, isApportDeCaisse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitDisabled) {
      if (errorMessage) {
        toast.error(errorMessage);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: { libelle: string; type: string; montant: number; date_operation: string; cashRegisterId: number; destinationCashRegisterId?: number; isApportDeCaisse?: boolean } = {
        libelle,
        type,
        montant: parseFloat(montant),
        date_operation: dateOperation,
        cashRegisterId: parseInt(cashRegisterId),
      };

      if (type === 'TRANSFERT') {
        payload.destinationCashRegisterId = parseInt(destinationCashRegisterId);
      } else if (type === 'RECETTE') {
        payload.isApportDeCaisse = isApportDeCaisse;
      }

      const res = await fetch('/api/cash-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newEntry = await res.json();
        toast.success('Opération ajoutée avec succès.');

        if (file && newEntry.id) {
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await fetch(`/api/cash-journal/${newEntry.id}/upload`, {
            method: 'POST',
            body: formData,
          });

          if (uploadRes.ok) {
            toast.success('Pièce justificative uploadée avec succès.');
          } else {
            toast.error('Échec de l\'upload de la pièce justificative.');
          }
        }

        onEntryAdded();
        setOpen(false);
        setLibelle('');
        setType('RECETTE');
        setMontant('');
        setDateOperation(getLocalDatetime());
        setDestinationCashRegisterId(''); 
        setIsApportDeCaisse(false);
        setFile(null); // Reset file state
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Échec de l\'ajout de l\'opération.');
      }
    } catch (error) {
      console.error('Failed to add cash journal entry:', error);
      toast.error('Une erreur est survenue lors de l\'ajout de l\'opération.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDateOperation(getLocalDatetime());
      // Reset form fields when opening
      setLibelle('');
      setType('RECETTE');
      setMontant('');
      setDestinationCashRegisterId('');
      setIsApportDeCaisse(false); // Reset apport de caisse
      if (selectedCashRegisterId !== null) {
        setCashRegisterId(selectedCashRegisterId.toString());
      } else if (cashRegisters.length > 0) {
        setCashRegisterId(cashRegisters[0].id.toString());
      }
    }
  };

  const availableDestinationRegisters = cashRegisters.filter(reg => reg.id.toString() !== cashRegisterId);

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
            <label htmlFor="cashRegister">Caisse</label>
            <Select value={cashRegisterId} onValueChange={setCashRegisterId} disabled={cashRegisters.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une caisse" />
              </SelectTrigger>
              <SelectContent>
                {cashRegisters.map((register) => (
                  <SelectItem key={register.id} value={register.id.toString()}>
                    {register.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="type">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECETTE" className='text-green-700 font-bold'>Recette</SelectItem>
                <SelectItem value="DEPENSE" className='text-red-600 font-bold'>Dépense</SelectItem>
                <SelectItem value="TRANSFERT" className='text-blue-600 font-bold'>Transfert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'TRANSFERT' && (
            <div>
              <label htmlFor="destinationCashRegister">Caisse de destination</label>
              <Select value={destinationCashRegisterId} onValueChange={setDestinationCashRegisterId} disabled={availableDestinationRegisters.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une caisse de destination" />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinationRegisters.map((register) => (
                    <SelectItem key={register.id} value={register.id.toString()}>
                      {register.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === 'RECETTE' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="isApportDeCaisse"
                checked={isApportDeCaisse}
                onCheckedChange={setIsApportDeCaisse}
              />
              <label htmlFor="isApportDeCaisse">Est un apport de caisse ?</label>
            </div>
          )}
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
          <div>
            <label htmlFor="file">Pièce justificative (facultatif)</label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
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