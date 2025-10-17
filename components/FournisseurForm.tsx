'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fournisseur } from './FournisseurModal';

interface FournisseurFormProps {
  onSubmit: (data: Omit<Fournisseur, 'id'>) => void;
  initialData?: Fournisseur | null;
  isSubmitting: boolean;
}

const domainOptions = ["Informatique", "BTP", "Communication", "Prestation de service"];

export function FournisseurForm({ onSubmit, initialData, isSubmitting }: FournisseurFormProps) {
  const [formData, setFormData] = useState({
    entreprise: '',
    nom: '',
    prenom: '',
    email: '',
    contact: '',
    domaineActivite: '',
    adresse: '',
  });
  const [isOtherDomain, setIsOtherDomain] = useState(false);

  useEffect(() => {
    if (initialData) {
      const initialDomain = initialData.domaineActivite || '';
      const isCustomDomain = initialDomain && !domainOptions.includes(initialDomain);
      
      setFormData({
        entreprise: initialData.entreprise || '',
        nom: initialData.nom || '',
        prenom: initialData.prenom || '',
        email: initialData.email || '',
        contact: initialData.contact || '',
        domaineActivite: initialDomain,
        adresse: initialData.adresse || '',
      });

      if (isCustomDomain) {
        setIsOtherDomain(true);
      }

    } else {
      // Reset form for new entry
      setFormData({
        entreprise: '',
        nom: '',
        prenom: '',
        email: '',
        contact: '',
        domaineActivite: '',
        adresse: '',
      });
      setIsOtherDomain(false);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDomainChange = (value: string) => {
    if (value === 'Autre') {
      setIsOtherDomain(true);
      setFormData((prev) => ({ ...prev, domaineActivite: '' }));
    } else {
      setIsOtherDomain(false);
      setFormData((prev) => ({ ...prev, domaineActivite: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const selectValue = isOtherDomain ? 'Autre' : formData.domaineActivite;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="entreprise">Entreprise *</label>
          <Input id="entreprise" name="entreprise" value={formData.entreprise} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <label htmlFor="domaineActivite">Domaine d'activité</label>
          <Select onValueChange={handleDomainChange} value={selectValue}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un domaine" />
            </SelectTrigger>
            <SelectContent>
              {domainOptions.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isOtherDomain && (
        <div className="space-y-2">
          <label htmlFor="customDomaineActivite">Domaine d'activité (personnalisé)</label>
          <Input 
            id="customDomaineActivite" 
            name="domaineActivite" 
            value={formData.domaineActivite} 
            onChange={handleChange} 
            placeholder="Précisez le domaine d'activité"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="nom">Nom</label>
          <Input id="nom" name="nom" value={formData.nom} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <label htmlFor="prenom">Prénom</label>
          <Input id="prenom" name="prenom" value={formData.prenom} onChange={handleChange} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="email">Email *</label>
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact">Contact *</label>
          <Input id="contact" name="contact" value={formData.contact} onChange={handleChange} required />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="adresse">Adresse</label>
        <Input id="adresse" name="adresse" value={formData.adresse} onChange={handleChange} />
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
