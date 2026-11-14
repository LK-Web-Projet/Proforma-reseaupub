'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { DOCUMENT_UPLOAD_TYPES, DocumentUploadType, ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPE_COLORS } from '@/lib/demandeBudgetAttachmentTypes';
import {
  TYPE_BUDGET_VALUES,
  TYPE_BUDGET_META,
  TypeBudgetValue,
  CATEGORIE_DEPENSE_VALUES,
  CATEGORIE_DEPENSE_LABELS,
} from '@/lib/budgetTypes';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 10 Mo — même limite que côté serveur (lib/uploadDemandeBudget.ts), pour éviter d'envoyer
// une requête qui échouerait sur un fichier trop volumineux (photos mobile notamment).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface Ligne {
  designation: string;
  montant: string;
  categorie: string;
  // Reconduction : prévu / plafond / réalisé de la même ligne sur le budget d'origine (lecture seule).
  precedent?: { prevu: number; plafond: number; realise: number };
}

interface CommandeFournisseurOption {
  id: string;
  numero: string;
  fournisseur: { entreprise: string };
}

interface ExistingAttachment {
  id: string;
  kind: string;
  url: string;
  fileName: string;
}

interface DocumentRow {
  type: DocumentUploadType;
  file: File | null;
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

const DEPARTEMENT_OPTIONS = [
  'Informatique',
  'RH',
  'Direction Générale',
  'Finance',
  'Déploiement Terrain',
  'Régie Publicitaire',
  'Opérationnel Logistique',
  'Autre',
];

// Même règle que le serveur (lib/budgetSchema.ts, moisMensuelAccepte) : mois en cours ou à venir,
// ou le mois précédent pendant les 5 premiers jours (délai de grâce de clôture).
function moisMensuelMinimum(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 5 ? 1 : 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const emptyLigne: Ligne = { designation: '', montant: '', categorie: '' };

const emptyForm = {
  departement: '',
  departementAutre: '',
  contexteMotivation: '',
  modePaiement: 'VIREMENT',
  typeDepense: TYPE_DEPENSE_OPTIONS[0],
  typeDepenseAutre: '',
  dateLimiteSouhaitee: '',
  bonCommandeId: '',
};

type BeneficiaireType = 'CAMPAGNE_CLIENT' | 'RESEAUPUB';
const RESEAUPUB_PREFIX = 'RESEAUPUB (';
const CAMPAGNE_CLIENT_PREFIX = 'CAMPAGNE/CLIENT (';

export interface DemandeBudgetInitialData {
  type: string;
  periodeMois: string | null;
  departement: string | null;
  contexteMotivation: string;
  modePaiement: string;
  typeDepense: string;
  pourLeCompteDe: string | null;
  dateLimiteSouhaitee: string | null;
  bonCommandeId: string | null;
  proformaIds: string[];
  lignes: {
    designation: string;
    montant: number;
    categorie?: string | null;
    precedent?: { prevu: number; plafond: number; realise: number };
  }[];
  existingAttachments: ExistingAttachment[];
}

interface DemandeBudgetFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
  demandeId?: string;
  initialData?: DemandeBudgetInitialData;
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export function DemandeBudgetForm({ onSuccess, onCancel, mode = 'create', demandeId, initialData }: DemandeBudgetFormProps) {
  const { user } = useUser();
  const nomUtilisateurCourant =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.primaryEmailAddress?.emailAddress ||
    'Moi';

  const [form, setForm] = useState(emptyForm);
  const [typeBudget, setTypeBudget] = useState<TypeBudgetValue>('PONCTUEL');
  const [periodeMois, setPeriodeMois] = useState(() => new Date().toISOString().slice(0, 7));
  // Le bénéficiaire découle du type : campagne / tiers → un client ou une entreprise externe ;
  // mensuel / ponctuel → RESEAUPUB (dépense interne).
  const beneficiaireType: BeneficiaireType = typeBudget === 'CAMPAGNE' || typeBudget === 'TIERS' ? 'CAMPAGNE_CLIENT' : 'RESEAUPUB';
  const [nomCampagneClient, setNomCampagneClient] = useState('');
  const [receveurChoix, setReceveurChoix] = useState<'MOI' | 'AUTRE'>('MOI');
  const [receveurAutreNom, setReceveurAutreNom] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([{ ...emptyLigne }]);
  const [proformaIds, setProformaIds] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [commandes, setCommandes] = useState<CommandeFournisseurOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([{ type: 'DEVIS', file: null }]);
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

  useEffect(() => {
    if (!initialData) return;
    const typeDepenseConnu = TYPE_DEPENSE_OPTIONS.includes(initialData.typeDepense);
    const departementValeur = initialData.departement ?? '';
    const departementConnu = departementValeur !== '' && DEPARTEMENT_OPTIONS.includes(departementValeur);
    setForm({
      departement: departementValeur === '' ? '' : departementConnu ? departementValeur : 'Autre',
      departementAutre: departementConnu || departementValeur === '' ? '' : departementValeur,
      contexteMotivation: initialData.contexteMotivation,
      modePaiement: initialData.modePaiement,
      typeDepense: typeDepenseConnu ? initialData.typeDepense : 'Autre',
      typeDepenseAutre: typeDepenseConnu ? '' : initialData.typeDepense,
      dateLimiteSouhaitee: initialData.dateLimiteSouhaitee ? initialData.dateLimiteSouhaitee.split('T')[0] : '',
      bonCommandeId: initialData.bonCommandeId ?? '',
    });
    setLignes(
      initialData.lignes.map((l) => ({
        designation: l.designation,
        montant: String(l.montant),
        categorie: l.categorie ?? '',
        precedent: l.precedent,
      }))
    );
    setProformaIds(initialData.proformaIds);

    // "Pour le compte de" est reconstruit à partir de la chaîne déjà enregistrée
    // (ex: "RESEAUPUB (Jean Dupont)" ou "CAMPAGNE/CLIENT (Client X - RP-PRO-25/09-0001)").
    const pcd = initialData.pourLeCompteDe ?? '';
    const typeInitial = (TYPE_BUDGET_VALUES as readonly string[]).includes(initialData.type)
      ? (initialData.type as TypeBudgetValue)
      : 'PONCTUEL';
    if (initialData.periodeMois) setPeriodeMois(initialData.periodeMois.slice(0, 7));
    if (pcd.startsWith(RESEAUPUB_PREFIX) && pcd.endsWith(')')) {
      setTypeBudget(typeInitial === 'CAMPAGNE' || typeInitial === 'TIERS' ? 'PONCTUEL' : typeInitial);
      setReceveurChoix('AUTRE');
      setReceveurAutreNom(pcd.slice(RESEAUPUB_PREFIX.length, -1));
    } else {
      // Demande antérieure aux types (enregistrée "PONCTUEL") mais faite pour un client : on
      // la propose en "Tiers" (ou "Campagne" si elle a des proformas) pour ne pas perdre le bénéficiaire.
      const typeExterne: TypeBudgetValue =
        typeInitial === 'CAMPAGNE' || typeInitial === 'TIERS'
          ? typeInitial
          : initialData.proformaIds.length > 0 ? 'CAMPAGNE' : 'TIERS';
      setTypeBudget(typeExterne);
      setNomCampagneClient(
        pcd.startsWith(CAMPAGNE_CLIENT_PREFIX) && pcd.endsWith(')')
          ? pcd.slice(CAMPAGNE_CLIENT_PREFIX.length, -1).split(' - ')[0]
          : pcd
      );
    }
  }, [initialData]);

  const addLigne = () => setLignes((prev) => [...prev, { ...emptyLigne }]);
  const removeLigne = (index: number) => setLignes((prev) => prev.filter((_, i) => i !== index));
  const updateLigne = (index: number, field: 'designation' | 'montant' | 'categorie', value: string) => {
    setLignes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addDocument = () => setDocuments((prev) => [...prev, { type: 'DEVIS', file: null }]);
  const removeDocument = (index: number) => setDocuments((prev) => prev.filter((_, i) => i !== index));
  const updateDocumentType = (index: number, type: DocumentUploadType) => {
    setDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], type };
      return next;
    });
  };
  const updateDocumentFile = (index: number, file: File | null) => {
    setDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], file };
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
    if (lignesValides.some((l) => !l.categorie)) {
      toast.error('Choisissez une catégorie pour chaque ligne.');
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

      const departement = form.departement === 'Autre' ? form.departementAutre.trim() : form.departement;
      if (form.departement === 'Autre' && !departement) {
        toast.error('Veuillez préciser le département.');
        setIsSubmitting(false);
        return;
      }
      if (typeBudget === 'MENSUEL' && (!departement || !periodeMois)) {
        toast.error('Un budget mensuel nécessite un service et un mois.');
        setIsSubmitting(false);
        return;
      }
      if (typeBudget === 'CAMPAGNE' && proformaIds.length === 0) {
        toast.error('Un budget de campagne doit être associé à au moins une proforma.');
        setIsSubmitting(false);
        return;
      }

      let pourLeCompteDe: string;
      if (beneficiaireType === 'RESEAUPUB') {
        const nomReceveur = receveurChoix === 'MOI' ? nomUtilisateurCourant : receveurAutreNom.trim();
        if (!nomReceveur) {
          toast.error('Veuillez indiquer le nom du receveur.');
          setIsSubmitting(false);
          return;
        }
        pourLeCompteDe = `${RESEAUPUB_PREFIX}${nomReceveur})`;
      } else {
        if (!nomCampagneClient.trim()) {
          toast.error(typeBudget === 'TIERS' ? "Veuillez indiquer l'entreprise ou le client bénéficiaire." : 'Veuillez indiquer le nom du client ou de la campagne.');
          setIsSubmitting(false);
          return;
        }
        const numerosProformas = proformaIds
          .map((id) => invoices.find((inv) => inv.id === id)?.numero)
          .filter(Boolean);
        const suffixe = numerosProformas.length > 0 ? ` - ${numerosProformas.join(', ')}` : '';
        pourLeCompteDe = `${CAMPAGNE_CLIENT_PREFIX}${nomCampagneClient.trim()}${suffixe})`;
      }

      const data = new FormData();
      data.append('type', typeBudget);
      if (typeBudget === 'MENSUEL') data.append('periodeMois', periodeMois);
      data.append('departement', departement);
      data.append('contexteMotivation', form.contexteMotivation);
      data.append('modePaiement', form.modePaiement);
      data.append('typeDepense', typeDepense);
      data.append('pourLeCompteDe', pourLeCompteDe);
      if (form.dateLimiteSouhaitee) data.append('dateLimiteSouhaitee', new Date(form.dateLimiteSouhaitee).toISOString());
      if (form.bonCommandeId) data.append('bonCommandeId', form.bonCommandeId);
      data.append('proformaIds', JSON.stringify(beneficiaireType === 'CAMPAGNE_CLIENT' ? proformaIds : []));
      data.append(
        'lignes',
        JSON.stringify(lignesValides.map((l) => ({ designation: l.designation, montant: Number(l.montant), categorie: l.categorie })))
      );
      documents.forEach((doc) => {
        if (doc.file) data.append(`documents_${doc.type}`, doc.file);
      });

      const url = mode === 'edit' ? `/api/demandes-budget/${demandeId}/resoumettre` : '/api/demandes-budget';
      const res = await fetch(url, { method: 'POST', body: data });
      if (!res.ok) {
        const errorData = res.headers.get('content-type')?.includes('application/json')
          ? await res.json()
          : null;
        throw new Error(
          typeof errorData?.error === 'string'
            ? errorData.error
            : "Erreur lors de l'enregistrement de la demande (le fichier est peut-être trop volumineux)."
        );
      }

      toast.success(mode === 'edit' ? 'Demande soumise à nouveau avec succès !' : 'Demande de budget soumise avec succès !');
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
        <label>Type de budget *</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {TYPE_BUDGET_VALUES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeBudget(t)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                typeBudget === t ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <p className="text-sm font-semibold">{TYPE_BUDGET_META[t].label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{TYPE_BUDGET_META[t].description}</p>
            </button>
          ))}
        </div>
        {typeBudget === 'MENSUEL' && (
          <div className="flex items-center gap-2 pt-1">
            <label htmlFor="periodeMois" className="text-sm whitespace-nowrap">Mois concerné *</label>
            <Input
              id="periodeMois"
              type="month"
              className="max-w-[200px]"
              min={moisMensuelMinimum()}
              value={periodeMois}
              onChange={(e) => setPeriodeMois(e.target.value)}
              required
            />
          </div>
        )}
      </div>

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
          <label>Département{typeBudget === 'MENSUEL' ? ' *' : ''}</label>
          <Select value={form.departement} onValueChange={(v) => setForm((p) => ({ ...p, departement: v }))}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
            <SelectContent>
              {DEPARTEMENT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.departement === 'Autre' && (
            <Input
              className="mt-2"
              placeholder="Précisez le département"
              value={form.departementAutre}
              onChange={(e) => setForm((p) => ({ ...p, departementAutre: e.target.value }))}
            />
          )}
        </div>
        <div className="space-y-2">
          <label>
            {typeBudget === 'CAMPAGNE'
              ? 'Client / campagne *'
              : typeBudget === 'TIERS'
                ? 'Pour le compte de (entreprise ou client) *'
                : 'Pour le compte de RESEAUPUB — receveur *'}
          </label>

          {beneficiaireType === 'CAMPAGNE_CLIENT' ? (
            <Input
              placeholder={typeBudget === 'TIERS' ? "Nom de l'entreprise ou du client" : 'Nom du client ou de la campagne'}
              value={nomCampagneClient}
              onChange={(e) => setNomCampagneClient(e.target.value)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Select value={receveurChoix} onValueChange={(v) => setReceveurChoix(v as 'MOI' | 'AUTRE')}>
                <SelectTrigger className="w-[160px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOI">Moi ({nomUtilisateurCourant})</SelectItem>
                  <SelectItem value="AUTRE">Autre</SelectItem>
                </SelectContent>
              </Select>
              {receveurChoix === 'AUTRE' && (
                <Input
                  placeholder="Nom du receveur"
                  value={receveurAutreNom}
                  onChange={(e) => setReceveurAutreNom(e.target.value)}
                />
              )}
            </div>
          )}
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
                <TableHead className="w-[42%]">Désignation</TableHead>
                <TableHead className="w-[28%] min-w-[170px]">Catégorie *</TableHead>
                <TableHead className="w-[22%] min-w-[130px]">Montant (XOF)</TableHead>
                <TableHead className="w-[8%]"></TableHead>
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
                    <Select value={ligne.categorie} onValueChange={(v) => updateLigne(index, 'categorie', v)}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIE_DEPENSE_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={ligne.montant}
                      onChange={(e) => updateLigne(index, 'montant', e.target.value)}
                    />
                    {ligne.precedent && (
                      <p
                        className={cn(
                          'text-[11px] mt-1 leading-tight',
                          ligne.precedent.realise > ligne.precedent.prevu ? 'text-orange-700' : 'text-muted-foreground'
                        )}
                        title="Budget d'origine : prévu / dépensé réellement"
                      >
                        Précédent : {formatMontant(ligne.precedent.prevu)} prévu, {formatMontant(ligne.precedent.realise)} dépensé
                      </p>
                    )}
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

      {beneficiaireType === 'CAMPAGNE_CLIENT' && (
        <div className="space-y-2">
          <label>
            Proforma(s) associée(s){typeBudget === 'CAMPAGNE' ? ' *' : ' (facultatif)'}
          </label>
          <p className="text-xs text-muted-foreground">
            Les dépenses de ce budget seront imputées à la proforma choisie et apparaîtront dans sa fiche.
          </p>
          <InvoiceMultiCombobox invoices={invoices} value={proformaIds} onChange={setProformaIds} />
        </div>
      )}

      {initialData && initialData.existingAttachments.length > 0 && (
        <div className="space-y-2">
          <label>Documents déjà fournis</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {initialData.existingAttachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={cn('text-xs font-normal shrink-0', ATTACHMENT_TYPE_COLORS[a.kind])}>
                    {ATTACHMENT_TYPE_LABELS[a.kind] ?? a.kind}
                  </Badge>
                  <span className="text-sm truncate">{a.fileName}</span>
                </div>
                <AttachmentPreviewButton url={a.url} title={a.fileName} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label>Documents {initialData ? 'à ajouter' : '(devis, facture, bon de commande...)'}</label>
          <Button type="button" variant="outline" size="sm" onClick={addDocument}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter un document
          </Button>
        </div>
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={doc.type} onValueChange={(v) => updateDocumentType(index, v as DocumentUploadType)}>
                <SelectTrigger className="w-[220px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_UPLOAD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ATTACHMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > MAX_FILE_SIZE_BYTES) {
                    toast.error(`Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
                    e.target.value = "";
                    return;
                  }
                  updateDocumentFile(index, file);
                }}
              />
              {documents.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDocument(index)}
                  className="text-red-500 hover:text-red-700 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Soumission...' : mode === 'edit' ? 'Soumettre à nouveau' : 'Soumettre la demande'}
        </Button>
      </div>
    </form>
  );
}
