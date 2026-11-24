'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import Link from 'next/link';
import { LotPaiementDetail } from '@/components/depenses/LotPaiementDetail';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { DemandeBudgetAddDocumentsDialog } from '@/components/DemandeBudgetAddDocumentsDialog';
import { DemandeBudgetStatusBadge, DemandeBudgetStatus } from '@/components/DemandeBudgetStatusBadge';
import { Badge } from '@/components/ui/badge';
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPE_COLORS } from '@/lib/demandeBudgetAttachmentTypes';
import { TYPE_BUDGET_META, TypeBudgetValue, typeBudgetLabel, categorieLabel, modePaiementLabel, totauxParModePaiement, typeValideParAdmin } from '@/lib/budgetTypes';
import { echeanceJustificatif, etatJustificatif } from '@/lib/justificatifs';
import { generateBudgetPdf } from '@/lib/pdf/budgetPdf';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import { BudgetDepenseDialog, BudgetDepenseDialogLigne, type CommandeDeLigne, type FacturePrestataire } from '@/components/budget/BudgetDepenseDialog';
import { etatLiasse, NATURE_DEPENSE_LABELS } from '@/lib/commandeFournisseurLiasse';
import { BudgetRattacherCard, type DepenseARattacher } from '@/components/budget/BudgetRattacherCard';
import { BudgetJustificatifDialog } from '@/components/budget/BudgetJustificatifDialog';
import { BudgetLigneCommentaires, BudgetCommentaire } from '@/components/budget/BudgetLigneCommentaires';
import { BudgetDepassementDialog, BudgetDepassementDialogLigne } from '@/components/budget/BudgetDepassementDialog';
import { BudgetDepassementsCard, BudgetDepassement } from '@/components/budget/BudgetDepassementsCard';
import { BudgetAnnulationDialog, BudgetAnnulationCible } from '@/components/budget/BudgetAnnulationDialog';
import { BudgetHistoriqueCard, BudgetHistoriqueEntry } from '@/components/budget/BudgetHistoriqueCard';
import { BudgetLigneDecisionDialog, BudgetLigneDecisionCible } from '@/components/budget/BudgetLigneDecisionDialog';
import { BudgetLigneCorrectionDialog, BudgetLigneCorrectionCible } from '@/components/budget/BudgetLigneCorrectionDialog';
import { BudgetLigneDetailDialog, type BudgetLigneDetailCible } from '@/components/budget/BudgetLigneDetailDialog';
import { CLASSES_DELAI, etatDelaiLigne, libelleDelai } from '@/lib/budgetDelai';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Wallet, Paperclip, Pencil, Plus, Lock, FileWarning, FileCheck2, MessageSquare, TrendingUp, Undo2, Repeat, Copy, Check, Scale, AlertTriangle, Trash2, Printer, FileSignature, Clock, CalendarClock, NotebookText } from 'lucide-react';
import type { DocumentUploadType } from '@/lib/demandeBudgetAttachmentTypes';
import { useDroits } from '@/components/DroitsProvider';

interface BudgetDepense {
  id: string;
  ligneId: string;
  montant: number;
  dateDepense: string;
  nomReceveur: string;
  modePaiement: string;
  notes: string | null;
  cashJournalEntryId: number;
  sansJustificatif: boolean;
  motifSansJustificatif: string | null;
  createdByEmail: string;
  annuleeAt: string | null;
  annuleeParEmail: string | null;
  motifAnnulation: string | null;
  contreEcritureId: number | null;
  createdAt: string;
  nature: 'NORMALE' | 'AVANCE' | 'SOLDE';
  source: 'MANUEL' | 'PROFORMA' | 'CAMPTRACK';
  referenceExterne: string | null;
  lotPaiement: {
    reference: string;
    referenceOperateur: string | null;
    nbBeneficiaires: number;
    // Lignes telles qu'envoyées par CampTrack (numéro de ligne, bénéficiaire, numéro MoMo, type…).
    detail: { numero?: number | string; beneficiaire: string; numeroMomo?: string; typePaiement?: string; libelle?: string; reference?: string; montant: number }[];
  } | null;
  commande: { id: string; numero: string; fournisseurId: string; documents: { kind: string }[]; factures: { pieceJointe: string | null; status: string }[] } | null;
  cashRegister: { id: number; name: string };
  invoice: { id: string; numero: string } | null;
  attachments: { id: string; url: string; fileName: string }[];
}

interface BudgetRole {
  email: string | null;
  canValidateMensuel: boolean;
  canValidate: boolean;
  canPay: boolean;
  /** Petites dépenses (accueil) : espèces, jusqu'à plafondPetiteDepense. */
  canPetiteDepense?: boolean;
  plafondPetiteDepense?: number;
  isImplique: boolean;
  plafond: number;
}

const EMPTY_ROLE: BudgetRole = { email: null, canValidateMensuel: false, canValidate: false, canPay: false, isImplique: false, plafond: 0 };

interface DemandeBudgetDetail {
  id: string;
  numero: string;
  statut: DemandeBudgetStatus;
  type: TypeBudgetValue;
  periodeMois: string | null;
  clotureeAt: string | null;
  clotureeParEmail: string | null;
  requesterEmail: string;
  requesterName: string | null;
  departement: string | null;
  contexteMotivation: string;
  montantTotal: number;
  modePaiement: string;
  typeDepense: string;
  pourLeCompteDe: string | null;
  dateLimiteSouhaitee: string | null;
  nomReceveur: string | null;
  datePaiement: string | null;
  validatedByEmail: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  lignes: {
    id: string;
    designation: string;
    montant: number; // demandé
    categorie: string | null;
    modePaiement: string | null;
    detail: string | null;
    dateLimite: string | null;
    statutValidation: 'EN_ATTENTE' | 'ACCORDEE' | 'A_CORRIGER' | 'RETIREE';
    montantAccorde: number | null;
    decideParEmail: string | null;
    motifDecision: string | null;
    commandes: (CommandeDeLigne & { fournisseurId: string })[];
  }[];
  attachments: { id: string; kind: string; url: string; fileName: string; depenseId: string | null }[];
  bonCommande: { id: string; numero: string; fournisseur: { entreprise: string } } | null;
  proformas: { invoice: { id: string; numero: string; objet: string; client: { nom: string } } }[];
  depenses: BudgetDepense[];
  commentaires: BudgetCommentaire[];
  depassements: BudgetDepassement[];
  historique: BudgetHistoriqueEntry[];
  depensesARattacher: DepenseARattacher[];
  facturesPrestataires: FacturePrestataire[];
  /** Scan du budget signé exigé pour ce type (Paramètres → Rôles). */
  budgetSigneRequis?: boolean;
}

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export default function DemandeBudgetDetailPage() {
  const { peut } = useDroits();
  const [demande, setDemande] = useState<DemandeBudgetDetail | null>(null);
  const [role, setRole] = useState<BudgetRole>(EMPTY_ROLE);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [depenseLigne, setDepenseLigne] = useState<BudgetDepenseDialogLigne | null>(null);
  const [justificatifDepenseId, setJustificatifDepenseId] = useState<string | null>(null);
  const [depassementLigne, setDepassementLigne] = useState<BudgetDepassementDialogLigne | null>(null);
  const [annulationCible, setAnnulationCible] = useState<BudgetAnnulationCible | null>(null);
  const [decisionLigne, setDecisionLigne] = useState<BudgetLigneDecisionCible | null>(null);
  const [correctionLigne, setCorrectionLigne] = useState<BudgetLigneCorrectionCible | null>(null);
  const [detailLigne, setDetailLigne] = useState<BudgetLigneDetailCible | null>(null);
  const [isClotureOpen, setIsClotureOpen] = useState(false);
  const [isAddDocsOpen, setIsAddDocsOpen] = useState(false);
  const [addDocsType, setAddDocsType] = useState<DocumentUploadType>('DEVIS');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isRejetInfoOpen, setIsRejetInfoOpen] = useState(false);

  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const fetchDemande = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [demandeRes, roleRes] = await Promise.all([
        fetch(`/api/demandes-budget/${id}`),
        fetch('/api/demandes-budget/me-role'),
      ]);
      if (!demandeRes.ok) throw new Error();
      setDemande(await demandeRes.json());
      if (roleRes.ok) setRole({ ...EMPTY_ROLE, ...(await roleRes.json()) });
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger la demande de budget.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDemande();
  }, [fetchDemande]);

  // Notifie clairement l'auteur (et l'admin/comptable) du motif de refus dès l'ouverture
  // de la fiche, plutôt que de le laisser en bas de page — voir aussi le bloc dédié plus
  // haut dans le rendu qui reprend le même motif.
  useEffect(() => {
    if (demande?.statut === 'REJETEE') {
      setIsRejetInfoOpen(true);
    }
  }, [demande?.id, demande?.statut]);

  const handleValider = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${id}/valider`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la validation.');
      }
      toast.success('Toutes les lignes en attente sont accordées.');
      await fetchDemande();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation ligne par ligne : accorder une ligne au montant demandé (sans dialogue).
  const handleAccorderLigne = async (ligneId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${id}/lignes/${ligneId}/decider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'ACCORDER' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la décision.');
      }
      toast.success('Ligne accordée.');
      await fetchDemande();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejeter = async () => {
    if (!motifRejet.trim()) {
      toast.error('Veuillez indiquer un motif de rejet.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${id}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: motifRejet }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors du rejet.');
      }
      toast.success('Demande rejetée.');
      setIsRejectOpen(false);
      await fetchDemande();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloturer = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${id}/cloturer`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors de la clôture.');
      }
      toast.success('Budget clôturé.');
      setIsClotureOpen(false);
      await fetchDemande();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ouvrirAjoutDocuments = (type: DocumentUploadType) => {
    setAddDocsType(type);
    setIsAddDocsOpen(true);
  };

  // Impression du budget pour signature de la DG (procédure de paiement, section 4).
  const handleImprimer = async () => {
    if (!demande) return;
    setIsPrinting(true);
    try {
      const entRes = await fetch('/api/entreprise');
      const ent = entRes.ok ? await entRes.json() : null;
      const pdf = await generateBudgetPdf(
        {
          numero: demande.numero,
          typeLabel: typeBudgetLabel(demande.type),
          periode: demande.type === 'MENSUEL' && demande.periodeMois ? format(new Date(demande.periodeMois), 'MMMM yyyy', { locale: fr }) : null,
          createdAt: new Date(demande.createdAt),
          demandeur: demande.requesterName || demande.requesterEmail,
          departement: demande.departement,
          pourLeCompteDe: demande.pourLeCompteDe,
          contexteMotivation: demande.contexteMotivation,
          proformas: demande.proformas.map((p) => ({ numero: p.invoice.numero, client: p.invoice.client.nom, objet: p.invoice.objet })),
          lignes: demande.lignes.map((l) => ({
            designation: l.designation,
            detail: l.detail,
            delai: l.dateLimite ? format(new Date(l.dateLimite), 'dd/MM/yyyy') : null,
            categorie: categorieLabel(l.categorie),
            modePaiement: modePaiementLabel(l.modePaiement || demande.modePaiement),
            demande: Number(l.montant),
            accorde: l.statutValidation === 'ACCORDEE' ? Number(l.montantAccorde ?? l.montant) : null,
            retiree: l.statutValidation === 'RETIREE',
          })),
          totauxParMode: totauxParModePaiement(demande.lignes, demande.modePaiement),
          preparePar: demande.type === 'CAMPAGNE' ? 'Chef de projet' : 'Demandeur',
        },
        {
          nom: ent?.nom ?? 'Reseaupub',
          adresse: ent?.adresse ?? '',
          telephone: ent?.telephone ?? '',
          emailFinance: ent?.emailFinance ?? '',
          ifu: ent?.ifu ?? '',
        }
      );
      const blob = new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${demande.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de générer le PDF du budget.");
    } finally {
      setIsPrinting(false);
    }
  };

  // Suivi par ligne, même calcul que lib/budgetSuivi.ts (jamais stocké) :
  // plafond = montant accordé + dépassements approuvés ; consommé = dépenses non annulées.
  // Une ligne en attente, à corriger ou retirée n'a pas de plafond (0).
  const suiviLignes = useMemo(() => {
    if (!demande) return [];
    return demande.lignes.map((l) => {
      const consomme = demande.depenses
        .filter((d) => d.ligneId === l.id && !d.annuleeAt)
        .reduce((s, d) => s + Number(d.montant), 0);
      const depassementsLigne = demande.depassements.filter((d) => d.ligneId === l.id);
      const depassementApprouve = depassementsLigne
        .filter((d) => d.statut === 'APPROUVE')
        .reduce((s, d) => s + Number(d.montant), 0);
      const demandeLigne = Number(l.montant);
      const prevu = l.statutValidation === 'ACCORDEE' ? Number(l.montantAccorde ?? l.montant) : 0;
      const plafond = prevu + depassementApprouve;
      return {
        ...l,
        demandeLigne,
        prevu,
        accordeeReduite: l.statutValidation === 'ACCORDEE' && l.montantAccorde !== null && Number(l.montantAccorde) < demandeLigne,
        depassementApprouve,
        plafond,
        consomme,
        reste: Math.max(plafond - consomme, 0),
        depassementEnAttente: depassementsLigne.some((d) => d.statut === 'EN_ATTENTE'),
        commentaires: demande.commentaires.filter((c) => c.ligneId === l.id),
      };
    });
  }, [demande]);

  const proformasOptions = useMemo(
    () => (demande?.proformas ?? []).map((p) => ({ id: p.invoice.id, numero: p.invoice.numero, objet: p.invoice.objet })),
    [demande?.proformas]
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">Demande de budget introuvable.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/budget/demandes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  const clients = Array.from(new Set(demande.proformas.map((p) => p.invoice.client.nom)));
  const estDemandeur = sameEmail(role.email, demande.requesterEmail);
  const enValidation = demande.statut === 'SOUMISE' || demande.statut === 'VALIDATION_PARTIELLE';
  const budgetOuvert = demande.statut === 'VALIDEE' || demande.statut === 'EN_COURS' || demande.statut === 'VALIDATION_PARTIELLE';
  // Documents : aussi pendant la validation (scan du budget signé par la DG, devis complémentaires…).
  const peutAjouterDocuments = (budgetOuvert || enValidation) && (role.isImplique || estDemandeur);

  // Même matrice que lib/budgetAuth.ts (refusValidation) — le serveur reste juge en dernier ressort.
  const requiertAdmin = typeValideParAdmin(demande.type) || Number(demande.montantTotal) > role.plafond;
  const peutValider =
    !estDemandeur && (requiertAdmin ? role.canValidateMensuel : role.canValidate || role.canValidateMensuel);
  const valideurAttendu =
    demande.type === 'MENSUEL'
      ? "l'administrateur (budget mensuel)"
      : demande.type === 'CAMPAGNE'
        ? "l'administrateur (budget de campagne)"
        : requiertAdmin
        ? "l'administrateur (montant au-dessus du plafond délégué)"
        : "l'Assistant-Direction ou l'administrateur";

  // Validation ligne par ligne : qui décide (matrice ci-dessus) et qui corrige (demandeur ou comptable).
  const peutDeciderLignes = enValidation && peutValider;
  const peutCorrigerLignes = enValidation && (estDemandeur || role.canPay);
  const lignesActives = demande.lignes.filter((l) => l.statutValidation !== 'RETIREE');
  const nbLignesEnAttente = lignesActives.filter((l) => l.statutValidation === 'EN_ATTENTE').length;
  const nbLignesACorriger = lignesActives.filter((l) => l.statutValidation === 'A_CORRIGER').length;
  const nbLignesAccordees = lignesActives.filter((l) => l.statutValidation === 'ACCORDEE').length;

  const peutOuvrirCommentaire = role.canValidateMensuel || role.canPay;
  const peutRepondreCommentaire = role.isImplique || estDemandeur;

  const totalConsomme = suiviLignes.reduce((s, l) => s + l.consomme, 0);
  const totalPlafond = suiviLignes.reduce((s, l) => s + l.plafond, 0);
  const totalAccorde = suiviLignes.reduce((s, l) => s + l.prevu, 0);
  const totalDepassements = suiviLignes.reduce((s, l) => s + l.depassementApprouve, 0);
  const nbSansJustificatif = demande.depenses.filter((d) => !d.annuleeAt && d.attachments.length === 0 && d.source !== 'CAMPTRACK').length;
  // Justificatif attendu sous 24 h ouvrées : au-delà, la dépense passe en rouge (lib/justificatifs.ts).
  const maintenant = new Date();
  const etatJustif = (d: BudgetDepense) =>
    etatJustificatif({ createdAt: d.createdAt, annuleeAt: d.annuleeAt, nbJustificatifs: d.attachments.length, source: d.source }, maintenant);
  const nbJustificatifsEnRetard = demande.depenses.filter((d) => etatJustif(d) === 'EN_RETARD').length;
  const totauxParMode = totauxParModePaiement(demande.lignes, demande.modePaiement);

  // Séparation des tâches : qui a validé le budget n'en enregistre pas les dépenses.
  const estValideur = sameEmail(role.email, demande.validatedByEmail);
  // Budget signé : exigé selon le type (Paramètres → Rôles). La DG décide d'abord les lignes, le
  // demandeur joint ensuite le scan ; tant qu'il manque, la validation n'est pas complète et
  // aucune dépense n'est possible (le serveur le refuse aussi).
  const budgetSigneJoint = demande.attachments.some((a) => !a.depenseId && a.kind === 'BUDGET_SIGNE');
  const signatureAttendue = enValidation && !!demande.budgetSigneRequis && !budgetSigneJoint;
  // Comptable, ou accueil (petites dépenses en espèces, plafonnées).
  const peutEnregistrerDepense = budgetOuvert && (role.canPay || !!role.canPetiteDepense) && !estValideur && !signatureAttendue;
  const plafondPetiteDepense = !role.canPay && role.canPetiteDepense ? role.plafondPetiteDepense ?? 0 : null;
  // Dépassement : budget ouvert, ou entièrement consommé mais pas clôturé.
  const peutDemanderDepassement =
    (role.canPay || estDemandeur) &&
    (budgetOuvert || (demande.statut === 'PAYEE' && !demande.clotureeAt && demande.depenses.length > 0));
  const nbDepassementsEnAttente = demande.depassements.filter((d) => d.statut === 'EN_ATTENTE').length;
  const lignesParId = new Map(demande.lignes.map((l) => [l.id, l.designation]));
  // Délais par ligne : alertes seulement tant que le budget peut encore être dépensé.
  const budgetActifPourDelais = !demande.clotureeAt && demande.statut !== 'REJETEE' && demande.statut !== 'PAYEE';
  const statutLigneLibelle = (l: (typeof suiviLignes)[number]) =>
    l.statutValidation === 'ACCORDEE'
      ? l.accordeeReduite ? 'Accordée partiellement' : 'Accordée'
      : l.statutValidation === 'EN_ATTENTE' ? 'En attente' : l.statutValidation === 'A_CORRIGER' ? 'À corriger' : 'Retirée';
  const ouvrirDetailLigne = (l: (typeof suiviLignes)[number]) =>
    setDetailLigne({
      designation: l.designation,
      statutLibelle: statutLigneLibelle(l),
      categorie: categorieLabel(l.categorie),
      modePaiement: modePaiementLabel(l.modePaiement || demande.modePaiement),
      demande: l.demandeLigne,
      accorde: l.statutValidation === 'ACCORDEE' ? l.prevu : null,
      consomme: l.consomme,
      reste: l.reste,
      detail: l.detail,
      dateLimite: l.dateLimite,
      etatDelai: etatDelaiLigne(l, budgetActifPourDelais, maintenant),
      motifDecision: l.motifDecision,
    });
  const documentsDemande = demande.attachments.filter((a) => !a.depenseId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/budget/demandes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Button>
        <div className="flex items-center gap-2">
          {(role.isImplique || estDemandeur) && demande.statut !== 'REJETEE' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push(`/budget/nouvelle-demande?depuis=${id}`)}
              title={demande.type === 'MENSUEL' ? 'Créer le budget du mois suivant à partir de celui-ci' : 'Créer une nouvelle demande à partir de celle-ci'}
            >
              {demande.type === 'MENSUEL' ? <Repeat className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {demande.type === 'MENSUEL' ? 'Reconduire au mois suivant' : 'Dupliquer'}
            </Button>
          )}
          {peut('budget.exporter') && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleImprimer} loading={isPrinting} disabled={isPrinting} title="Imprimer le budget pour signature">
            <Printer className="h-4 w-4" /> {isPrinting ? 'Génération...' : 'Imprimer'}
          </Button>
          )}
          <DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE'} />
        </div>
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Demande de Budget</p>
            <Badge variant="outline" className={cn('font-medium', TYPE_BUDGET_META[demande.type]?.className)}>
              {typeBudgetLabel(demande.type)}
              {demande.type === 'MENSUEL' && demande.periodeMois
                ? ` — ${format(new Date(demande.periodeMois), 'MMMM yyyy', { locale: fr })}`
                : ''}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">{demande.numero}</h1>
          <p className="text-indigo-100 text-sm mt-2">
            Soumise le {format(new Date(demande.createdAt), 'dd MMMM yyyy', { locale: fr })} par{' '}
            <span className="text-white font-medium">{demande.requesterName || demande.requesterEmail}</span>
          </p>
        </div>
      </Card>

      {demande.statut === 'REJETEE' && (
        <Card className="border-t-4 border-t-amber-500 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <XCircle className="h-4 w-4" />
              Demande rejetée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                <strong>Motif du rejet :</strong> {demande.rejectionReason || 'Aucun motif renseigné.'}
              </p>
              {demande.validatedByEmail && (
                <p className="text-xs text-amber-700 mt-1">
                  Par {demande.validatedByEmail}
                  {demande.validatedAt ? ` le ${format(new Date(demande.validatedAt), 'dd MMMM yyyy', { locale: fr })}` : ''}
                </p>
              )}
            </div>
            {(role.canPay || estDemandeur) && (
              <>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez modifier n&apos;importe quel élément de la demande (montants, produits, documents...) pour la rendre conforme, puis la soumettre à nouveau pour validation.
                </p>
                <Button onClick={() => router.push(`/budget/demandes/${id}/modifier`)} className="gap-2 bg-amber-600 hover:bg-amber-700">
                  <Pencil className="h-4 w-4" /> Modifier et soumettre à nouveau
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {peutCorrigerLignes && nbLignesACorriger > 0 && (
        <Card className="border-t-4 border-t-amber-500 shadow-sm">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">{nbLignesACorriger} ligne(s) à corriger</p>
              <p className="text-muted-foreground">
                Le valideur a laissé un commentaire sur chacune. Modifiez-la (elle repartira en validation) ou retirez-la du budget.
                {nbLignesAccordees > 0 && !signatureAttendue ? ' Les lignes déjà accordées sont utilisables dès maintenant.' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {signatureAttendue && nbLignesAccordees > 0 && (role.isImplique || estDemandeur) && (
        <Card className="border-2 border-red-500 bg-red-50 shadow-sm">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <FileSignature className="h-6 w-6 text-red-600 shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-red-800">Budget signé à joindre</p>
              <p className="text-red-900/80">
                {estDemandeur ? 'Imprimez' : 'Le demandeur doit imprimer'} le budget, le faire signer par la Direction générale, puis joindre le scan signé.
                {' '}Tant qu&apos;il manque, le budget reste en « Validation partielle » et <strong>aucune dépense n&apos;est possible</strong>.
                {nbLignesEnAttente + nbLignesACorriger === 0 ? ' Toutes les lignes sont décidées : le budget passera « Validé » dès que le scan sera joint.' : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleImprimer} loading={isPrinting} disabled={isPrinting}>
                <Printer className="h-4 w-4" /> Imprimer
              </Button>
              <Button size="sm" className="gap-2" onClick={() => ouvrirAjoutDocuments('BUDGET_SIGNE')}>
                <Paperclip className="h-4 w-4" /> Joindre le budget signé
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {enValidation && role.isImplique && (
        <Card className="border-t-4 border-t-green-500 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Validation requise</CardTitle>
            <p className="text-xs text-muted-foreground">
              À valider par {valideurAttendu}. Décidez ligne par ligne dans le tableau ci-dessous, ou accordez tout d&apos;un coup.
            </p>
            <p className="text-xs font-medium mt-1">
              {nbLignesAccordees} / {lignesActives.length} ligne(s) accordée(s)
              {nbLignesEnAttente > 0 ? ` · ${nbLignesEnAttente} en attente` : ''}
              {nbLignesACorriger > 0 ? ` · ${nbLignesACorriger} en correction chez le demandeur` : ''}
            </p>
          </CardHeader>
          <CardContent>
            {peutValider ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleValider}
                  loading={isSubmitting} disabled={isSubmitting || nbLignesEnAttente === 0 || nbLignesACorriger > 0}
                  title={nbLignesACorriger > 0 ? 'Des lignes attendent une correction du demandeur' : undefined}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Tout valider
                </Button>
                <Button variant="outline" onClick={() => setIsRejectOpen(true)} disabled={isSubmitting} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Rejeter
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {estDemandeur
                  ? 'Vous ne pouvez pas valider votre propre demande.'
                  : "Cette demande n'est pas de votre niveau de validation."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {['VALIDEE', 'VALIDATION_PARTIELLE', 'EN_COURS', 'PAYEE'].includes(demande.statut) && (
        <Card className="border-t-4 border-t-indigo-500 shadow-sm">
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Accordé</p>
              <p className="text-lg font-bold">{formatMontant(totalAccorde)}</p>
              {totalAccorde < Number(demande.montantTotal) && (
                <p className="text-xs text-muted-foreground">sur {formatMontant(Number(demande.montantTotal))} demandés</p>
              )}
              {totalDepassements > 0 && (
                <p className="text-xs text-orange-700">+ {formatMontant(totalDepassements)} de dépassements approuvés</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Consommé</p>
              <p className="text-lg font-bold">{formatMontant(totalConsomme)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Reste</p>
              <p className="text-lg font-bold">{formatMontant(Math.max(totalPlafond - totalConsomme, 0))}</p>
            </div>
            <div className="space-y-2">
              <BudgetProgressBar consomme={totalConsomme} prevu={totalPlafond} />
              {nbDepassementsEnAttente > 0 && (
                <p className="text-xs text-orange-700 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> {nbDepassementsEnAttente} dépassement(s) en attente
                </p>
              )}
              {estValideur && role.canPay && budgetOuvert && (
                <p className="text-xs text-muted-foreground">Vous avez validé ce budget : ses dépenses sont enregistrées par une autre personne.</p>
              )}
              {nbSansJustificatif > 0 && (
                <p className={cn('text-xs flex items-center gap-1', nbJustificatifsEnRetard > 0 ? 'text-red-600 font-medium' : 'text-amber-700')}>
                  <FileWarning className="h-3.5 w-3.5" /> {nbSansJustificatif} dépense(s) sans justificatif
                  {nbJustificatifsEnRetard > 0 ? `, dont ${nbJustificatifsEnRetard} en retard` : ''}
                </p>
              )}
            </div>
            {budgetOuvert && (role.canPay || role.canValidateMensuel) && (
              <div className="sm:col-span-4 flex justify-end">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsClotureOpen(true)}>
                  <Lock className="h-4 w-4" /> Clôturer le budget
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-indigo-700">Détails de la demande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Département :</span> {demande.departement || '-'}</p>
            <p><span className="text-muted-foreground">Pour le compte de :</span> {demande.pourLeCompteDe || '-'}</p>
            {/* Type de dépense : plus saisi, affiché seulement pour les anciens budgets qui en ont un. */}
            {demande.typeDepense && (
              <p><span className="text-muted-foreground">Type de dépense :</span> {demande.typeDepense}</p>
            )}
            <p><span className="text-muted-foreground">Date limite souhaitée :</span> {demande.dateLimiteSouhaitee ? format(new Date(demande.dateLimiteSouhaitee), 'dd/MM/yyyy') : '-'}</p>
            {clients.length > 0 && <p><span className="text-muted-foreground">Client(s) :</span> {clients.join(', ')}</p>}
            {demande.bonCommande && (
              <p><span className="text-muted-foreground">Bon de commande :</span> {demande.bonCommande.numero} ({demande.bonCommande.fournisseur.entreprise})</p>
            )}
            {demande.proformas.length > 0 && (
              <div>
                <span className="text-muted-foreground">Proforma(s) associée(s) :</span>
                <ul className="list-disc list-inside mt-1">
                  {demande.proformas.map((p) => (
                    <li key={p.invoice.id}>
                      <Link href={`/facture/${p.invoice.id}`} className="text-primary hover:underline">
                        {p.invoice.numero} — {p.invoice.objet}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-indigo-700">Contexte et motivation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{demande.contexteMotivation}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
            <FileText className="h-4 w-4" />
            Produits / Dépenses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="pl-6">Désignation</TableHead>
                <TableHead className="text-right">Demandé</TableHead>
                <TableHead className="text-right">Accordé</TableHead>
                <TableHead className="text-right">Consommé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="min-w-[140px]">Suivi</TableHead>
                {(peutEnregistrerDepense || peutDemanderDepassement || peutDeciderLignes || peutCorrigerLignes) && <TableHead className="text-right pr-6">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suiviLignes.map((l) => (
                <TableRow key={l.id} className={cn('align-top', l.statutValidation === 'RETIREE' && 'opacity-60')}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => ouvrirDetailLigne(l)}
                        className={cn('text-left hover:underline underline-offset-2', l.statutValidation === 'RETIREE' && 'line-through')}
                        title="Voir le détail de la ligne"
                      >
                        {l.designation}
                      </button>
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-5 px-1.5 text-[10px] font-medium',
                          l.statutValidation === 'ACCORDEE' && (l.accordeeReduite ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'),
                          l.statutValidation === 'EN_ATTENTE' && 'bg-slate-50 text-slate-600 border-slate-200',
                          l.statutValidation === 'A_CORRIGER' && 'bg-amber-50 text-amber-800 border-amber-300',
                          l.statutValidation === 'RETIREE' && 'bg-gray-50 text-gray-500 border-gray-200'
                        )}
                      >
                        {l.statutValidation === 'ACCORDEE'
                          ? l.accordeeReduite ? 'Accordée partiellement' : 'Accordée'
                          : l.statutValidation === 'EN_ATTENTE' ? 'En attente' : l.statutValidation === 'A_CORRIGER' ? 'À corriger' : 'Retirée'}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground">
                        {categorieLabel(l.categorie)}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground" title="Moyen de paiement prévu">
                        {modePaiementLabel(l.modePaiement || demande.modePaiement)}
                      </Badge>
                      {l.dateLimite && (() => {
                        const etat = etatDelaiLigne(l, budgetActifPourDelais, maintenant);
                        return etat ? (
                          <Badge
                            variant="outline"
                            className={cn('h-5 px-1.5 gap-1 text-[10px] font-normal', CLASSES_DELAI[etat])}
                            title={etat === 'TERMINE' ? 'Délai de la ligne' : libelleDelai(etat, l.dateLimite, maintenant)}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {format(new Date(l.dateLimite), 'dd/MM/yyyy')}
                            {(etat === 'DEPASSE' || etat === 'PROCHE') && <span className="font-medium">· {libelleDelai(etat, l.dateLimite, maintenant)}</span>}
                          </Badge>
                        ) : null;
                      })()}
                      {l.detail && (
                        <button type="button" onClick={() => ouvrirDetailLigne(l)} title="Voir le détail de la ligne">
                          <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                            <NotebookText className="h-3 w-3" /> Détail
                          </Badge>
                        </button>
                      )}
                      {l.commentaires.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[10px]" title="Ligne commentée">
                          <MessageSquare className="h-3 w-3" /> {l.commentaires.length}
                        </Badge>
                      )}
                    </div>
                    {l.motifDecision && (l.statutValidation === 'A_CORRIGER' || l.accordeeReduite) && (
                      <p className={cn('text-xs mt-1', l.statutValidation === 'A_CORRIGER' ? 'text-amber-800' : 'text-orange-700')}>
                        {l.statutValidation === 'A_CORRIGER' ? 'Correction demandée : ' : 'Réduction : '}
                        {l.motifDecision}
                      </p>
                    )}
                    {l.commandes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {l.commandes.map((c) => {
                          const liasse = etatLiasse(c.documents, c.factures);
                          return (
                            <Link key={c.id} href={`/fournisseur/${c.fournisseurId}/commandes/${c.id}`}>
                              <Badge
                                variant="outline"
                                className={cn('h-5 px-1.5 text-[10px] font-normal hover:bg-muted', liasse.complete ? 'border-green-300 text-green-700' : 'border-amber-300 text-amber-800')}
                                title={liasse.complete ? 'Liasse complète' : `Liasse incomplète : ${liasse.manquantes.join(', ')}`}
                              >
                                {c.numero} · {c.fournisseur.entreprise} · liasse {liasse.nbPieces}/4
                              </Badge>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    <BudgetLigneCommentaires
                      demandeId={id}
                      ligneId={l.id}
                      commentaires={l.commentaires}
                      peutOuvrir={peutOuvrirCommentaire}
                      peutRepondre={peutRepondreCommentaire}
                      onAdded={fetchDemande}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">{formatMontant(l.demandeLigne)}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {l.statutValidation === 'ACCORDEE' ? formatMontant(l.prevu) : <span className="text-muted-foreground">—</span>}
                    {l.depassementApprouve > 0 && (
                      <p className="text-xs font-normal text-orange-700">+ {formatMontant(l.depassementApprouve)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMontant(l.consomme)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap font-medium', l.reste === 0 && l.consomme > 0 && 'text-red-600')}>
                    {formatMontant(l.reste)}
                  </TableCell>
                  <TableCell>
                    <BudgetProgressBar consomme={l.consomme} prevu={l.plafond} compact />
                    {l.depassementEnAttente && <p className="text-[10px] text-orange-700 mt-1">Dépassement en attente</p>}
                  </TableCell>
                  {(peutEnregistrerDepense || peutDemanderDepassement || peutDeciderLignes || peutCorrigerLignes) && (
                    <TableCell className="text-right pr-6">
                      <div className="flex flex-col items-end gap-1">
                        {peutDeciderLignes && l.statutValidation === 'EN_ATTENTE' && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1 bg-green-600 hover:bg-green-700"
                              loading={isSubmitting} disabled={isSubmitting}
                              onClick={() => handleAccorderLigne(l.id)}
                            >
                              <Check className="h-3.5 w-3.5" /> Accorder
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 text-xs" onClick={() => setDecisionLigne({ id: l.id, designation: l.designation, montant: l.demandeLigne, mode: 'AJUSTER' })}>
                              <Scale className="h-3 w-3" /> Ajuster
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 text-xs text-amber-700" onClick={() => setDecisionLigne({ id: l.id, designation: l.designation, montant: l.demandeLigne, mode: 'CORRIGER' })}>
                              <Pencil className="h-3 w-3" /> Demander une correction
                            </Button>
                          </>
                        )}
                        {peutCorrigerLignes && l.statutValidation === 'A_CORRIGER' && (
                          <>
                            <Button size="sm" className="gap-1 bg-amber-600 hover:bg-amber-700" onClick={() => setCorrectionLigne({ id: l.id, designation: l.designation, categorie: l.categorie, modePaiement: l.modePaiement || demande.modePaiement, montant: l.demandeLigne, detail: l.detail, dateLimite: l.dateLimite, motifDecision: l.motifDecision, mode: 'MODIFIER' })}>
                              <Pencil className="h-3.5 w-3.5" /> Modifier la ligne
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 text-xs text-red-600" onClick={() => setCorrectionLigne({ id: l.id, designation: l.designation, categorie: l.categorie, montant: l.demandeLigne, motifDecision: l.motifDecision, mode: 'RETIRER' })}>
                              <Trash2 className="h-3 w-3" /> Retirer du budget
                            </Button>
                          </>
                        )}
                        {/* Budget lié à une proforma : les dépenses se saisissent sur la proforma (un seul chemin). */}
                        {peutEnregistrerDepense && l.statutValidation === 'ACCORDEE' && demande.proformas.length > 0 && (
                          <Button size="sm" variant="outline" className="gap-1" asChild>
                            <Link href={`/facture/${demande.proformas[0].invoice.id}?depense=${l.id}`} title="Les dépenses de cette campagne se saisissent sur sa proforma">
                              <Wallet className="h-3.5 w-3.5" /> Saisir sur la proforma
                            </Link>
                          </Button>
                        )}
                        {peutEnregistrerDepense && l.statutValidation === 'ACCORDEE' && demande.proformas.length === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={l.reste <= 0 || sameEmail(role.email, l.decideParEmail)}
                            title={
                              sameEmail(role.email, l.decideParEmail)
                                ? 'Vous avez accordé cette ligne : une autre personne doit en enregistrer les dépenses'
                                : l.reste <= 0 ? 'Budget de la ligne atteint — demandez un dépassement' : undefined
                            }
                            onClick={() => setDepenseLigne({
                              id: l.id,
                              designation: l.designation,
                              reste: l.reste,
                              modePaiement: l.modePaiement,
                              commandes: l.commandes,
                              facturesPrestataires: (demande.facturesPrestataires ?? []).filter((f) => !f.ligneBudgetId || f.ligneBudgetId === l.id),
                            })}
                          >
                            <Wallet className="h-3.5 w-3.5" /> Dépense
                          </Button>
                        )}
                        {peutDemanderDepassement && l.statutValidation === 'ACCORDEE' && (
                          <Button
                            size="sm"
                            variant={l.reste <= 0 ? 'default' : 'ghost'}
                            className={cn('gap-1', l.reste <= 0 ? 'bg-orange-600 hover:bg-orange-700' : 'text-orange-700 h-7 px-2 text-xs')}
                            disabled={l.depassementEnAttente}
                            title={l.depassementEnAttente ? 'Un dépassement est déjà en attente sur cette ligne' : undefined}
                            onClick={() => setDepassementLigne({ id: l.id, designation: l.designation, plafond: l.plafond, consomme: l.consomme })}
                          >
                            <TrendingUp className="h-3.5 w-3.5" /> Dépassement
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <Separator />
          <div className="flex flex-col sm:flex-row sm:items-end justify-end gap-4 p-4 pr-6">
            {totauxParMode.length > 0 && (
              <div className="text-sm min-w-[260px]">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Prévu par moyen de paiement</p>
                <table className="w-full">
                  <tbody>
                    {totauxParMode.map((t) => (
                      <tr key={t.mode}>
                        <td className="pr-4 py-0.5">{t.label}</td>
                        <td className="text-right py-0.5 whitespace-nowrap">{formatMontant(t.demande)}</td>
                        {nbLignesAccordees > 0 && (
                          <td className="text-right py-0.5 pl-3 whitespace-nowrap text-muted-foreground" title="Accordé">
                            {formatMontant(t.accorde)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bg-indigo-700 text-white rounded-lg px-6 py-3 text-right min-w-[220px]">
              <p className="text-indigo-100 text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-2xl font-bold">{formatMontant(Number(demande.montantTotal))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <BudgetRattacherCard
        demandeId={id}
        depenses={demande.depensesARattacher ?? []}
        lignes={suiviLignes.filter((l) => l.statutValidation === 'ACCORDEE').map((l) => ({ id: l.id, designation: l.designation, reste: l.reste }))}
        peutRattacher={role.canPay && budgetOuvert}
        onSuccess={fetchDemande}
      />

      <BudgetDepassementsCard
        demandeId={id}
        depassements={demande.depassements}
        lignesParId={lignesParId}
        peutDecider={role.canValidateMensuel}
        userEmail={role.email}
        estDemandeurBudget={estDemandeur}
        onChange={fetchDemande}
      />

      {demande.depenses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
              <Wallet className="h-4 w-4" />
              Dépenses enregistrées
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Receveur</TableHead>
                  <TableHead>Caisse</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Justificatif reçu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demande.depenses.map((d) => (
                  <TableRow
                    key={d.id}
                    className={cn(
                      'align-top',
                      d.annuleeAt && 'bg-red-50/40 text-muted-foreground',
                      etatJustif(d) === 'EN_RETARD' && 'bg-red-50 border-l-4 border-l-red-500'
                    )}
                  >
                    <TableCell className="pl-6 whitespace-nowrap">
                      {format(new Date(d.dateDepense), 'dd/MM/yyyy')}
                      {d.annuleeAt && (
                        <div className="mt-1 space-y-0.5">
                          <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
                            <Undo2 className="h-3 w-3" /> Annulée
                          </Badge>
                          <p className="text-[11px] whitespace-normal max-w-[180px]">
                            le {format(new Date(d.annuleeAt), 'dd/MM/yyyy')} par {d.annuleeParEmail}
                            {d.motifAnnulation ? ` — ${d.motifAnnulation}` : ''}
                            {d.contreEcritureId ? ` (contre-écriture n° ${d.contreEcritureId})` : ''}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lignesParId.get(d.ligneId) ?? '-'}
                      {d.commande && (
                        <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                          <Link href={`/fournisseur/${d.commande.fournisseurId}/commandes/${d.commande.id}`} className="text-xs text-primary hover:underline">
                            {NATURE_DEPENSE_LABELS[d.nature]} {d.commande.numero}
                          </Link>
                          {d.nature === 'AVANCE' && !d.annuleeAt && !etatLiasse(d.commande.documents, d.commande.factures).complete && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-red-100 text-red-700 border-red-300">Avance non justifiée</Badge>
                          )}
                        </div>
                      )}
                      {d.invoice && (
                        <p className="text-xs">
                          <Link href={`/facture/${d.invoice.id}`} className="text-primary hover:underline">
                            Proforma {d.invoice.numero}
                          </Link>
                        </p>
                      )}
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                      {d.source !== 'MANUEL' && (
                        <Badge variant="outline" className="mt-0.5 h-5 px-1.5 text-[10px] font-normal">
                          {d.source === 'CAMPTRACK' ? 'Camptrack' : 'Saisie depuis la proforma'}
                        </Badge>
                      )}
                      {d.lotPaiement && <LotPaiementDetail lot={d.lotPaiement} />}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.nomReceveur}
                      <p className="text-xs text-muted-foreground">{modePaiementLabel(d.modePaiement)}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.cashRegister.name}
                      <p className="text-xs text-muted-foreground">Écriture n° {d.cashJournalEntryId}</p>
                    </TableCell>
                    <TableCell className={cn('text-right font-medium whitespace-nowrap', d.annuleeAt && 'line-through')}>
                      {formatMontant(Number(d.montant))}
                      {!d.annuleeAt && role.canValidateMensuel && (
                        <div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-red-600"
                            onClick={() =>
                              setAnnulationCible({
                                id: d.id,
                                designation: lignesParId.get(d.ligneId) ?? 'Dépense',
                                montant: Number(d.montant),
                                caisse: d.cashRegister.name,
                              })
                            }
                          >
                            <Undo2 className="h-3 w-3" /> Annuler
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.attachments.length === 0 && d.source === 'CAMPTRACK' ? (
                        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200" title="États signés et historique des transferts tenus dans Camptrack">
                          <FileCheck2 className="h-3 w-3" /> Oui (Camptrack)
                        </Badge>
                      ) : d.attachments.length > 0 ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                            <FileCheck2 className="h-3 w-3" /> Oui
                          </Badge>
                          {d.attachments.map((a) => (
                            <div key={a.id} className="flex items-center gap-1">
                              <span className="text-xs truncate max-w-[140px]" title={a.fileName}>{a.fileName}</span>
                              <AttachmentPreviewButton url={a.url} title={a.fileName} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {etatJustif(d) === 'EN_RETARD' ? (
                            <Badge variant="outline" className="gap-1 bg-red-100 text-red-700 border-red-300">
                              <FileWarning className="h-3 w-3" /> Non — en retard
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                              <FileWarning className="h-3 w-3" /> Non
                            </Badge>
                          )}
                          {!d.annuleeAt && (
                            <p className={cn('text-xs flex items-center gap-1', etatJustif(d) === 'EN_RETARD' ? 'text-red-600' : 'text-muted-foreground')}>
                              <Clock className="h-3 w-3" />
                              {etatJustif(d) === 'EN_RETARD' ? 'Attendu depuis le ' : 'Attendu avant le '}
                              {format(echeanceJustificatif(d.createdAt), 'dd/MM HH:mm')}
                            </p>
                          )}
                          {d.motifSansJustificatif && (
                            <p className="text-xs text-muted-foreground">Motif : {d.motifSansJustificatif}</p>
                          )}
                          {role.canPay && !d.annuleeAt && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setJustificatifDepenseId(d.id)}>
                              <Plus className="h-3 w-3" /> Ajouter le justificatif
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
            <Paperclip className="h-4 w-4" />
            Documents
          </CardTitle>
          {peutAjouterDocuments && (
            <Button variant="outline" size="sm" onClick={() => ouvrirAjoutDocuments('DEVIS')} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter des documents
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {documentsDemande.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun document fourni.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documentsDemande.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className={cn('text-[10px] font-medium mb-1', ATTACHMENT_TYPE_COLORS[a.kind])}>
                      {ATTACHMENT_TYPE_LABELS[a.kind] ?? a.kind}
                    </Badge>
                    <p className="text-sm truncate" title={a.fileName}>{a.fileName}</p>
                  </div>
                  <AttachmentPreviewButton url={a.url} title={a.fileName} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {demande.statut === 'PAYEE' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-sm text-green-800 space-y-1">
            {demande.clotureeAt ? (
              <p>
                <strong>Budget clôturé le</strong> {format(new Date(demande.clotureeAt), 'dd/MM/yyyy')}
                {demande.clotureeParEmail ? ` par ${demande.clotureeParEmail}` : ''} — le reste non utilisé est figé.
              </p>
            ) : demande.depenses.length > 0 ? (
              <p><strong>Budget entièrement consommé.</strong></p>
            ) : (
              // Demandes payées avant le suivi par dépenses (ancien circuit "Marquer comme payée").
              <>
                <p><strong>Payée le</strong> {demande.datePaiement ? format(new Date(demande.datePaiement), 'dd/MM/yyyy') : '-'}</p>
                <p><strong>Receveur :</strong> {demande.nomReceveur || '-'}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <BudgetDepenseDialog
        demandeId={id}
        ligne={depenseLigne}
        proformas={proformasOptions}
        defaultModePaiement={demande.modePaiement}
        plafondPetiteDepense={plafondPetiteDepense}
        typeBudget={demande.type}
        onClose={() => setDepenseLigne(null)}
        onSuccess={fetchDemande}
      />

      <BudgetJustificatifDialog
        demandeId={id}
        depenseId={justificatifDepenseId}
        onClose={() => setJustificatifDepenseId(null)}
        onSuccess={fetchDemande}
      />

      <BudgetDepassementDialog
        demandeId={id}
        ligne={depassementLigne}
        onClose={() => setDepassementLigne(null)}
        onSuccess={fetchDemande}
      />

      <BudgetAnnulationDialog
        demandeId={id}
        depense={annulationCible}
        onClose={() => setAnnulationCible(null)}
        onSuccess={fetchDemande}
      />

      <BudgetLigneDecisionDialog demandeId={id} ligne={decisionLigne} onClose={() => setDecisionLigne(null)} onSuccess={fetchDemande} />

      <BudgetLigneCorrectionDialog demandeId={id} ligne={correctionLigne} onClose={() => setCorrectionLigne(null)} onSuccess={fetchDemande} />

      <BudgetLigneDetailDialog numeroBudget={demande.numero} ligne={detailLigne} onClose={() => setDetailLigne(null)} />

      <BudgetHistoriqueCard historique={demande.historique} />

      <Dialog open={isClotureOpen} onOpenChange={setIsClotureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clôturer le budget ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Plus aucune dépense ne pourra être imputée à ce budget. Le reste non utilisé (
            {formatMontant(Math.max(totalPlafond - totalConsomme, 0))}) sera figé.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClotureOpen(false)}>Annuler</Button>
            <Button onClick={handleCloturer} loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Clôture...' : 'Confirmer la clôture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
          </DialogHeader>
          <Textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} placeholder="Motif du rejet" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleRejeter} loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Rejet...' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DemandeBudgetAddDocumentsDialog
        isOpen={isAddDocsOpen}
        onClose={() => setIsAddDocsOpen(false)}
        onSuccess={fetchDemande}
        demandeId={id}
        defaultType={addDocsType}
      />

      <Dialog open={isRejetInfoOpen} onOpenChange={setIsRejetInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <XCircle className="h-5 w-5" /> Demande rejetée
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">{demande.rejectionReason || 'Aucun motif renseigné.'}</p>
            {demande.validatedByEmail && (
              <p className="text-xs text-amber-700 mt-1">
                Par {demande.validatedByEmail}
                {demande.validatedAt ? ` le ${format(new Date(demande.validatedAt), 'dd MMMM yyyy', { locale: fr })}` : ''}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejetInfoOpen(false)}>
              Fermer
            </Button>
            {(role.canPay || estDemandeur) && (
              <Button
                onClick={() => router.push(`/budget/demandes/${id}/modifier`)}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Pencil className="h-4 w-4" /> Modifier et soumettre à nouveau
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
