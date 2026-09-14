'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DemandeBudgetStatusBadge, DemandeBudgetStatus } from '@/components/DemandeBudgetStatusBadge';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Wallet, Paperclip } from 'lucide-react';

interface DemandeBudgetDetail {
  id: string;
  numero: string;
  statut: DemandeBudgetStatus;
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
  attachments: { id: string; kind: 'DOCUMENT_COMMANDE' | 'PREUVE_PAIEMENT'; url: string; fileName: string }[];
  bonCommande: { id: string; numero: string; fournisseur: { entreprise: string } } | null;
  proformas: { invoice: { id: string; numero: string; objet: string; client: { nom: string } } }[];
}

const formatMontant = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);

export default function DemandeBudgetDetailPage() {
  const [demande, setDemande] = useState<DemandeBudgetDetail | null>(null);
  const [role, setRole] = useState({ isAdmin: false, isComptable: false });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0]);
  const [nomReceveur, setNomReceveur] = useState('');
  const [preuves, setPreuves] = useState<File[]>([]);

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
      if (roleRes.ok) setRole(await roleRes.json());
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

  const handlePayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datePaiement || !nomReceveur.trim()) {
      toast.error('La date de paiement et le nom du receveur sont requis.');
      return;
    }
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('datePaiement', new Date(datePaiement).toISOString());
      data.append('nomReceveur', nomReceveur);
      preuves.forEach((f) => data.append('preuves', f));

      const res = await fetch(`/api/demandes-budget/${id}/payer`, { method: 'POST', body: data });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : 'Erreur lors du traitement du paiement.');
      }
      toast.success('Demande marquée comme payée !');
      await fetchDemande();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Button variant="outline" className="mt-4" onClick={() => router.push('/finance/demandes-budget')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  const documentsCommande = demande.attachments.filter((a) => a.kind === 'DOCUMENT_COMMANDE');
  const preuvesPaiement = demande.attachments.filter((a) => a.kind === 'PREUVE_PAIEMENT');
  const clients = Array.from(new Set(demande.proformas.map((p) => p.invoice.client.nom)));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/finance/demandes-budget')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Button>
        <DemandeBudgetStatusBadge status={demande.statut} animate={demande.statut === 'SOUMISE'} />
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white">
          <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Demande de Budget</p>
          <h1 className="text-3xl font-bold">{demande.numero}</h1>
          <p className="text-indigo-100 text-sm mt-2">
            Soumise le {format(new Date(demande.createdAt), 'dd MMMM yyyy', { locale: fr })} par{' '}
            <span className="text-white font-medium">{demande.requesterName || demande.requesterEmail}</span>
          </p>
        </div>
      </Card>

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
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="pl-6">Désignation</TableHead>
                <TableHead className="text-right pr-6">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demande.lignes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6">{l.designation}</TableCell>
                  <TableCell className="text-right pr-6 font-medium">{formatMontant(Number(l.montant))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex justify-end p-4 pr-6">
            <div className="bg-indigo-700 text-white rounded-lg px-6 py-3 text-right min-w-[220px]">
              <p className="text-indigo-100 text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-2xl font-bold">{formatMontant(Number(demande.montantTotal))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-indigo-700">
            <Paperclip className="h-4 w-4" />
            Pièces jointes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Documents liés à la commande</p>
            {documentsCommande.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun document.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {documentsCommande.map((a) => (
                  <AttachmentPreviewButton key={a.id} url={a.url} title={a.fileName} />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Preuves de paiement</p>
            {preuvesPaiement.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune preuve.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {preuvesPaiement.map((a) => (
                  <AttachmentPreviewButton key={a.id} url={a.url} title={a.fileName} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {demande.statut === 'REJETEE' && demande.rejectionReason && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700"><strong>Motif du rejet :</strong> {demande.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {demande.statut === 'PAYEE' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-sm text-green-800 space-y-1">
            <p><strong>Payée le</strong> {demande.datePaiement ? format(new Date(demande.datePaiement), 'dd/MM/yyyy') : '-'}</p>
            <p><strong>Receveur :</strong> {demande.nomReceveur}</p>
          </CardContent>
        </Card>
      )}

      {demande.statut === 'SOUMISE' && role.isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Validation</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={handleValider} disabled={isSubmitting} className="gap-2 bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4" /> Valider
            </Button>
            <Button variant="outline" onClick={() => setIsRejectOpen(true)} disabled={isSubmitting} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> Rejeter
            </Button>
          </CardContent>
        </Card>
      )}

      {demande.statut === 'VALIDEE' && role.isComptable && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Marquer comme payée</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayer} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <label htmlFor="datePaiement">Date de paiement *</label>
                <Input id="datePaiement" type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="nomReceveur">Nom du receveur *</label>
                <Input id="nomReceveur" value={nomReceveur} onChange={(e) => setNomReceveur(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="preuves">Preuves de paiement</label>
                <Input id="preuves" type="file" multiple onChange={(e) => setPreuves(e.target.files ? Array.from(e.target.files) : [])} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : 'Marquer comme payée'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
