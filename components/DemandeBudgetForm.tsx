'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoiceMultiCombobox, InvoiceOption } from '@/components/InvoiceMultiCombobox';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Ligne {
  designation: string;
  montant: string;
}

interface CommandeFournisseurOption {
  id: string;
  numero: string;
  fournisseur: { entreprise: string };
}

const MODE_PAIEMENT_OPTIONS = [
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'AUTRE', label: 'Autre' },
];

const TYPE_DEPENSE_OPTIONS = [
  'Achat de matériel',
  'Prestation de service',
  'Frais de transport',
  'Frais généraux',
  'Autre',
];

const emptyLigne: Ligne = { designation: '', montant: '' };

const emptyForm = {
  departement: '',
  contexteMotivation: '',
  modePaiement: 'VIREMENT',
  typeDepense: TYPE_DEPENSE_OPTIONS[0],
  typeDepenseAutre: '',
  pourLeCompteDe: '',
  dateLimiteSouhaitee: '',
  bonCommandeId: '',
};

interface DemandeBudgetFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export function DemandeBudgetForm({ onSuccess, onCancel }: DemandeBudgetFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [lignes, setLignes] = useState<Ligne[]>([{ ...emptyLigne }]);
  const [proformaIds, setProformaIds] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [commandes, setCommandes] = useState<CommandeFournisseurOption[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/factures')
      .then((res) => (res.ok ? res.json() : []))
      .then(setInvoices)
      .catch(() => setInvoices([]));

    fetch('/api/fournisseurs/commandes')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCommandes)
      .catch(() => setCommandes([]));
  }, []);

  const addLigne = () => setLignes((prev) => [...prev, { ...emptyLigne }]);
  const removeLigne = (index: number) => setLignes((prev) => prev.filter((_, i) => i !== index));
  const updateLigne = (index: number, field: keyof Ligne, value: string) => {
    setLignes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const total = lignes.reduce((sum, l) => sum + (Number(l.montant) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.contexteMotivation.trim()) {
      toast.error('Le contexte et la motivation de la demande sont requis.');
      return;
    }

    const lignesValides = lignes.filter((l) => l.designation.trim() && Number(l.montant) > 0);
    if (lignesValides.length === 0) {
      toast.error('Ajoutez au moins une ligne de dépense avec un montant valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      const typeDepense = form.typeDepense === 'Autre' ? form.typeDepenseAutre.trim() : form.typeDepense;
      if (!typeDepense) {
        toast.error('Veuillez préciser le type de dépense.');
        setIsSubmitting(false);
        return;
      }

      const data = new FormData();
      data.append('departement', form.departement);
      data.append('contexteMotivation', form.contexteMotivation);
      data.append('modePaiement', form.modePaiement);
      data.append('typeDepense', typeDepense);
      data.append('pourLeCompteDe', form.pourLeCompteDe);
      if (form.dateLimiteSouhaitee) data.append('dateLimiteSouhaitee', new Date(form.dateLimiteSouhaitee).toISOString());
      if (form.bonCommandeId) data.append('bonCommandeId', form.bonCommandeId);
      data.append('proformaIds', JSON.stringify(proformaIds));
      data.append(
        'lignes',
        JSON.stringify(lignesValides.map((l) => ({ designation: l.designation, montant: Number(l.montant) })))
      );
      documents.forEach((file) => data.append('documentsCommande', file));

      const res = await fetch('/api/demandes-budget', { method: 'POST', body: data });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(typeof errorData.error === 'string' ? errorData.error : "Erreur lors de la création de la demande.");
      }

      toast.success('Demande de budget soumise avec succès !');
      onSuccess();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label>Contexte et motivation de la demande *</label>
        <Textarea
          value={form.contexteMotivation}
          onChange={(e) => setForm((p) => ({ ...p, contexteMotivation: e.target.value }))}
          required
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="departement">Département</label>
          <Input
            id="departement"
            value={form.departement}
            onChange={(e) => setForm((p) => ({ ...p, departement: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="pourLeCompteDe">Pour le compte de</label>
          <Input
            id="pourLeCompteDe"
            value={form.pourLeCompteDe}
            onChange={(e) => setForm((p) => ({ ...p, pourLeCompteDe: e.target.value }))}
            placeholder="Entreprise, projet, commercial..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label>Produits / Dépenses *</label>
          <Button type="button" variant="outline" size="sm" onClick={addLigne}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
          </Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[65%]">Désignation</TableHead>
                <TableHead className="w-[25%]">Montant (XOF)</TableHead>
                <TableHead className="w-[10%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((ligne, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={ligne.designation}
                      onChange={(e) => updateLigne(index, 'designation', e.target.value)}
                      placeholder="Ex: Achat de bâches"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={ligne.montant}
                      onChange={(e) => updateLigne(index, 'montant', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {lignes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLigne(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end text-lg font-bold">Total : {formatMontant(total)}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label>Mode de paiement souhaité *</label>
          <Select value={form.modePaiement} onValueChange={(v) => setForm((p) => ({ ...p, modePaiement: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODE_PAIEMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label>Type de dépense *</label>
          <Select value={form.typeDepense} onValueChange={(v) => setForm((p) => ({ ...p, typeDepense: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_DEPENSE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.typeDepense === 'Autre' && (
            <Input
              className="mt-2"
              placeholder="Précisez le type de dépense"
              value={form.typeDepenseAutre}
              onChange={(e) => setForm((p) => ({ ...p, typeDepenseAutre: e.target.value }))}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="dateLimite">Date limite souhaitée</label>
          <Input
            id="dateLimite"
            type="date"
            value={form.dateLimiteSouhaitee}
            onChange={(e) => setForm((p) => ({ ...p, dateLimiteSouhaitee: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label>Bon de commande associé</label>
          <Select value={form.bonCommandeId || 'none'} onValueChange={(v) => setForm((p) => ({ ...p, bonCommandeId: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              {commandes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.numero} — {c.fournisseur.entreprise}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label>Proforma(s) associée(s)</label>
        <InvoiceMultiCombobox invoices={invoices} value={proformaIds} onChange={setProformaIds} />
      </div>

      <div className="space-y-2">
        <label htmlFor="documentsCommande">Documents liés à la commande (devis, facture fournisseur...)</label>
        <Input
          id="documentsCommande"
          type="file"
          multiple
          onChange={(e) => setDocuments(e.target.files ? Array.from(e.target.files) : [])}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Soumission...' : 'Soumettre la demande'}
        </Button>
      </div>
    </form>
  );
}
