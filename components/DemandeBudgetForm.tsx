'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoiceCombobox, InvoiceOption } from '@/components/InvoiceCombobox';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { DOCUMENT_UPLOAD_TYPES, DocumentUploadType, ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPE_COLORS } from '@/lib/demandeBudgetAttachmentTypes';
import {
  TYPE_BUDGET_VALUES,
  TYPE_BUDGET_META,
  typeBudgetDisponible,
  TypeBudgetValue,
  CATEGORIE_DEPENSE_VALUES,
  CATEGORIE_DEPENSE_LABELS,
  totauxParModePaiement,
} from '@/lib/budgetTypes';
import { moyensProposes } from '@/lib/moyensPaiement';
import { useMoyensPaiement } from '@/lib/useMoyensPaiement';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { SANS_DEPARTEMENT, type DepartementOption } from '@/lib/departements';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next-nprogress-bar';
import { OuvertureBudgetCollectif } from '@/components/budget/OuvertureBudgetCollectif';
import { ChampAutoHauteur } from '@/components/budget/ChampAutoHauteur';

// 10 Mo — même limite que côté serveur (lib/uploadDemandeBudget.ts), pour éviter d'envoyer
// une requête qui échouerait sur un fichier trop volumineux (photos mobile notamment).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface Ligne {
  designation: string;
  // Département de la ligne (obligatoire) : id d'un département de la table Départements.
  departementId: string;
  montant: string;
  categorie: string;
  // Moyen de paiement prévu pour la ligne (le moyen « principal » de la demande en est déduit).
  modePaiement: string;
  // Précisions facultatives sur la ligne (visibles dans la fenêtre « Détail » de la fiche).
  detail: string;
  // Délai propre à la ligne (AAAA-MM-JJ, vide = pas de délai particulier).
  dateLimite: string;
  // Zone de détail dépliée dans le formulaire.
  detailOuvert?: boolean;
  // Reconduction : prévu / plafond / réalisé de la même ligne sur le budget d'origine (lecture seule).
  precedent?: { prevu: number; plafond: number; realise: number };
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
  /** Fournisseur d'une proforma fournisseur (DEVIS) : inscrit dans le nom du fichier. */
  precision: string;
}

// Moyen de paiement d'une nouvelle ligne.
const MODE_LIGNE_DEFAUT = 'VIREMENT';

/**
 * Moyen « principal » de la demande (colonne obligatoire, proposé par défaut à la saisie d'une
 * dépense) : celui qui porte le plus gros montant parmi les lignes.
 */
function modePrincipal(lignes: { montant: number; modePaiement: string }[]): string {
  const totaux = new Map<string, number>();
  for (const l of lignes) totaux.set(l.modePaiement, (totaux.get(l.modePaiement) ?? 0) + l.montant);
  let meilleur = MODE_LIGNE_DEFAUT;
  let max = -1;
  for (const [mode, montant] of totaux) {
    if (montant > max) {
      meilleur = mode;
      max = montant;
    }
  }
  return meilleur;
}


// Même règle que le serveur (lib/budgetSchema.ts, moisMensuelAccepte) : mois en cours ou à venir,
// ou le mois précédent pendant les 5 premiers jours (délai de grâce de clôture).
function moisMensuelMinimum(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - (now.getDate() <= 5 ? 1 : 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Colonnes d'une ligne quand tout tient sur une rangée (conteneur ≥ 64rem) ; en dessous, 2 colonnes
// puis 1 (téléphone), avec un libellé au-dessus de chaque champ.
const GRILLE_LIGNE =
  '@5xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]';
const LIBELLE_CHAMP = 'block text-xs font-medium text-muted-foreground @5xl:hidden';
// Liste déroulante dont le texte passe à la ligne au lieu d'être coupé ou de déborder.
const SELECT_QUI_PASSE_A_LA_LIGNE =
  'w-full min-h-9 data-[size=default]:h-auto whitespace-normal text-left *:data-[slot=select-value]:line-clamp-none';

/** « Nom de la campagne (Nom du client) » — sans parenthèses si le client n'est pas (encore) connu. */
function nomAvecClient(nomCampagne: string, client: string): string {
  const nom = nomCampagne.trim();
  // Anciens budgets où le nom saisi était déjà celui du client : pas de « Client X (Client X) ».
  if (!client || nom.toLowerCase() === client.toLowerCase()) return nom;
  return `${nom} (${client})`;
}

const emptyLigne: Ligne = { designation: '', departementId: '', montant: '', categorie: '', modePaiement: MODE_LIGNE_DEFAUT, detail: '', dateLimite: '' };

const emptyForm = {
  contexteMotivation: '',
  dateLimiteSouhaitee: '',
};

type BeneficiaireType = 'CAMPAGNE_CLIENT' | 'RESEAUPUB';
const RESEAUPUB_PREFIX = 'RESEAUPUB (';
const CAMPAGNE_CLIENT_PREFIX = 'CAMPAGNE/CLIENT (';

export interface DemandeBudgetInitialData {
  type: string;
  periodeMois: string | null;
  departement: string | null;
  contexteMotivation: string;
  /** Moyen de la demande : repris pour les anciennes lignes enregistrées sans moyen propre. */
  modePaiement: string;
  pourLeCompteDe: string | null;
  dateLimiteSouhaitee: string | null;
  proformaIds: string[];
  lignes: {
    designation: string;
    montant: number;
    departementId?: string | null;
    /** Département actuel de la ligne (modification) : gardé dans la liste même s'il a été désactivé. */
    departement?: { id: string; nom: string; code?: string | null } | null;
    categorie?: string | null;
    modePaiement?: string | null;
    detail?: string | null;
    dateLimite?: string | null;
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
  // Premier type proposé : Mensuel (ordre des cartes : Mensuel, Campagne, Ponctuel, Tiers).
  const [typeBudget, setTypeBudget] = useState<TypeBudgetValue>('MENSUEL');
  // Type du budget modifié (ou reconduit) : reste sélectionnable même s'il est indisponible.
  const [typeDeDepart, setTypeDeDepart] = useState<TypeBudgetValue | null>(null);
  const [periodeMois, setPeriodeMois] = useState(() => new Date().toISOString().slice(0, 7));
  // Budget collectif (2026-11-26) : le mensuel l'est toujours ; une campagne l'est au choix.
  const router = useRouter();
  const [campagneCollective, setCampagneCollective] = useState(false);
  // Le bénéficiaire découle du type : campagne / tiers → un client ou une entreprise externe ;
  // mensuel / ponctuel → RESEAUPUB (dépense interne).
  const beneficiaireType: BeneficiaireType = typeBudget === 'CAMPAGNE' || typeBudget === 'TIERS' ? 'CAMPAGNE_CLIENT' : 'RESEAUPUB';
  // Budget mensuel : pas de receveur (chaque ligne porte déjà son département) — champ masqué.
  const sansReceveur = typeBudget === 'MENSUEL';
  const [nomCampagneClient, setNomCampagneClient] = useState('');
  const [receveurChoix, setReceveurChoix] = useState<'MOI' | 'AUTRE'>('MOI');
  const [receveurAutreNom, setReceveurAutreNom] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([{ ...emptyLigne }]);
  // Une seule proforma par budget (0 ou 1 élément ; tableau conservé pour l'API).
  const [proformaIds, setProformaIds] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([{ type: 'DEVIS', file: null, precision: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Client de la proforma choisie : complète le nom de la campagne, « Nom de la campagne (Client) ».
  const proformaChoisie = invoices.find((inv) => inv.id === proformaIds[0]);
  const clientProforma = proformaChoisie?.client?.nom?.trim() || '';

  // Départements proposés sur chaque ligne (actifs), plus ceux déjà présents sur un budget modifié.
  const [departements, setDepartements] = useState<DepartementOption[]>([]);
  useEffect(() => {
    fetch('/api/departements?actifs=1')
      .then((res) => (res.ok ? res.json() : []))
      .then(setDepartements)
      .catch(() => setDepartements([]));
  }, []);
  const optionsDepartement = React.useMemo(() => {
    const liste = [...departements];
    for (const l of initialData?.lignes ?? []) {
      if (l.departement && !liste.some((d) => d.id === l.departement!.id)) {
        liste.push({ id: l.departement.id, nom: l.departement.nom, code: l.departement.code ?? null, couleur: null, actif: false });
      }
    }
    return liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [departements, initialData]);
  const nomDepartement = (id: string) => optionsDepartement.find((d) => d.id === id)?.nom ?? SANS_DEPARTEMENT;

  // Moyens de paiement proposés sur chaque ligne : les actifs, plus ceux déjà présents sur un budget modifié.
  const { moyens } = useMoyensPaiement();
  const codesInitiaux = React.useMemo(
    () => [initialData?.modePaiement, ...(initialData?.lignes ?? []).map((l) => l.modePaiement)],
    [initialData]
  );
  const optionsMoyen = React.useMemo(() => moyensProposes(moyens, ...codesInitiaux), [moyens, codesInitiaux]);

  useEffect(() => {
    fetch('/api/factures')
      .then((res) => (res.ok ? res.json() : []))
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, []);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      contexteMotivation: initialData.contexteMotivation,
      dateLimiteSouhaitee: initialData.dateLimiteSouhaitee ? initialData.dateLimiteSouhaitee.split('T')[0] : '',
    });
    setLignes(
      initialData.lignes.map((l) => ({
        designation: l.designation,
        departementId: l.departementId ?? l.departement?.id ?? '',
        montant: String(l.montant),
        categorie: l.categorie ?? '',
        modePaiement: l.modePaiement || initialData.modePaiement || MODE_LIGNE_DEFAUT,
        detail: l.detail ?? '',
        dateLimite: l.dateLimite ? l.dateLimite.slice(0, 10) : '',
        detailOuvert: !!l.detail,
        precedent: l.precedent,
      }))
    );
    setProformaIds(initialData.proformaIds.slice(0, 1));

    // "Pour le compte de" est reconstruit à partir de la chaîne déjà enregistrée
    // (ex: "RESEAUPUB (Jean Dupont)" ou "CAMPAGNE/CLIENT (Client X - RP-PRO-25/09-0001)").
    const pcd = initialData.pourLeCompteDe ?? '';
    const typeInitial = (TYPE_BUDGET_VALUES as readonly string[]).includes(initialData.type)
      ? (initialData.type as TypeBudgetValue)
      : 'PONCTUEL';
    if (initialData.periodeMois) setPeriodeMois(initialData.periodeMois.slice(0, 7));
    if (pcd.startsWith(RESEAUPUB_PREFIX) && pcd.endsWith(')')) {
      const typeRetenu = typeInitial === 'CAMPAGNE' || typeInitial === 'TIERS' ? 'PONCTUEL' : typeInitial;
      setTypeBudget(typeRetenu);
      if (mode === 'edit') setTypeDeDepart(typeRetenu);
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
      if (mode === 'edit') setTypeDeDepart(typeExterne);
      const formatCampagne = typeExterne === 'CAMPAGNE' ? /^(.+?) \(([^()]+)\)$/.exec(pcd) : null;
      setNomCampagneClient(
        pcd.startsWith(CAMPAGNE_CLIENT_PREFIX) && pcd.endsWith(')')
          ? pcd.slice(CAMPAGNE_CLIENT_PREFIX.length, -1).split(' - ')[0]
          : formatCampagne
            ? formatCampagne[1]
            : pcd
      );
    }
  }, [initialData, mode]);

  // Nouvelle ligne : même département que la précédente (souvent identique), modifiable.
  const addLigne = () =>
    setLignes((prev) => [...prev, { ...emptyLigne, departementId: prev[prev.length - 1]?.departementId ?? '' }]);
  const removeLigne = (index: number) => setLignes((prev) => prev.filter((_, i) => i !== index));
  const updateLigne = (
    index: number,
    field: 'designation' | 'departementId' | 'montant' | 'categorie' | 'modePaiement' | 'detail' | 'dateLimite',
    value: string
  ) => {
    setLignes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const basculerDetail = (index: number) =>
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, detailOuvert: !l.detailOuvert } : l)));

  const addDocument = () => setDocuments((prev) => [...prev, { type: 'DEVIS', file: null, precision: '' }]);
  const updateDocumentPrecision = (index: number, precision: string) => {
    setDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], precision };
      return next;
    });
  };
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
  const totauxParMode = totauxParModePaiement(
    lignes.map((l) => ({ montant: Number(l.montant) || 0, modePaiement: l.modePaiement })),
    MODE_LIGNE_DEFAUT,
    moyens
  ).filter((t) => t.demande > 0);
  // Total par département (lignes avec un montant), du plus gros au plus petit.
  const totauxParDepartement = React.useMemo(() => {
    const totaux = new Map<string, number>();
    for (const l of lignes) {
      const m = Number(l.montant) || 0;
      if (m <= 0) continue;
      totaux.set(l.departementId, (totaux.get(l.departementId) ?? 0) + m);
    }
    return [...totaux.entries()].map(([id, montant]) => ({ id, montant })).sort((a, b) => b.montant - a.montant);
  }, [lignes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!typeBudgetDisponible(typeBudget) && typeDeDepart !== typeBudget) {
      toast.error(`Les budgets « ${TYPE_BUDGET_META[typeBudget].label} » sont indisponibles pour le moment : choisissez un autre type.`);
      return;
    }
    if (!form.contexteMotivation.trim()) {
      toast.error('Le contexte et la motivation de la demande sont requis.');
      return;
    }

    const lignesValides = lignes.filter((l) => l.designation.trim() && Number(l.montant) > 0);
    if (lignesValides.length === 0) {
      toast.error('Ajoutez au moins une ligne de dépense avec un montant valide.');
      return;
    }
    if (lignesValides.some((l) => !l.departementId)) {
      toast.error('Choisissez le département de chaque ligne.');
      return;
    }
    if (lignesValides.some((l) => !l.categorie)) {
      toast.error('Choisissez une catégorie pour chaque ligne.');
      return;
    }
    if (documents.some((d) => d.file && d.type === 'DEVIS' && !d.precision.trim())) {
      toast.error('Indiquez le fournisseur de chaque proforma fournisseur : il sert à la retrouver dans la liasse du bon de commande.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (typeBudget === 'MENSUEL' && !periodeMois) {
        toast.error('Un budget mensuel nécessite un mois.');
        setIsSubmitting(false);
        return;
      }
      if (typeBudget === 'CAMPAGNE' && proformaIds.length === 0) {
        toast.error('Un budget de campagne doit être associé à sa proforma.');
        setIsSubmitting(false);
        return;
      }

      let pourLeCompteDe: string;
      if (sansReceveur) {
        pourLeCompteDe = '';
      } else if (beneficiaireType === 'RESEAUPUB') {
        const nomReceveur = receveurChoix === 'MOI' ? nomUtilisateurCourant : receveurAutreNom.trim();
        if (!nomReceveur) {
          toast.error('Veuillez indiquer le nom du receveur.');
          setIsSubmitting(false);
          return;
        }
        pourLeCompteDe = `${RESEAUPUB_PREFIX}${nomReceveur})`;
      } else {
        if (!nomCampagneClient.trim()) {
          toast.error(typeBudget === 'TIERS' ? "Veuillez indiquer l'entreprise ou le client bénéficiaire." : 'Veuillez indiquer le nom de la campagne.');
          setIsSubmitting(false);
          return;
        }
        if (typeBudget === 'CAMPAGNE') {
          // « Nom de la campagne (Nom du client) », le client étant celui de la proforma de la campagne.
          pourLeCompteDe = nomAvecClient(nomCampagneClient, clientProforma);
        } else {
          const numerosProformas = proformaIds
            .map((id) => invoices.find((inv) => inv.id === id)?.numero)
            .filter(Boolean);
          const suffixe = numerosProformas.length > 0 ? ` - ${numerosProformas.join(', ')}` : '';
          pourLeCompteDe = `${CAMPAGNE_CLIENT_PREFIX}${nomCampagneClient.trim()}${suffixe})`;
        }
      }

      const data = new FormData();
      data.append('type', typeBudget);
      if (typeBudget === 'MENSUEL') data.append('periodeMois', periodeMois);
      data.append('contexteMotivation', form.contexteMotivation);
      data.append(
        'modePaiement',
        modePrincipal(lignesValides.map((l) => ({ montant: Number(l.montant), modePaiement: l.modePaiement })))
      );
      data.append('pourLeCompteDe', pourLeCompteDe);
      if (form.dateLimiteSouhaitee) data.append('dateLimiteSouhaitee', new Date(form.dateLimiteSouhaitee).toISOString());
      data.append('proformaIds', JSON.stringify(beneficiaireType === 'CAMPAGNE_CLIENT' ? proformaIds : []));
      data.append(
        'lignes',
        JSON.stringify(
          lignesValides.map((l) => ({
            designation: l.designation,
            departementId: l.departementId,
            montant: Number(l.montant),
            categorie: l.categorie,
            modePaiement: l.modePaiement,
            detail: l.detail.trim() || undefined,
            dateLimite: l.dateLimite || undefined,
          }))
        )
      );
      documents.forEach((doc) => {
        if (!doc.file) return;
        data.append(`documents_${doc.type}`, doc.file);
        data.append(`precisions_${doc.type}`, doc.type === 'DEVIS' ? doc.precision.trim() : '');
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

  const selecteurType = (
        <div className="space-y-2">
          <label>Type de budget *</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {TYPE_BUDGET_VALUES.map((t) => {
              // Type indisponible (Tiers) : carte grisée, sauf pour un budget déjà de ce type (modification).
              const indisponible = !typeBudgetDisponible(t) && typeDeDepart !== t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !indisponible && setTypeBudget(t)}
                  disabled={indisponible}
                  aria-disabled={indisponible || undefined}
                  title={indisponible ? 'Indisponible pour le moment' : undefined}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    indisponible
                      ? 'cursor-not-allowed bg-muted/40 opacity-60'
                      : typeBudget === t ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <p className="text-sm font-semibold flex items-center justify-between gap-2">
                    {TYPE_BUDGET_META[t].label}
                    {indisponible && <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bientôt</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {indisponible ? 'Indisponible pour le moment.' : TYPE_BUDGET_META[t].description}
                  </p>
                </button>
              );
            })}
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
          {mode === 'create' && typeBudget === 'CAMPAGNE' && (
            <label className="flex items-start gap-2 pt-1 text-sm">
              <input type="checkbox" className="mt-0.5" checked={campagneCollective} onChange={(e) => setCampagneCollective(e.target.checked)} />
              <span>
                <span className="font-medium">Budget collectif</span>
                <span className="block text-xs text-muted-foreground">Plusieurs départements saisissent leurs lignes ; le comptable vérifie puis soumet à la direction.</span>
              </span>
            </label>
          )}
        </div>
  );

  // Mensuel (toujours) ou campagne collective, à la création : ouverture « en préparation ».
  const ouvertureCollective = mode === 'create' && (typeBudget === 'MENSUEL' || (typeBudget === 'CAMPAGNE' && campagneCollective));
  if (ouvertureCollective) {
    return (
      <div className="space-y-6">
        {selecteurType}
        <OuvertureBudgetCollectif
          type={typeBudget === 'MENSUEL' ? 'MENSUEL' : 'CAMPAGNE'}
          periodeMois={periodeMois}
          invoices={invoices}
          onOuvert={(id) => router.push(`/budget/demandes/${id}`)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {selecteurType}

      <div className="space-y-2">
        <label>Contexte et motivation de la demande *</label>
        <Textarea
          value={form.contexteMotivation}
          onChange={(e) => setForm((p) => ({ ...p, contexteMotivation: e.target.value }))}
          required
          rows={3}
        />
      </div>

      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-6', sansReceveur && 'hidden')}>
        {!sansReceveur && (
        <div className="space-y-2 min-w-0">
          <label>
            {typeBudget === 'CAMPAGNE'
              ? 'Nom de la campagne *'
              : typeBudget === 'TIERS'
                ? 'Pour le compte de (entreprise ou client) *'
                : 'Pour le compte de RESEAUPUB — receveur *'}
          </label>

          {beneficiaireType === 'CAMPAGNE_CLIENT' ? (
            <Input
              placeholder={typeBudget === 'TIERS' ? "Nom de l'entreprise ou du client" : 'Ex. : Lancement produit Noël'}
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
          {typeBudget === 'CAMPAGNE' && nomCampagneClient.trim() && (
            <p className="text-xs text-muted-foreground break-words">
              Enregistré comme : <span className="font-medium text-foreground">{nomAvecClient(nomCampagneClient, clientProforma)}</span>
              {!clientProforma && ' — le client sera repris de la proforma choisie.'}
            </p>
          )}
        </div>
        )}
        {beneficiaireType === 'CAMPAGNE_CLIENT' && (
          <div className="space-y-2 min-w-0">
            <label>
              {typeBudget === 'CAMPAGNE' ? 'Proforma de la campagne *' : 'Proforma associée (facultatif)'}
            </label>
            <InvoiceCombobox
              invoices={invoices}
              value={proformaIds[0] ?? ''}
              onChange={(id) => {
                setProformaIds(id ? [id] : []);
                // Campagne sans nom encore saisi : on propose l'objet de la proforma.
                const choisie = invoices.find((inv) => inv.id === id);
                if (typeBudget === 'CAMPAGNE' && choisie?.objet && !nomCampagneClient.trim()) setNomCampagneClient(choisie.objet);
              }}
              placeholder={typeBudget === 'CAMPAGNE' ? 'Choisir la proforma de la campagne' : 'Associer une proforma (optionnel)'}
            />
            <p className="text-xs text-muted-foreground">
              Une seule proforma par budget : ses dépenses lui seront imputées et apparaîtront dans sa fiche.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label>Produits / Dépenses *</label>
          <Button type="button" variant="outline" size="sm" onClick={addLigne}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
          </Button>
        </div>
        {/* Grille adaptative (requêtes de conteneur) : une seule rangée quand la place suffit, deux
            colonnes sinon, empilé sur téléphone — jamais de défilement horizontal, le texte passe à la ligne. */}
        <div className="@container rounded-md border">
          <div className={cn('hidden @5xl:grid gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground', GRILLE_LIGNE)}>
            <span>Désignation</span>
            <span>Département *</span>
            <span>Catégorie *</span>
            <span>Moyen de paiement</span>
            <span>Montant (XOF)</span>
            <span title="Date limite propre à cette ligne (facultatif)">Délai</span>
            <span className="w-[76px]" aria-hidden="true" />
          </div>
          <div className="divide-y">
            {lignes.map((ligne, index) => (
              <div key={index} className="space-y-2 p-3">
                <div className={cn('grid grid-cols-1 @xl:grid-cols-2 gap-3 items-start', GRILLE_LIGNE)}>
                  <div className="min-w-0 space-y-1 @xl:col-span-2 @5xl:col-span-1">
                    <span className={LIBELLE_CHAMP}>Désignation</span>
                    <ChampAutoHauteur
                      value={ligne.designation}
                      onChange={(e) => updateLigne(index, 'designation', e.target.value.replace(/\s*\n\s*/g, ' '))}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      placeholder="Ex: Achat de bâches"
                      aria-label="Désignation"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className={LIBELLE_CHAMP}>Département *</span>
                    <Select value={ligne.departementId} onValueChange={(v) => updateLigne(index, 'departementId', v)}>
                      <SelectTrigger className={SELECT_QUI_PASSE_A_LA_LIGNE} aria-label="Département">
                        <SelectValue placeholder={optionsDepartement.length === 0 ? 'Aucun département' : 'Département'} />
                      </SelectTrigger>
                      <SelectContent>
                        {optionsDepartement.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nom}
                            {!d.actif ? ' (désactivé)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className={LIBELLE_CHAMP}>Catégorie *</span>
                    <Select value={ligne.categorie} onValueChange={(v) => updateLigne(index, 'categorie', v)}>
                      <SelectTrigger className={SELECT_QUI_PASSE_A_LA_LIGNE} aria-label="Catégorie"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIE_DEPENSE_VALUES.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORIE_DEPENSE_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className={LIBELLE_CHAMP}>Moyen de paiement</span>
                    <Select
                      value={ligne.modePaiement || MODE_LIGNE_DEFAUT}
                      onValueChange={(v) => updateLigne(index, 'modePaiement', v)}
                    >
                      <SelectTrigger className={SELECT_QUI_PASSE_A_LA_LIGNE} aria-label="Moyen de paiement"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {optionsMoyen.map((m) => (
                          <SelectItem key={m.code} value={m.code}>{m.nom}{!m.actif ? ' (désactivé)' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className={LIBELLE_CHAMP}>Montant (XOF)</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={ligne.montant}
                      onChange={(e) => updateLigne(index, 'montant', e.target.value)}
                      aria-label="Montant (XOF)"
                    />
                    {ligne.precedent && (
                      <p
                        className={cn(
                          'text-[11px] leading-tight',
                          ligne.precedent.realise > ligne.precedent.prevu ? 'text-orange-700' : 'text-muted-foreground'
                        )}
                        title="Budget d'origine : prévu / dépensé réellement"
                      >
                        Précédent : {formatMontant(ligne.precedent.prevu)} prévu, {formatMontant(ligne.precedent.realise)} dépensé
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className={LIBELLE_CHAMP}>Délai (facultatif)</span>
                    <Input
                      type="date"
                      value={ligne.dateLimite}
                      onChange={(e) => updateLigne(index, 'dateLimite', e.target.value)}
                      aria-label="Délai de la ligne"
                      title="Date limite propre à cette ligne (facultatif)"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1 @xl:col-span-2 @5xl:col-span-1 @5xl:w-[76px]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => basculerDetail(index)}
                      className={cn('@5xl:size-9 @5xl:px-0', ligne.detail.trim() ? 'text-indigo-700' : 'text-muted-foreground')}
                      title={ligne.detailOuvert ? 'Masquer le détail' : 'Ajouter un détail à la ligne (facultatif)'}
                      aria-expanded={!!ligne.detailOuvert}
                    >
                      <NotebookPen className="h-4 w-4" />
                      <span className="@5xl:hidden">{ligne.detailOuvert ? 'Masquer le détail' : 'Détail'}</span>
                    </Button>
                    {lignes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLigne(index)}
                        className="text-red-500 hover:text-red-700 @5xl:size-9 @5xl:px-0"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="@5xl:hidden">Supprimer</span>
                      </Button>
                    )}
                  </div>
                </div>
                {ligne.detailOuvert && (
                  <Textarea
                    rows={3}
                    maxLength={2000}
                    value={ligne.detail}
                    onChange={(e) => updateLigne(index, 'detail', e.target.value)}
                    placeholder={`Détail de « ${ligne.designation.trim() || 'cette ligne'} » (facultatif) : quantités, prix unitaires, fournisseur pressenti, justification…`}
                    aria-label="Détail de la ligne"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-lg font-bold">Total : {formatMontant(total)}</div>
          {totauxParDepartement.length > 0 && (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {totauxParDepartement.map((t) => (
                <span key={t.id || 'aucun'}>
                  {t.id ? nomDepartement(t.id) : 'Département à choisir'} :{' '}
                  <span className="font-medium text-foreground">{formatMontant(t.montant)}</span>
                </span>
              ))}
            </div>
          )}
          {totauxParMode.length > 1 && (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {totauxParMode.map((t) => (
                <span key={t.mode}>
                  {t.label} : <span className="font-medium text-foreground">{formatMontant(t.demande)}</span>
                </span>
              ))}
            </div>
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
          <p className="text-xs text-muted-foreground">
            Pour l&apos;ensemble du budget. Chaque ligne peut avoir son propre délai (colonne « Délai »).
          </p>
        </div>
      </div>

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
          <label>Documents {initialData ? 'à ajouter' : '(proformas fournisseur, facture, bon de commande...)'}</label>
          <Button type="button" variant="outline" size="sm" onClick={addDocument}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter un document
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Proforma fournisseur (facultatif) : indiquez son fournisseur ; il est ajouté au nom du fichier pour la reprendre
          ensuite dans la liasse du bon de commande.
        </p>
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div key={index} className="space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Select value={doc.type} onValueChange={(v) => updateDocumentType(index, v as DocumentUploadType)}>
                <SelectTrigger className="w-full sm:w-[220px] shrink-0"><SelectValue /></SelectTrigger>
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
            {doc.type === 'DEVIS' && (
              <Input
                placeholder="Fournisseur de cette proforma * (ex. Imprimerie X)"
                value={doc.precision}
                onChange={(e) => updateDocumentPrecision(index, e.target.value)}
              />
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
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? 'Soumission...' : mode === 'edit' ? 'Soumettre à nouveau' : 'Soumettre la demande'}
        </Button>
      </div>
    </form>
  );
}
