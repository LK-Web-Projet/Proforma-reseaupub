'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fournisseur } from './FournisseurModal';
import { TYPE_FOURNISSEUR_VALUES, resolveTypeFournisseur } from '@/lib/typeFournisseur';

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
    typeFournisseur: TYPE_FOURNISSEUR_VALUES[0] as string,
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
        typeFournisseur: resolveTypeFournisseur(initialData.typeFournisseur),
      });

      setIsOtherDomain(!!isCustomDomain);

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
        typeFournisseur: TYPE_FOURNISSEUR_VALUES[0],
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

  const handleTypeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, typeFournisseur: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, email: formData.email.trim() || null });
  };

  const selectValue = isOtherDomain ? 'Autre' : formData.domaineActivite;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="entreprise">Entreprise ou Nom &amp; Prénom *</label>
        <Input
          id="entreprise"
          name="entreprise"
          value={formData.entreprise}
          onChange={handleChange}
          placeholder="Ex : ACME SARL ou Jean Dupont"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="typeFournisseur">Type de prestataire *</label>
          <Select onValueChange={handleTypeChange} value={formData.typeFournisseur}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FOURNISSEUR_VALUES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="domaineActivite">Domaine d&apos;activité</label>
          <Select onValueChange={handleDomainChange} value={selectValue}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un domaine" />
            </SelectTrigger>
            <SelectContent>
              {domainOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isOtherDomain && (
        <div className="space-y-2">
          <label htmlFor="customDomaineActivite">
            Domaine d&apos;activité (personnalisé)
          </label>
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
          <label htmlFor="contact">Contact *</label>
          <Input
            id="contact"
            name="contact"
            value={formData.contact}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email">Email</label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="adresse">Adresse</label>
        <Input
          id="adresse"
          name="adresse"
          value={formData.adresse}
          onChange={handleChange}
        />
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
