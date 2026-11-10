'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { TYPE_BUDGET_META, TypeBudgetValue, typeBudgetLabel } from '@/lib/budgetTypes';
import { BudgetProgressBar } from '@/components/budget/BudgetProgressBar';
import { BudgetDepenseDialog, BudgetDepenseDialogLigne } from '@/components/budget/BudgetDepenseDialog';
import { BudgetJustificatifDialog } from '@/components/budget/BudgetJustificatifDialog';
import { BudgetLigneCommentaires, BudgetCommentaire } from '@/components/budget/BudgetLigneCommentaires';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Wallet, Paperclip, Pencil, Plus, Lock, FileWarning, FileCheck2, MessageSquare } from 'lucide-react';

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
  cashRegister: { id: number; name: string };
  invoice: { id: string; numero: string } | null;
  attachments: { id: string; url: string; fileName: string }[];
}

interface BudgetRole {
  email: string | null;
  canValidateMensuel: boolean;
  canValidate: boolean;
  canPay: boolean;
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
  lignes: { id: string; designation: string; montant: number }[];
  attachments: { id: string; kind: string; url: string; fileName: string; depenseId: string | null }[];
  bonCommande: { id: string; numero: string; fournisseur: { entreprise: string } } | null;
  proformas: { invoice: { id: string; numero: string; objet: string; client: { nom: string } } }[];
  depenses: BudgetDepense[];
  commentaires: BudgetCommentaire[];
}

const MODE_PAIEMENT_LABELS: Record<string, string> = {
  VIREMENT: 'Virement',
  CHEQUE: 'Chèque',
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  AUTRE: 'Autre',
};

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export default function DemandeBudgetDetailPage() {
  const [demande, setDemande] = useState<DemandeBudgetDetail | null>(null);
  const [role, setRole] = useState<BudgetRole>(EMPTY_ROLE);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [depenseLigne, setDepenseLigne] = useState<BudgetDepenseDialogLigne | null>(null);
  const [justificatifDepenseId, setJustificatifDepenseId] = useState<string | null>(null);
  const [isClotureOpen, setIsClotureOpen] = useState(false);
  const [isAddDocsOpen, setIsAddDocsOpen] = useState(false);
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
      toast.success('Demande validée !');
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

  // Suivi prévu / consommé / reste par ligne — le consommé est la somme des dépenses
  // enregistrées (jamais stocké), comme côté serveur.
  const suiviLignes = useMemo(() => {
    if (!demande) return [];
    return demande.lignes.map((l) => {
      const depenses = demande.depenses.filter((d) => d.ligneId === l.id);
      const consomme = depenses.reduce((s, d) => s + Number(d.montant), 0);
      const prevu = Number(l.montant);
      return {
        ...l,
        prevu,
        consomme,
        reste: Math.max(prevu - consomme, 0),
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
  const budgetOuvert = demande.statut === 'VALIDEE' || demande.statut === 'EN_COURS';
  const peutAjouterDocuments = budgetOuvert && (role.isImplique || estDemandeur);

  // Même matrice que lib/budgetAuth.ts (refusValidation) — le serveur reste juge en dernier ressort.
  const requiertAdmin = demande.type === 'MENSUEL' || Number(demande.montantTotal) > role.plafond;
  const peutValider =
    !estDemandeur && (requiertAdmin ? role.canValidateMensuel : role.canValidate || role.canValidateMensuel);
  const valideurAttendu =
    demande.type === 'MENSUEL'
      ? "l'administrateur (budget mensuel)"
      : requiertAdmin
        ? "l'administrateur (montant au-dessus du plafond délégué)"
        : "l'Assistant-Direction ou l'administrateur";

  const peutOuvrirCommentaire = role.canValidateMensuel || role.canPay;
  const peutRepondreCommentaire = role.isImplique || estDemandeur;

  const totalConsomme = suiviLignes.reduce((s, l) => s + l.consomme, 0);
  const nbSansJustificatif = demande.depenses.filter((d) => d.attachments.length === 0).length;
  const lignesParId = new Map(demande.lignes.map((l) => [l.id, l.designation]));
  const documentsDemande = demande.attachments.filter((a) => !a.depenseId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/budget/demandes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Button>
        <DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE'} />
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

      {demande.statut === 'SOUMISE' && role.isImplique && (
        <Card className="border-t-4 border-t-green-500 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Validation requise</CardTitle>
            <p className="text-xs text-muted-foreground">À valider par {valideurAttendu}.</p>
          </CardHeader>
          <CardContent>
            {peutValider ? (
              <div className="flex gap-3">
                <Button onClick={handleValider} disabled={isSubmitting} className="gap-2 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Valider
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

      {['VALIDEE', 'EN_COURS', 'PAYEE'].includes(demande.statut) && (
        <Card className="border-t-4 border-t-indigo-500 shadow-sm">
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Prévu</p>
              <p className="text-lg font-bold">{formatMontant(Number(demande.montantTotal))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Consommé</p>
              <p className="text-lg font-bold">{formatMontant(totalConsomme)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Reste</p>
              <p className="text-lg font-bold">{formatMontant(Math.max(Number(demande.montantTotal) - totalConsomme, 0))}</p>
            </div>
            <div className="space-y-2">
              <BudgetProgressBar consomme={totalConsomme} prevu={Number(demande.montantTotal)} />
              {nbSansJustificatif > 0 && (
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <FileWarning className="h-3.5 w-3.5" /> {nbSansJustificatif} dépense(s) sans justificatif
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
            <p><span className="text-muted-foreground">Mode de paiement :</span> {demande.modePaiement}</p>
            <p><span className="text-muted-foreground">Type de dépense :</span> {demande.typeDepense}</p>
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
                <TableHead className="text-right">Prévu</TableHead>
                <TableHead className="text-right">Consommé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="min-w-[140px]">Suivi</TableHead>
                {budgetOuvert && role.canPay && <TableHead className="text-right pr-6">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suiviLignes.map((l) => (
                <TableRow key={l.id} className="align-top">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-1.5">
                      <span>{l.designation}</span>
                      {l.commentaires.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 gap-1 text-[10px]" title="Ligne commentée">
                          <MessageSquare className="h-3 w-3" /> {l.commentaires.length}
                        </Badge>
                      )}
                    </div>
                    <BudgetLigneCommentaires
                      demandeId={id}
                      ligneId={l.id}
                      commentaires={l.commentaires}
                      peutOuvrir={peutOuvrirCommentaire}
                      peutRepondre={peutRepondreCommentaire}
                      onAdded={fetchDemande}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(l.prevu)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMontant(l.consomme)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap font-medium', l.reste === 0 && l.consomme > 0 && 'text-red-600')}>
                    {formatMontant(l.reste)}
                  </TableCell>
                  <TableCell><BudgetProgressBar consomme={l.consomme} prevu={l.prevu} compact /></TableCell>
                  {budgetOuvert && role.canPay && (
                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={l.reste <= 0}
                        title={l.reste <= 0 ? 'Budget de la ligne atteint' : undefined}
                        onClick={() => setDepenseLigne({ id: l.id, designation: l.designation, reste: l.reste })}
                      >
                        <Wallet className="h-3.5 w-3.5" /> Dépense
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <Separator />
          <div className="flex justify-end p-4 pr-6">
            <div className="bg-indigo-700 text-white rounded-lg px-6 py-3 text-right min-w-[220px]">
              <p className="text-indigo-100 text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-2xl font-bold">{formatMontant(Number(demande.montantTotal))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Justificatif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demande.depenses.map((d) => (
                  <TableRow key={d.id} className="align-top">
                    <TableCell className="pl-6 whitespace-nowrap">{format(new Date(d.dateDepense), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-sm">
                      {lignesParId.get(d.ligneId) ?? '-'}
                      {d.invoice && (
                        <p className="text-xs">
                          <Link href={`/facture/${d.invoice.id}`} className="text-primary hover:underline">
                            Proforma {d.invoice.numero}
                          </Link>
                        </p>
                      )}
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.nomReceveur}
                      <p className="text-xs text-muted-foreground">{MODE_PAIEMENT_LABELS[d.modePaiement] ?? d.modePaiement}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.cashRegister.name}
                      <p className="text-xs text-muted-foreground">Écriture n° {d.cashJournalEntryId}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatMontant(Number(d.montant))}</TableCell>
                    <TableCell>
                      {d.attachments.length > 0 ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                            <FileCheck2 className="h-3 w-3" /> Justifiée
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
                          <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                            <FileWarning className="h-3 w-3" /> Sans justificatif
                          </Badge>
                          {d.motifSansJustificatif && (
                            <p className="text-xs text-muted-foreground">Motif : {d.motifSansJustificatif}</p>
                          )}
                          {role.canPay && (
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
            <Button variant="outline" size="sm" onClick={() => setIsAddDocsOpen(true)} className="gap-2">
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
        onClose={() => setDepenseLigne(null)}
        onSuccess={fetchDemande}
      />

      <BudgetJustificatifDialog
        demandeId={id}
        depenseId={justificatifDepenseId}
        onClose={() => setJustificatifDepenseId(null)}
        onSuccess={fetchDemande}
      />

      <Dialog open={isClotureOpen} onOpenChange={setIsClotureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clôturer le budget ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Plus aucune dépense ne pourra être imputée à ce budget. Le reste non utilisé (
            {formatMontant(Math.max(Number(demande.montantTotal) - totalConsomme, 0))}) sera figé.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClotureOpen(false)}>Annuler</Button>
            <Button onClick={handleCloturer} disabled={isSubmitting}>
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
            <Button variant="destructive" onClick={handleRejeter} disabled={isSubmitting}>
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
