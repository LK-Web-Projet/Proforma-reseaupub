/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
    FileText, Receipt, Upload, Trash2, PlusCircle, 
    Send, Download, Mail, Phone, MapPin, 
    User, Briefcase, Calendar, ShieldCheck,
    TrendingUp, TrendingDown, Clock, Ban,
    History, Landmark, CheckCircle2, ChevronLeft,
    AlertCircle, ExternalLink, Calculator, DollarSign,
    Edit3, Save, X, Info, Package, Wallet, CheckSquare, Archive, Percent, LucideIcon,
    Megaphone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProduitCombobox } from "@/components/ProduitCombobox";
import { ProduitModal } from "@/components/ProduitModal";
import { DEVISE_OPTIONS, STATUT_FACTURE_OPTIONS, UNITE_DUREE_OPTIONS, DISCOUNT_TYPE_OPTIONS, StatutFacture, UniteDuree, Devise } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BudgetDepenseDialog, type BudgetDepenseDialogLigne, type CommandeDeLigne, type FacturePrestataire } from "@/components/budget/BudgetDepenseDialog";
import { ChoixLigneBudgetDialog, type BudgetDepenseOption } from "@/components/depenses/ChoixLigneBudgetDialog";
import { RentabiliteCampagneCard } from "@/components/proforma/RentabiliteCampagneCard";
import { LotPaiementDetail, type LotPaiementResume } from "@/components/depenses/LotPaiementDetail";
import { etatLiasse, partsLignesCommande, payeSurCommande } from "@/lib/commandeFournisseurLiasse";

type Campagne = {
  id: string;
  nom: string;
  numero: string;
  statut: string;
  dateDebut: string;
  dateFin: string;
};

type Paiement = {
  id: string;
  montant: number;
  datePaiement: string;
  methode?: string | null;
  reference?: string | null;
  notes?: string | null;
  type: 'PAIEMENT' | 'DEPENSE';
  /** Dépense reçue de CampTrack sans ligne de budget, sur une campagne qui a un budget. */
  aRattacherBudget?: boolean;
  cashJournalEntry?: {
    attachments: {
      id: string;
      url: string;
      fileName: string;
    }[];
    // Origine de la dépense : la même écriture de caisse porte la dépense de budget et le lot.
    budgetDepense?: {
      id: string;
      nature: string;
      source: string;
      annuleeAt: string | null;
      demandeBudget: { id: string; numero: string };
      ligne: { designation: string };
      commande: { id: string; numero: string; fournisseurId: string } | null;
      factureFournisseur: { reference: string } | null;
      _count: { attachments: number };
    } | null;
    lotPaiement?: LotPaiementResume | null;
  } | null;
};

/** D'où vient une dépense de la proforma : budget (ligne, bon, facture), CampTrack, ou hors budget. */
function OrigineDepense({ p }: { p: Paiement }) {
  if (p.type !== 'DEPENSE') return null;
  const bd = p.cashJournalEntry?.budgetDepense;
  const lot = p.cashJournalEntry?.lotPaiement;
  const pastille = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium';
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {bd ? (
        <a href={`/budget/demandes/${bd.demandeBudget.id}`} className={`${pastille} bg-indigo-50 text-indigo-700 hover:underline`}>
          Budget {bd.demandeBudget.numero} · {bd.ligne.designation}
        </a>
      ) : p.aRattacherBudget ? (
        <span className={`${pastille} bg-orange-100 text-orange-800`}>À rattacher au budget</span>
      ) : (
        <span className={`${pastille} bg-slate-100 text-slate-600`}>Hors budget</span>
      )}
      {bd?.commande && (
        <a href={`/fournisseur/${bd.commande.fournisseurId}/commandes/${bd.commande.id}`} className={`${pastille} bg-blue-50 text-blue-700 hover:underline`}>
          {bd.nature === 'AVANCE' ? 'Avance' : bd.nature === 'SOLDE' ? 'Solde' : 'BC'} {bd.commande.numero}
        </a>
      )}
      {bd?.factureFournisseur && <span className={`${pastille} bg-blue-50 text-blue-700`}>Facture {bd.factureFournisseur.reference}</span>}
      {lot && <span className={`${pastille} bg-emerald-50 text-emerald-700`}>CampTrack · lot {lot.reference} ({lot.nbBeneficiaires} bénéf.)</span>}
      {bd?.annuleeAt && <span className={`${pastille} bg-red-100 text-red-700`}>Annulée</span>}
      {lot && <LotPaiementDetail lot={lot} className="w-full" />}
    </div>
  );
}

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  objet: string;
  statut: StatutFacture;
  totalHT: number;
  tva: number;
  totalTTC: number;
  resteAPayer: number;
  paiements: Paiement[];
  societeNom: string;
  societeIFU: string;
  societeAdresse?: string;
  devise: Devise;
  info?: string | null;
  isTaxExempt?: boolean | null;
  isDiscountEnabled?: boolean | null;
  discountType?: "POURCENTAGE" | "MONTANT" | null;
  discountValue?: number | null;
  discountAmount?: number | null;
  client: {
    id: string;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    ifu?: string;
  };
  produits: Array<{
    id: string;
    produitId: string;
    designation: string;
    quantite: number;
    prixUnitaire: number;
    duree?: number;
    uniteDuree?: UniteDuree;
    montantTotal: number;
    includeduree?: boolean;
  }>;
  gestionnaires: Array<{
    gestionnaireId: string;
    gestionnaire: { prenom: string; nom: string };
  }>;
  bonCommande: { url: string } | null;
  factureNormaliser: { url: string } | null;
  paymentConditionPercentage?: number | null;
};

const computeLineTotal = (p: Partial<Facture["produits"][number]>) => {
  const quantite = Number(p.quantite) || 0;
  const prixUnitaire = Number(p.prixUnitaire) || 0;
  const duree = Number(p.duree) || 1;
  const inclureDuree = p.includeduree ?? false;
  return inclureDuree ? quantite * prixUnitaire * duree : quantite * prixUnitaire;
};

const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    "Brouillon": { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
    "Envoyer": { label: "Envoyée", color: "bg-blue-100 text-blue-700", icon: Mail },
    "Valider": { label: "Validée", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle2 },
    "Payer": { label: "En Paiement", color: "bg-orange-100 text-orange-700", icon: Wallet },
    "Solde": { label: "Soldée", color: "bg-green-100 text-green-700", icon: CheckSquare },
    "Annuler": { label: "Annulée", color: "bg-red-100 text-red-700", icon: Ban },
    "Archiver": { label: "Archivée", color: "bg-gray-100 text-gray-700", icon: Archive },
};

export default function FactureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Facture> & { gestionnaireId?: string | null }>({});

  const [allGestionnaires, setAllGestionnaires] = useState<{id: string, nom: string, prenom: string}[]>([]);
  const [allProduits, setAllProduits] = useState<{id: string, nom: string, prixUnitaire: number, actif: boolean}[]>([]);
  const [isProduitModalOpen, setIsProduitModalOpen] = useState(false);
  const [activeProductRowIndex, setActiveProductRowIndex] = useState<number | null>(null);

  const [bonCommandeFile, setBonCommandeFile] = useState<File | undefined>();
  const [factureNormaliseeFile, setFactureNormaliseeFile] = useState<File | undefined>();
  const [isUploadingBon, setIsUploadingBon] = useState(false);
  const [isUploadingFacture, setIsUploadingFacture] = useState(false);
  const [isDeletingBon, setIsDeletingBon] = useState(false);
  const [isDeletingFacture, setIsDeletingFacture] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fileToDeleteType, setFileToDeleteType] = useState<'bon' | 'facture' | null>(null);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({ montant: 0, methode: 'Virement', datePaiement: new Date().toISOString().split('T')[0], reference: '', notes: '' });
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<'PAIEMENT' | 'DEPENSE'>('PAIEMENT');

  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [selectedPaiementId, setSelectedPaiementId] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<FileList | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const [cashRegisters, setCashRegisters] = useState<{id: number, name: string, view?: boolean}[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [paymentFiles, setPaymentFiles] = useState<FileList | null>(null);
  // Droits : « Saisir au journal de caisse » (dépense d'une campagne sans budget) et « Enregistrer
  // les dépenses de budget » (dépense d'une campagne avec budget, sur une de ses lignes).
  const [peutSaisirCaisse, setPeutSaisirCaisse] = useState(false);
  const [peutPayerBudget, setPeutPayerBudget] = useState(false);
  // Accueil : petites dépenses en espèces, plafonnées (sans le droit comptable).
  const [plafondPetiteDepense, setPlafondPetiteDepense] = useState<number | null>(null);
  const [droitsCharges, setDroitsCharges] = useState(false);
  // Dépense : avec budget → choix de la ligne puis même fenêtre que la fiche budget ; sans budget →
  // sortie directe, bon de commande facultatif.
  const [budgetsDepense, setBudgetsDepense] = useState<BudgetDepenseOption[]>([]);
  const [commandesSansBudget, setCommandesSansBudget] = useState<CommandeDeLigne[]>([]);
  const [facturesPrestataires, setFacturesPrestataires] = useState<FacturePrestataire[]>([]);
  const [choixLigneOuvert, setChoixLigneOuvert] = useState(false);
  const [depenseBudget, setDepenseBudget] = useState<{ demandeId: string; modePaiement: string; ligne: BudgetDepenseDialogLigne } | null>(null);
  const [paiementBc, setPaiementBc] = useState('NORMALE');
  const [ligneBc, setLigneBc] = useState('');
  const [factureBc, setFactureBc] = useState('');

  useEffect(() => {
    fetch('/api/demandes-budget/me-role')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setPeutSaisirCaisse(!!data?.canSaisirCaisse);
        setPeutPayerBudget(!!data?.canPay);
        setPlafondPetiteDepense(!data?.canPay && data?.canPetiteDepense ? Number(data.plafondPetiteDepense) : null);
      })
      .catch(() => { setPeutSaisirCaisse(false); setPeutPayerBudget(false); })
      .finally(() => setDroitsCharges(true));
  }, []);

  // Arrivée depuis la fiche budget (« Saisir sur la proforma ») : ?depense=<ligneId> ouvre
  // directement la saisie sur cette ligne. Une seule fois.
  const depenseDemandeeRef = useRef(false);
  useEffect(() => {
    if (!droitsCharges || depenseDemandeeRef.current || typeof window === 'undefined') return;
    const ligneId = new URLSearchParams(window.location.search).get('depense');
    if (!ligneId) return;
    depenseDemandeeRef.current = true;
    void ouvrirDepense(ligneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droitsCharges]);

  const ouvrirDepense = async (ligneIdVisee?: string) => {
    try {
      const res = await fetch(`/api/factures/${id}/lignes-depense`);
      const data = res.ok ? await res.json() : null;
      if (!data) throw new Error();
      if (data.aBudget) {
        if (!peutPayerBudget && plafondPetiteDepense == null) {
          toast.error("Cette campagne a un budget : ses dépenses sont enregistrées par le comptable (droit « Enregistrer les dépenses de budget »).");
          return;
        }
        setBudgetsDepense(data.budgets);
        setFacturesPrestataires(data.facturesPrestataires ?? []);
        const budgetsListe = data.budgets as BudgetDepenseOption[];
        const budgetVise = ligneIdVisee ? budgetsListe.find((b) => b.lignes.some((l) => l.id === ligneIdVisee)) : undefined;
        const ligneVisee = budgetVise?.lignes.find((l) => l.id === ligneIdVisee);
        if (budgetVise && ligneVisee) {
          setDepenseBudget({
            demandeId: budgetVise.id,
            modePaiement: budgetVise.modePaiement,
            ligne: {
              id: ligneVisee.id,
              designation: `${ligneVisee.designation} (budget ${budgetVise.numero})`,
              reste: ligneVisee.reste,
              modePaiement: ligneVisee.modePaiement,
              commandes: ligneVisee.commandes,
              facturesPrestataires: (data.facturesPrestataires ?? []).filter((f: FacturePrestataire) => !f.ligneBudgetId || f.ligneBudgetId === ligneVisee.id),
            },
          });
          return;
        }
        setChoixLigneOuvert(true);
        return;
      }
      if (!peutSaisirCaisse) {
        toast.error("Proforma sans budget : la dépense directe demande le droit « Saisir au journal de caisse » (Paramètres → Rôles).");
        return;
      }
      setCommandesSansBudget(data.commandesSansBudget ?? []);
      setPaiementBc('NORMALE');
      setLigneBc('');
      setFactureBc('');
      setOperationType("DEPENSE");
      setIsPaymentDialogOpen(true);
    } catch {
      toast.error("Impossible de préparer la dépense.");
    }
  };

  const fetchFacture = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [factureRes, cashRes, gestionnairesRes, produitsRes, campagnesRes] = await Promise.all([
        fetch(`/api/factures/${id}`),
        fetch('/api/cash-journal'),
        fetch('/api/gestionnaires'),
        fetch('/api/produits'),
        fetch(`/api/factures/${id}/campagnes`),
      ]);

      const data = await factureRes.json();
      if (!data.error) {
        setFacture(data);
        setFormData({ ...data, gestionnaireId: data.gestionnaires?.[0]?.gestionnaireId });
      } else {
        setFacture(null);
      }

      const cashData = await cashRes.json();
      const registers = cashData.cashRegisters || [];
      setCashRegisters(registers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const visibleRegisters = registers.filter((r: any) => r.view !== false);
      if (visibleRegisters.length > 0) {
        setSelectedCashRegisterId(visibleRegisters[0].id.toString());
      }

      const gestionnairesData = await gestionnairesRes.json();
      setAllGestionnaires(gestionnairesData.error ? [] : gestionnairesData);

      const produitsData = await produitsRes.json();
      setAllProduits(produitsData.error ? [] : produitsData);

      const campagnesData = await campagnesRes.json();
      setCampagnes(Array.isArray(campagnesData) ? campagnesData : []);

    } catch (error) {
      console.error("Failed to fetch initial data", error);
      toast.error("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFacture();
  }, [fetchFacture]);

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const response = await fetch(`/api/factures/${id}/send-email`, { method: "POST" });
      if (response.ok) toast.success("E-mail envoyé avec succès !");
      else toast.error("Erreur lors de l'envoi de l'e-mail.");
    } catch (error) {
      toast.error("Erreur réseau lors de l'envoi.");
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateFacture = async () => {
    if (!formData) return;
    setIsSaving(true);
    const totalHT = formData.produits?.reduce((acc, p) => acc + computeLineTotal(p), 0) || 0;
    const tva = formData.isTaxExempt ? 0 : totalHT * 0.18;
    const totalTTC = totalHT + tva;
    const updatedData = { ...formData, totalHT, tva, totalTTC, produits: formData.produits?.map(p => ({...p, montantTotal: computeLineTotal(p)})) }

    try {
      const res = await fetch(`/api/factures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        await fetchFacture();
        setIsEditing(false);
        toast.success("Facture mise à jour avec succès !");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Erreur lors de la mise à jour.");
      }
    } catch (error) {
      toast.error("Erreur réseau.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (type: 'bon' | 'facture') => {
    const file = type === 'bon' ? bonCommandeFile : factureNormaliseeFile;
    if (!file) return;
    if (type === 'bon') setIsUploadingBon(true); else setIsUploadingFacture(true);
    const data = new FormData();
    data.append('file', file);
    data.append('type', type);

    try {
      const res = await fetch(`/api/factures/${id}/upload`, { method: 'POST', body: data });
      if (res.ok) {
        toast.success(`${type === 'bon' ? 'Bon de commande' : 'Facture'} uploadé !`);
        await fetchFacture();
      } else toast.error("Échec de l'upload.");
    } catch (error) {
      toast.error("Erreur réseau.");
    } finally {
      if (type === 'bon') setIsUploadingBon(false); else setIsUploadingFacture(false);
    }
  };

  const handleFileDelete = (type: 'bon' | 'facture') => {
    setFileToDeleteType(type);
    setIsDialogOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDeleteType) return;
    const type = fileToDeleteType;
    if (type === 'bon') setIsDeletingBon(true); else setIsDeletingFacture(true);
    setIsDialogOpen(false);
    try {
      const res = await fetch(`/api/factures/${id}/upload?type=${type}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Fichier supprimé !");
        await fetchFacture();
      } else toast.error("Échec de la suppression.");
    } catch (error) {
      toast.error("Erreur réseau.");
    } finally {
      if (type === 'bon') setIsDeletingBon(false); else setIsDeletingFacture(false);
      setFileToDeleteType(null);
    }
  };

  const handleAddProduct = () => {
    const newProduct = { id: `temp-${Date.now()}`, produitId: "", designation: "", quantite: 1, prixUnitaire: 0, duree: 1, uniteDuree: "jour" as UniteDuree, montantTotal: 0, includeduree: false };
    setFormData((prev) => ({ ...prev, produits: [...(prev?.produits || []), newProduct] }));
  };

  const handleRemoveProduct = (index: number) => {
    const newProduits = [...(formData.produits || [])];
    newProduits.splice(index, 1);
    setFormData((prev) => ({ ...prev, produits: newProduits }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (index: number, e: { target: { name: string; value: string; type?: string } }) => {
    const { name, value } = e.target;
    const produits = [...(formData.produits || [])] as Facture["produits"];
    const isNumeric = e.target.type === 'number';
    const updatedProduct = { ...produits[index] };
    // @ts-expect-error - Accès dynamique sécurisé par le type
    updatedProduct[name] = isNumeric ? parseFloat(value) : value;
    produits[index] = updatedProduct as Facture["produits"][number];
    setFormData((prev) => ({ ...prev, produits }));
  };

  const handleProduitSelected = (index: number, produitId: string) => {
    const selected = allProduits.find((p) => p.id === produitId);
    const produits = [...(formData.produits || [])] as Facture["produits"];
    produits[index] = {
      ...produits[index],
      produitId,
      designation: selected?.nom ?? produits[index].designation,
      prixUnitaire: selected?.prixUnitaire ?? produits[index].prixUnitaire,
    };
    setFormData((prev) => ({ ...prev, produits }));
  };

  const handleProduitCreated = (produit: { id: string; nom: string; prixUnitaire: number; actif: boolean }) => {
    setAllProduits((prev) => [...prev, produit]);
    if (activeProductRowIndex !== null) {
      handleProduitSelected(activeProductRowIndex, produit.id);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedPaiementId || !proofFiles || proofFiles.length === 0) return;
    setIsUploadingProof(true);
    const data = new FormData();
    data.append('paiementId', selectedPaiementId);
    Array.from(proofFiles).forEach(f => data.append('files', f));

    try {
      const res = await fetch(`/api/factures/${id}/paiements/upload-proof`, { method: 'POST', body: data });
      if (res.ok) {
        setIsProofDialogOpen(false);
        setProofFiles(null);
        setSelectedPaiementId(null);
        toast.success("Preuve(s) uploadée(s) !");
        await fetchFacture();
      } else {
        toast.error("Échec de l'upload des preuves.");
      }
    } catch (e) { toast.error("Erreur réseau."); }
    finally { setIsUploadingProof(false); }
  };

  const handleSaveOperation = async () => {
    if (!newPayment.montant || newPayment.montant <= 0) { setPaymentError("Montant requis."); return; }
    if (operationType === 'PAIEMENT' && facture && newPayment.montant > facture.resteAPayer) {
      setPaymentError(`Le montant dépasse le reste à payer.`); return;
    }
    setIsAddingPayment(true);
    const data = new FormData();
    const paymentData = { 
        montant: Number(newPayment.montant), 
        methode: newPayment.methode, 
        reference: newPayment.reference, 
        notes: newPayment.notes, 
        datePaiement: new Date(newPayment.datePaiement), 
        cashRegisterId: newPayment.methode === 'Espèces' && operationType === 'PAIEMENT' ? 1 : parseInt(selectedCashRegisterId, 10),
        type: operationType,
        // Campagne sans budget : avance / solde d'un bon de commande lié à la proforma (facultatif).
        ...(operationType === 'DEPENSE' && paiementBc !== 'NORMALE'
          ? {
              commandeId: paiementBc.split('|')[0],
              nature: paiementBc.split('|')[1],
              ligneCommandeId: ligneBc || undefined,
              factureFournisseurId: factureBc || undefined,
            }
          : {}),
    };
    data.append('paymentData', JSON.stringify(paymentData));
    if (paymentFiles) Array.from(paymentFiles).forEach(f => data.append('files', f));

    try {
      const res = await fetch(`/api/factures/${id}/paiements`, { method: 'POST', body: data });
      if (res.ok) {
        setIsPaymentDialogOpen(false);
        setNewPayment({ montant: 0, methode: 'Virement', datePaiement: new Date().toISOString().split('T')[0], reference: '', notes: '' });
        setPaymentFiles(null);
        toast.success("Opération enregistrée !");
        await fetchFacture();
      } else {
        const err = await res.json();
        setPaymentError(err.error || "Erreur.");
      }
    } catch (e) { setPaymentError("Erreur réseau."); }
    finally { setIsAddingPayment(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[600px] space-y-4">
        <TrendingUp className="w-12 h-12 text-primary animate-pulse" />
        <p className="text-muted-foreground animate-pulse font-medium">Chargement de la mission...</p>
    </div>
  );
  if (!facture) return <div className="text-center p-20 font-bold text-red-500">Facture introuvable.</div>;

  const displayDevise = isEditing ? formData.devise : facture.devise;
  const formatMoney = (val: number) => Number(val).toLocaleString("fr-FR", { style: "currency", currency: displayDevise || "XOF", maximumFractionDigits: 0 });
  const status = statusConfig[facture.statut] || { label: facture.statut, color: "bg-gray-100", icon: FileText };

  const currentTotalHT = isEditing ? (formData.produits?.reduce((acc, p) => acc + computeLineTotal(p), 0) || 0) : Number(facture.totalHT);
  const currentIsDiscountEnabled = isEditing ? !!formData.isDiscountEnabled : !!facture.isDiscountEnabled;
  const currentDiscountType = isEditing ? formData.discountType : facture.discountType;
  const currentDiscountValue = isEditing ? Number(formData.discountValue) || 0 : Number(facture.discountValue) || 0;
  const currentDiscountAmount = currentIsDiscountEnabled
    ? Math.min(
        currentDiscountType === "MONTANT" ? currentDiscountValue : currentTotalHT * (currentDiscountValue / 100),
        currentTotalHT
      )
    : 0;
  const currentTotalHTApresRemise = currentTotalHT - currentDiscountAmount;
  const currentTVA = isEditing ? (formData.isTaxExempt ? 0 : currentTotalHTApresRemise * 0.18) : Number(facture.tva);
  const currentTotalTTC = currentTotalHTApresRemise + currentTVA;

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-7xl">
      <ProduitModal
        isOpen={isProduitModalOpen}
        onClose={() => setIsProduitModalOpen(false)}
        onSuccess={handleProduitCreated}
      />
      {/* Top Bar Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-extrabold tracking-tight">Facture {facture.numero}</h1>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                             <Select value={formData.statut} onValueChange={(v: StatutFacture) => setFormData(p => ({...p, statut: v}))}>
                                <SelectTrigger className="h-8 w-32 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STATUT_FACTURE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={formData.devise} onValueChange={(v: Devise) => setFormData(p => ({...p, devise: v}))}>
                                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DEVISE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <Badge className={`${status.color} border-transparent font-bold px-3 py-1`}>
                            <status.icon className="w-3 h-3 mr-2" /> {status.label}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Créée le {new Date(facture.dateCreation).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {!facture.bonCommande && !facture.factureNormaliser && (
                <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "destructive" : "outline"} size="sm" disabled={["Payer", "Solde"].includes(facture.statut)}>
                    {isEditing ? <><X className="w-4 h-4 mr-2" /> Annuler</> : <><Edit3 className="w-4 h-4 mr-2" /> Modifier</>}
                </Button>
            )}
            <Button asChild variant="outline" size="sm">
                <a href={`/api/factures/${id}/pdf`} target="_blank"><Download className="w-4 h-4 mr-2" /> PDF</a>
            </Button>
            <Button onClick={handleSendEmail} disabled={isSending} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSending ? "Envoi..." : <><Send className="w-4 h-4 mr-2" /> Envoyer Email</>}
            </Button>
            {isEditing && (
                <Button onClick={handleUpdateFacture} disabled={isSaving} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" /> {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            {/* Mission Details */}
            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2 text-lg text-primary">
                            <Briefcase className="w-5 h-5" /> Objet de la Mission
                        </CardTitle>
                        {isEditing && (
                             <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Switch checked={formData.isTaxExempt || false} onCheckedChange={(v) => setFormData(p => ({...p, isTaxExempt: v}))} />
                                        <span className="text-xs font-bold uppercase">Exonérer TVA</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Percent className="w-4 h-4 text-muted-foreground" />
                                        <Select
                                            value={String(formData.paymentConditionPercentage ?? 0)}
                                            onValueChange={(v) => setFormData(p => ({...p, paymentConditionPercentage: Number(v)}))}
                                        >
                                            <SelectTrigger className="h-8 w-20 font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                                                    <SelectItem key={v} value={String(v)}>{v}%</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-xs font-bold uppercase">Acompte</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={formData.isDiscountEnabled || false} onCheckedChange={(v) => setFormData(p => ({...p, isDiscountEnabled: v}))} />
                                    <span className="text-xs font-bold uppercase">Remise</span>
                                    {formData.isDiscountEnabled && (
                                        <>
                                            <Select
                                                value={formData.discountType || "POURCENTAGE"}
                                                onValueChange={(v) => setFormData(p => ({...p, discountType: v as "POURCENTAGE" | "MONTANT"}))}
                                            >
                                                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {DISCOUNT_TYPE_OPTIONS.map((o) => (
                                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.discountValue ?? 0}
                                                onChange={(e) => setFormData(p => ({...p, discountValue: Number(e.target.value)}))}
                                                className="h-8 w-24 text-xs"
                                            />
                                        </>
                                    )}
                                </div>
                             </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    {isEditing ? (
                        <div className="space-y-4">
                            <Input value={formData.objet} name="objet" onChange={handleInputChange} className="text-lg font-bold" placeholder="Objet de la facture" />
                            <Textarea value={formData.info || ""} onChange={(e) => setFormData(p => ({...p, info: e.target.value}))} placeholder="Notes additionnelles..." className="min-h-[100px]" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-800 leading-tight">{facture.objet}</h2>
                            {facture.info && (
                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                    <p className="text-sm text-blue-900 whitespace-pre-wrap italic">
                                        <Info className="w-4 h-4 inline mr-2 mb-1" />
                                        {facture.info}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <Package className="w-5 h-5" /> Prestations & Tarification
                    </CardTitle>
                    {isEditing && (
                        <Button onClick={handleAddProduct} variant="outline" size="sm" className="bg-white">
                            <PlusCircle className="w-4 h-4 mr-2" /> Ajouter
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/30">
                            <TableRow>
                                <TableHead className="pl-6 min-w-[260px]">Désignation</TableHead>
                                <TableHead className="text-center w-24">Qté</TableHead>
                                <TableHead className="text-right w-36">Prix Unit.</TableHead>
                                <TableHead className="text-center w-32">Durée</TableHead>
                                <TableHead className="text-right pr-6 w-40">Total</TableHead>
                                {isEditing && <TableHead className="w-10"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(isEditing ? formData.produits : facture.produits)?.map((p, idx) => (
                                <TableRow key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="pl-6 align-top">
                                        {isEditing ? (
                                            <div className="space-y-1">
                                                <ProduitCombobox
                                                    produits={allProduits.filter(ap => ap.actif || ap.id === p.produitId)}
                                                    value={p.produitId}
                                                    onChange={(produitId) => handleProduitSelected(idx, produitId)}
                                                    onAddNew={() => {
                                                        setActiveProductRowIndex(idx);
                                                        setIsProduitModalOpen(true);
                                                    }}
                                                />
                                                <Input name="designation" value={p.designation} onChange={(e) => handleProductChange(idx, e)} placeholder="Désignation (modifiable)" />
                                            </div>
                                        ) : <span className="font-semibold text-slate-700">{p.designation}</span>}
                                    </TableCell>
                                    <TableCell className="text-center align-top">
                                        {isEditing ? <Input type="number" name="quantite" value={p.quantite} onChange={(e) => handleProductChange(idx, e)} className="text-center px-2" /> : p.quantite}
                                    </TableCell>
                                    <TableCell className="text-right align-top">
                                        {isEditing ? <Input type="number" name="prixUnitaire" value={p.prixUnitaire} onChange={(e) => handleProductChange(idx, e)} className="text-right px-2" /> : <span className="font-medium whitespace-nowrap tabular-nums">{formatMoney(p.prixUnitaire)}</span>}
                                    </TableCell>
                                    <TableCell className="text-center align-top">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <div className="flex gap-1">
                                                    <Input type="number" name="duree" value={p.duree || 1} onChange={(e) => handleProductChange(idx, e)} disabled={!p.includeduree} className="text-center h-8 px-1" />
                                                    <Select value={p.uniteDuree} onValueChange={(v: string) => handleProductChange(idx, {target: {name: 'uniteDuree', value: v}})}>
                                                        <SelectTrigger className="h-8 w-20 text-[10px]"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{UNITE_DUREE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Switch checked={p.includeduree || false} onCheckedChange={(v: boolean) => {
                                                        const prods = [...(formData.produits || [])];
                                                        prods[idx] = {...prods[idx], includeduree: v};
                                                        setFormData(prev => ({...prev, produits: prods as Facture["produits"]}));
                                                    }} className="scale-75" />
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Appliquer</span>
                                                </div>
                                            </div>
                                        ) : (p.includeduree ? `${p.duree} ${p.uniteDuree}` : "-")}
                                    </TableCell>
                                    <TableCell className="text-right pr-6 align-top font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                        {isEditing ? formatMoney(computeLineTotal(p)) : formatMoney(p.montantTotal)}
                                    </TableCell>
                                    {isEditing && (
                                        <TableCell className="pr-4 align-top">
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(idx)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Financial History */}
            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <History className="w-5 h-5" /> Historique des Flux
                    </CardTitle>
                    <div className="flex gap-2">
                        {facture.resteAPayer > 0 && (
                            <Button size="sm" onClick={() => { setOperationType("PAIEMENT"); setIsPaymentDialogOpen(true); }}>
                                <PlusCircle className="w-4 h-4 mr-2" /> Paiement
                            </Button>
                        )}
                        {/* Toujours visible, comme avant : les droits sont contrôlés au clic (message clair) et par le serveur. */}
                        <Button size="sm" variant="outline" onClick={() => ouvrirDepense()} disabled={!droitsCharges}>
                            <PlusCircle className="w-4 h-4 mr-2" /> Dépense
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[420px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow className="bg-slate-50/20">
                                    <TableHead className="pl-6">Date</TableHead>
                                    <TableHead>Libellé / Référence</TableHead>
                                    <TableHead className="text-right text-green-600">Encaissement</TableHead>
                                    <TableHead className="text-right text-red-600">Décaissement</TableHead>
                                    <TableHead className="text-center pr-6">Preuves</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {facture.paiements?.length > 0 ? facture.paiements.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.datePaiement).toLocaleDateString("fr-FR")}</TableCell>
                                        <TableCell className="max-w-[220px]">
                                            <div className="flex flex-col">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="font-bold text-slate-700 text-sm truncate block cursor-default">
                                                                {p.reference || (p.type === 'PAIEMENT' ? 'Paiement Client' : 'Dépense liée')}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <p>{p.reference || (p.type === 'PAIEMENT' ? 'Paiement Client' : 'Dépense liée')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <span className="text-[10px] text-muted-foreground uppercase">{p.methode || "-"}</span>
                                                <OrigineDepense p={p} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-green-600 whitespace-nowrap">{p.type === 'PAIEMENT' ? formatMoney(p.montant) : ""}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">{p.type === 'DEPENSE' ? formatMoney(p.montant) : ""}</TableCell>
                                        <TableCell className="text-center pr-6">
                                            <div className="flex items-center justify-center gap-1">
                                                {p.cashJournalEntry?.attachments?.map(att => (
                                                    <Button key={att.id} asChild variant="ghost" size="icon" className="h-8 w-8 text-blue-500">
                                                        <a href={att.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                                                    </Button>
                                                ))}
                                                {(!p.cashJournalEntry?.attachments || p.cashJournalEntry.attachments.length === 0) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                        onClick={() => {
                                                            setSelectedPaiementId(p.id);
                                                            setIsProofDialogOpen(true);
                                                        }}
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">Aucune opération financière enregistrée.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Documents Section moved here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-slate-500">
                            <FileText className="w-4 h-4 text-blue-500" /> Bon de Commande
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {facture.bonCommande ? (
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl group">
                                <a href={`/Upload/Bon/${facture.numero}/${facture.bonCommande.url.split("/").pop()}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white flex items-center gap-2 hover:text-blue-400">
                                    <ExternalLink className="w-3 h-3" /> Visualiser le document
                                </a>
                                <Button variant="ghost" size="icon" onClick={() => handleFileDelete("bon")} className="h-8 w-8 text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Input type="file" onChange={(e) => setBonCommandeFile(e.target.files?.[0])} className="text-[10px] h-9" />
                                <Button onClick={() => handleFileUpload("bon")} disabled={!bonCommandeFile || isUploadingBon} size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                                    {isUploadingBon ? "Envoi..." : <><Upload className="w-3 h-3 mr-2" /> Uploader le bon</>}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-slate-500">
                            <Receipt className="w-4 h-4 text-green-500" /> Facture Normalisée
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {facture.factureNormaliser ? (
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl group">
                                <a href={`/Upload/Facture/${facture.numero}/${facture.factureNormaliser.url.split("/").pop()}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white flex items-center gap-2 hover:text-green-400">
                                    <ExternalLink className="w-3 h-3" /> Visualiser la facture
                                </a>
                                <Button variant="ghost" size="icon" onClick={() => handleFileDelete("facture")} className="h-8 w-8 text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Input type="file" onChange={(e) => setFactureNormaliseeFile(e.target.files?.[0])} className="text-[10px] h-9" />
                                <Button onClick={() => handleFileUpload("facture")} disabled={!factureNormaliseeFile || isUploadingFacture} size="sm" className="w-full bg-green-600 hover:bg-green-700">
                                    {isUploadingFacture ? "Envoi..." : <><Upload className="w-3 h-3 mr-2" /> Uploader la facture</>}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        <div className="space-y-8">
            {/* Client Info Card */}
            <Card className="border-none shadow-md overflow-hidden bg-slate-900 text-slate-100">
                <CardHeader className="pb-4 border-b border-white/10">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <User className="w-4 h-4" /> Client
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div>
                        <h3 className="text-2xl font-black mb-1">{facture.client?.nom}</h3>
                        {/* <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] font-bold">IFU: {facture.societeIFU}</Badge> */}
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <div className="p-2 rounded-lg bg-white/5"><Mail className="w-4 h-4 text-blue-400" /></div>
                            <span className="truncate">{facture.client?.email || "Non renseigné"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <div className="p-2 rounded-lg bg-white/5"><Phone className="w-4 h-4 text-green-400" /></div>
                            <span>{facture.client?.telephone || "Non renseigné"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                            <div className="p-2 rounded-lg bg-white/5"><MapPin className="w-4 h-4 text-red-400" /></div>
                            <span className="text-xs leading-snug">{facture.client?.adresse || "Non renseigné"}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Suivi par</p>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-primary/20 text-primary"><ShieldCheck className="w-4 h-4" /></div>
                            {isEditing ? (
                                <Select value={formData.gestionnaireId || ""} onValueChange={(v) => setFormData(p => ({...p, gestionnaireId: v === "null" ? null : v}))}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{allGestionnaires.map(g => <SelectItem key={g.id} value={g.id}>{g.prenom} {g.nom}</SelectItem>)}</SelectContent>
                                </Select>
                            ) : <span className="font-bold text-sm">{facture.gestionnaires?.[0]?.gestionnaire.prenom} {facture.gestionnaires?.[0]?.gestionnaire.nom || "Non assigné"}</span>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Campagnes liées */}
            <Card className="border-none shadow-md">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg text-primary">
                        <Megaphone className="w-5 h-5" /> Campagne{campagnes.length > 1 ? "s" : ""} liée{campagnes.length > 1 ? "s" : ""}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {campagnes.length > 0 ? (
                        <div className="space-y-3">
                            {campagnes.map((c) => (
                                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-bold text-sm text-slate-800">{c.nom}</p>
                                        <Badge variant="outline" className="text-[10px] font-bold shrink-0">{c.numero}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(c.dateDebut).toLocaleDateString("fr-FR")} → {new Date(c.dateFin).toLocaleDateString("fr-FR")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Aucune campagne liée pour le moment.</p>
                    )}
                </CardContent>
            </Card>

            {/* Rentabilité : toutes les dépenses de la campagne, quelle que soit leur origine. */}
            {!isEditing && <RentabiliteCampagneCard invoiceId={facture.id} version={facture.paiements?.length ?? 0} />}

            {/* Financial Summary */}
            <Card className="border-none shadow-lg bg-primary text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-20 h-20 rotate-12" /></div>
                <CardHeader className="pb-2 border-b border-white/10">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary-foreground/70">Récapitulatif Financier</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    {currentIsDiscountEnabled && currentDiscountAmount > 0 && (
                        <div className="flex justify-between text-sm text-red-200">
                            <span>Remise {currentDiscountType === "POURCENTAGE" ? `(${currentDiscountValue}%)` : ""}</span>
                            <span className="font-mono">− {formatMoney(currentDiscountAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm opacity-80">
                        <span>Total HT</span>
                        <span className="font-mono">
                            {currentIsDiscountEnabled && currentDiscountAmount > 0 && (
                                <span className="line-through opacity-50 mr-2">{formatMoney(currentTotalHT)}</span>
                            )}
                            {formatMoney(currentTotalHTApresRemise)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm opacity-80">
                        <span>TVA (18%)</span>
                        <span className="font-mono">{formatMoney(currentTVA)}</span>
                    </div>
                    {(isEditing ? formData.paymentConditionPercentage : facture.paymentConditionPercentage) ? (
                        <div className="flex justify-between text-xs font-bold text-yellow-200 bg-yellow-900/30 p-2 rounded-lg border border-yellow-700/50">
                            <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Acompte requis ({(isEditing ? formData.paymentConditionPercentage : facture.paymentConditionPercentage)}%)</span>
                            <span className="font-mono">{formatMoney(currentTotalTTC * ((isEditing ? formData.paymentConditionPercentage : facture.paymentConditionPercentage) || 0) / 100)}</span>
                        </div>
                    ) : null}
                    <div className="py-4 border-y border-white/10">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold uppercase opacity-60">Total TTC</span>
                            <span className="text-3xl font-black tracking-tighter">{formatMoney(currentTotalTTC)}</span>
                        </div>
                    </div>
                    <div className={`p-4 rounded-xl flex justify-between items-center ${facture.resteAPayer > 0 ? "bg-orange-500/20 border border-orange-500/50" : "bg-green-500/20 border border-green-500/50"}`}>
                        <div>
                            <p className="text-[10px] font-bold uppercase opacity-80">Reste à payer</p>
                            <p className="text-xl font-black">{formatMoney(facture.resteAPayer)}</p>
                        </div>
                        {facture.resteAPayer > 0 ? <AlertCircle className="w-6 h-6 text-orange-200" /> : <CheckCircle2 className="w-6 h-6 text-green-200" />}
                    </div>
                    <div className="pt-2 flex justify-between items-center text-xs">
                        <span className="opacity-70 italic">Marge nette générée</span>
                        <span className="font-bold">{formatMoney(facture.paiements.filter(p => p.type === 'PAIEMENT').reduce((a, b) => a + Number(b.montant), 0) - facture.paiements.filter(p => p.type === 'DEPENSE').reduce((a, b) => a + Number(b.montant), 0))}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" /> Ajouter des preuves
                </DialogTitle>
                <DialogDescription>Sélectionnez un ou plusieurs fichiers pour justifier cette transaction.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Fichiers (Images, PDF...)</label>
                    <Input type="file" multiple onChange={(e) => setProofFiles(e.target.files)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsProofDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleUploadProof} disabled={isUploadingProof || !proofFiles}>
                    {isUploadingProof ? "Upload..." : "Confirmer l'envoi"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary flex items-center gap-2">
              {operationType === "PAIEMENT" ? <><TrendingUp className="w-6 h-6 text-green-500" /> Nouvel Encaissement</> : <><TrendingDown className="w-6 h-6 text-red-500" /> Nouvelle Dépense</>}
            </DialogTitle>
            <DialogDescription>Enregistrez un mouvement financier lié à la facture {facture.numero}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Montant ({displayDevise})</label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="number" value={newPayment.montant} onChange={(e) => setNewPayment({...newPayment, montant: parseFloat(e.target.value)})} className="pl-9 text-lg font-bold" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Date</label>
                    <Input type="date" value={newPayment.datePaiement} onChange={(e) => setNewPayment({ ...newPayment, datePaiement: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Méthode</label>
                    <Select value={newPayment.methode} onValueChange={(v) => setNewPayment({ ...newPayment, methode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Virement">Virement</SelectItem>
                            <SelectItem value="Espèces">Espèces</SelectItem>
                            <SelectItem value="Chèque">Chèque</SelectItem>
                            <SelectItem value="MobileMoney">Mobile Money</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Caisse de destination</label>
                <Select value={selectedCashRegisterId} onValueChange={setSelectedCashRegisterId}>
                    <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>{cashRegisters.filter(r => r.view !== false).map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Référence / Objet</label>
                {operationType === "DEPENSE" ? (
                    <Input value={newPayment.reference} onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })} placeholder="Ex: Achat consommables..." />
                ) : (
                    <Select value={newPayment.reference} onValueChange={(v) => setNewPayment({ ...newPayment, reference: v })}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Paiement Total">Paiement Total</SelectItem>
                            <SelectItem value="Avance">Avance</SelectItem>
                            <SelectItem value="1ère tranche">1ère tranche</SelectItem>
                            <SelectItem value="2eme Tranche">2eme Tranche</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>
            {operationType === "DEPENSE" && (
                <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
                  Campagne sans budget : sortie directe de la caisse choisie, imputée à cette proforma.
                </p>
            )}
            {operationType === "DEPENSE" && commandesSansBudget.length > 0 && (() => {
                const [cid, nat] = paiementBc === 'NORMALE' ? [null, 'NORMALE'] : paiementBc.split('|');
                const c = commandesSansBudget.find((x) => x.id === cid) ?? null;
                const liasse = c ? etatLiasse(c.documents, c.factures) : null;
                const parts = c ? partsLignesCommande(c) : [];
                return (
                  <div className="space-y-2 rounded-md border p-3">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Bon de commande (facultatif)</label>
                    <Select value={paiementBc} onValueChange={(v) => { setPaiementBc(v); setLigneBc(''); setFactureBc(''); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NORMALE">Aucun (dépense simple)</SelectItem>
                            {commandesSansBudget.map((b) => (
                              <SelectItem key={`${b.id}a`} value={`${b.id}|AVANCE`} disabled={!etatLiasse(b.documents).bcSigne}>Avance — {b.numero} ({b.fournisseur.entreprise})</SelectItem>
                            ))}
                            {commandesSansBudget.map((b) => (
                              <SelectItem key={`${b.id}s`} value={`${b.id}|SOLDE`} disabled={!etatLiasse(b.documents, b.factures).complete}>Solde — {b.numero} ({b.fournisseur.entreprise})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {c && liasse && (
                      <p className="text-xs text-muted-foreground">
                        Reste du bon : {new Intl.NumberFormat('fr-FR').format(Math.round(Number(c.montantNet) - payeSurCommande(c.imputations)))} F · liasse {liasse.nbPieces}/4
                        {!liasse.complete ? ` (manque : ${liasse.manquantes.join(', ')})` : ''}
                      </p>
                    )}
                    {c && (
                      <Select value={ligneBc || '__TOUT__'} onValueChange={(v) => setLigneBc(v === '__TOUT__' ? '' : v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="__TOUT__">Tout le bon (réparti au prorata des lignes)</SelectItem>
                              {parts.map((p) => (
                                <SelectItem key={p.id} value={p.id} disabled={p.reste <= 0.004}>{p.designation} — reste {new Intl.NumberFormat('fr-FR').format(Math.round(Math.max(p.reste, 0)))} F</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    )}
                    {c && nat === 'SOLDE' && (
                      <Select value={factureBc} onValueChange={setFactureBc}>
                          <SelectTrigger><SelectValue placeholder="Facture fournisseur réglée" /></SelectTrigger>
                          <SelectContent>
                              {c.factures.filter((f) => f.status === 'EN_ATTENTE').map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.reference} — {new Intl.NumberFormat('fr-FR').format(Number(f.montant))} F</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    )}
                  </div>
                );
            })()}
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Pièce(s) jointe(s)</label>
                <Input type="file" multiple onChange={(e) => setPaymentFiles(e.target.files)} className="text-[10px]" />
            </div>
          </div>
          {paymentError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {paymentError}</div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveOperation} disabled={isAddingPayment} className={operationType === "PAIEMENT" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {isAddingPayment ? "Enregistrement..." : "Confirmer l'opération"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChoixLigneBudgetDialog
        open={choixLigneOuvert}
        budgets={budgetsDepense}
        onClose={() => setChoixLigneOuvert(false)}
        onChoisir={(b, l) => {
          setChoixLigneOuvert(false);
          setDepenseBudget({
            demandeId: b.id,
            modePaiement: b.modePaiement,
            ligne: {
              id: l.id,
              designation: `${l.designation} (budget ${b.numero})`,
              reste: l.reste,
              modePaiement: l.modePaiement,
              commandes: l.commandes,
              facturesPrestataires: facturesPrestataires.filter((f) => !f.ligneBudgetId || f.ligneBudgetId === l.id),
            },
          });
        }}
      />

      <BudgetDepenseDialog
        demandeId={depenseBudget?.demandeId ?? ''}
        ligne={depenseBudget?.ligne ?? null}
        proformas={[{ id: facture.id, numero: facture.numero, objet: facture.objet }]}
        defaultModePaiement={depenseBudget?.modePaiement ?? 'VIREMENT'}
        depuisProforma
        plafondPetiteDepense={plafondPetiteDepense}
        onClose={() => setDepenseBudget(null)}
        onSuccess={fetchFacture}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-5 h-5" /> Confirmation</DialogTitle>
            <DialogDescription>Cette suppression est définitive. Souhaitez-vous continuer ?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDeleteFile}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-[10px] text-slate-400 text-center font-bold tracking-widest uppercase py-8 opacity-50">
        Propulsé par Proforma Générateur &mdash; Réseaupub © {new Date().getFullYear()}
      </div>
    </div>
  );
}
