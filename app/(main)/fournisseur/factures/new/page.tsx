'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FournisseurCombobox, Fournisseur } from '@/components/FournisseurCombobox';
import { FournisseurModal } from '@/components/FournisseurModal';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function NewFactureFournisseurPage() {
  const router = useRouter();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [formData, setFormData] = useState({
    reference: '',
    montant: '',
    date: new Date(),
    fournisseurId: '',
    status: 'EN_ATTENTE',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchFournisseurs = useCallback(async () => {
    try {
      const res = await fetch("/api/fournisseurs");
      if (!res.ok) throw new Error("Failed to fetch fournisseurs");
      const data = await res.json();
      setFournisseurs(data);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des fournisseurs.");
    }
  }, []);

  useEffect(() => {
    fetchFournisseurs();
  }, [fetchFournisseurs]);

  const handleFournisseurCreated = (newFournisseur: Fournisseur) => {
    fetchFournisseurs().then(() => {
      setFormData(prev => ({ ...prev, fournisseurId: newFournisseur.id }));
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fournisseurId) {
      toast.error("Veuillez sélectionner un fournisseur.");
      return;
    }
    setIsSubmitting(true);

    const data = new FormData();
    data.append('reference', formData.reference);
    data.append('montant', formData.montant);
    data.append('date', formData.date.toISOString());
    data.append('fournisseurId', formData.fournisseurId);
    data.append('status', formData.status);
    if (file) {
      data.append('pieceJointe', file);
    }

    try {
      const response = await fetch('/api/factures-fournisseurs', {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Une erreur est survenue.');
      }

      toast.success("Facture fournisseur créée avec succès !");
      router.push('/fournisseur/factures'); // Redirect to a future list page
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FournisseurModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleFournisseurCreated} 
      />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Ajouter une Facture Fournisseur</h1>
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations sur la facture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label>Fournisseur *</label>
                  <FournisseurCombobox 
                    fournisseurs={fournisseurs} 
                    value={formData.fournisseurId} 
                    onChange={(id) => setFormData(prev => ({ ...prev, fournisseurId: id }))}
                    onAddNew={() => setIsModalOpen(true)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="reference">Référence de la facture *</label>
                  <Input id="reference" name="reference" value={formData.reference} onChange={handleChange} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                  <label htmlFor="montant">Montant (XOF) *</label>
                  <Input id="montant" name="montant" type="number" value={formData.montant} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <label>Date de la facture *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, "PPP") : <span>Choisir une date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={formData.date} onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label>Statut</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                      <SelectItem value="PAYEE">Payée</SelectItem>
                      <SelectItem value="ANNULEE">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="pieceJointe">Pièce jointe (PDF, Image)</label>
                  <Input id="pieceJointe" type="file" onChange={handleFileChange} />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la facture'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
}
