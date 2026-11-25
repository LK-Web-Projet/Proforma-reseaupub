"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Fournisseur } from "@/components/FournisseurModal";
import { FactureFournisseur, StatutFactureFournisseur } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlarmClock, Pencil, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FournisseurProduits from "@/components/fournisseurs/FournisseurProduits";
import FournisseurCommandes from "@/components/fournisseurs/FournisseurCommandes";
import FournisseurDocuments from "@/components/fournisseurs/FournisseurDocuments";
import { AttachmentPreviewButton } from "@/components/AttachmentPreviewButton";
import { PayerFactureDialog } from "@/components/fournisseurs/PayerFactureDialog";
import { FactureFournisseurModal, FactureFournisseurData } from "@/components/FactureFournisseurModal";
import { FactureStatutControl } from "@/components/fournisseurs/FactureStatutControl";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TYPE_FOURNISSEUR_COLORS, resolveTypeFournisseur } from "@/lib/typeFournisseur";
import { PrestataireStatutBadge, PrestataireStatutDot } from "@/components/fournisseurs/PrestataireStatutBadge";
import { PrestataireStatutToggle } from "@/components/fournisseurs/PrestataireStatutToggle";
import { BoutonRetardPaiement, EcheanceFacture, classeLigneRetard } from "@/components/fournisseurs/RetardPaiement";
import type { EtatEcheance } from "@/lib/retardPaiement";
import { useDroits } from "@/components/DroitsProvider";
import { PrestataireDepartementCard, type HistoriqueDepartementEntree } from "@/components/fournisseurs/PrestataireDepartementCard";

interface StatutHistoriqueEntry {
  id: string;
  actif: boolean;
  motif: string | null;
  dateContrat: string | null;
  createdAt: string;
  createdBy: { nom: string } | null;
}

interface FournisseurDetails extends Fournisseur {
  /** echeance : échéance de paiement selon le type du prestataire (null si payée ou annulée). */
  factures: (FactureFournisseur & { echeance?: EtatEcheance | null })[];
  statutHistorique: StatutHistoriqueEntry[];
  posteDepartement: string | null;
  departement: { id: string; nom: string; code: string | null; actif: boolean } | null;
  departementHistorique: HistoriqueDepartementEntree[];
}

export default function FournisseurDetailsPage() {
  // Droits d'action (Paramètres → Rôles) : boutons masqués, vérifiés par le serveur.
  const { peut } = useDroits();

  const [fournisseur, setFournisseur] = useState<FournisseurDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatutFactureFournisseur | null>(null);
  const [editingFacture, setEditingFacture] = useState<FactureFournisseurData | null>(null);
  const [factureAPayer, setFactureAPayer] = useState<string | null>(null);
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const defaultTab = searchParams.get("tab") ?? "factures";

  const fetchFournisseurDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fournisseurs/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch fournisseur details");
      }
      const data = await res.json();
      setFournisseur(data);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des détails du prestataire.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFournisseurDetails();
  }, [fetchFournisseurDetails]);

  const paidInvoicesAmount = fournisseur?.factures
    ?.filter(inv => inv.status === 'PAYEE')
    .reduce((sum, inv) => sum + Number(inv.montant), 0) || 0;

  const pendingInvoicesAmount = fournisseur?.factures
    ?.filter(inv => inv.status === 'EN_ATTENTE')
    .reduce((sum, inv) => sum + Number(inv.montant), 0) || 0;

  const facturesEnRetard = fournisseur?.factures.filter(f => f.echeance?.enRetard) ?? [];

  const displayedFactures = statusFilter
    ? fournisseur?.factures.filter(f => f.status === statusFilter)
    : fournisseur?.factures;

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (!fournisseur) {
    return <div>Prestataire non trouvé.</div>;
  }

  const type = resolveTypeFournisseur(fournisseur.typeFournisseur);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">{fournisseur.entreprise}</h1>
        <Badge variant="outline" className={cn("font-normal", TYPE_FOURNISSEUR_COLORS[type])}>
          {type}
        </Badge>
        <PrestataireStatutBadge actif={fournisseur.actif} />
        <PrestataireStatutToggle
          fournisseurId={id}
          entreprise={fournisseur.entreprise}
          actif={fournisseur.actif}
          onSuccess={fetchFournisseurDetails}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
        <span>Début de contrat : {fournisseur.dateDebutContrat ? format(new Date(fournisseur.dateDebutContrat), "dd/MM/yyyy") : "—"}</span>
        <span>Fin de contrat : {fournisseur.dateFinContrat ? format(new Date(fournisseur.dateFinContrat), "dd/MM/yyyy") : "—"}</span>
      </div>

      <PrestataireDepartementCard prestataire={fournisseur} onChange={fetchFournisseurDetails} />

      <div className="rounded-md border bg-white mb-8">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium text-sm">Historique de statut</h3>
          {fournisseur.statutHistorique.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {fournisseur.statutHistorique.length}
            </Badge>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-4 text-sm">
          {fournisseur.statutHistorique.length === 0 ? (
            <p className="text-muted-foreground">Aucun changement de statut enregistré.</p>
          ) : (
            <ul>
              {fournisseur.statutHistorique.map((h, idx) => (
                <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {idx !== fournisseur.statutHistorique.length - 1 && (
                    <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border" aria-hidden="true" />
                  )}
                  <div className="relative z-10 mt-1 shrink-0">
                    <PrestataireStatutDot actif={h.actif} animate={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{h.actif ? "Marqué actif" : "Marqué inactif"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(h.dateContrat ?? h.createdAt), "dd/MM/yyyy")}
                      </span>
                    </div>
                    {h.motif && <p className="mt-0.5 italic text-muted-foreground">{h.motif}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">par {h.createdBy?.nom ?? "Système"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <PayerFactureDialog
        cible={factureAPayer ? { type: "facture", id: factureAPayer } : null}
        open={!!factureAPayer}
        onClose={() => setFactureAPayer(null)}
        onPaye={fetchFournisseurDetails}
      />
      <FactureFournisseurModal
        isOpen={!!editingFacture}
        onClose={() => setEditingFacture(null)}
        onSuccess={fetchFournisseurDetails}
        fournisseurs={[fournisseur]}
        onFournisseurCreated={() => {}}
        initialData={editingFacture}
      />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="factures">Factures</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue Produits</TabsTrigger>
          <TabsTrigger value="commandes">Bons de Commande</TabsTrigger>
        </TabsList>

        <TabsContent value="factures">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card
              onClick={() => setStatusFilter(statusFilter === 'PAYEE' ? null : 'PAYEE')}
              className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === 'PAYEE' ? 'ring-2 ring-green-500' : ''}`}
            >
              <CardHeader>
                <CardTitle>Factures Payées</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{new Intl.NumberFormat('fr-FR').format(paidInvoicesAmount)} XOF</p>
              </CardContent>
            </Card>
            <Card
              onClick={() => setStatusFilter(statusFilter === 'EN_ATTENTE' ? null : 'EN_ATTENTE')}
              className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === 'EN_ATTENTE' ? 'ring-2 ring-yellow-500' : ''}`}
            >
              <CardHeader>
                <CardTitle>Factures en Attente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{new Intl.NumberFormat('fr-FR').format(pendingInvoicesAmount)} XOF</p>
              </CardContent>
            </Card>
          </div>

          {facturesEnRetard.length > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white animate-pulse">
                <AlarmClock className="h-4 w-4" />
              </span>
              <span>
                <strong>{facturesEnRetard.length} facture(s) en retard de paiement</strong> —{" "}
                {new Intl.NumberFormat("fr-FR").format(facturesEnRetard.reduce((s, f) => s + Number(f.montant), 0))} XOF.
                Délai pour un « {type} » : {facturesEnRetard[0].echeance?.delai} jours après la date de la facture.
              </span>
            </div>
          )}

          <h2 className="text-xl font-bold mb-4">Historique des Factures</h2>
          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Pièce jointe</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!displayedFactures || displayedFactures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      Aucune facture trouvée.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedFactures.map((facture) => {
                    const isLocked = facture.status === 'PAYEE' || facture.status === 'ANNULEE';
                    return (
                    <TableRow key={facture.id} className={facture.echeance?.enRetard ? classeLigneRetard(facture.echeance) : "hover:bg-muted/30"}>
                      <TableCell>{facture.reference}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(facture.date), "dd/MM/yyyy")}
                        <EcheanceFacture echeance={facture.echeance} />
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(Number(facture.montant))} XOF</TableCell>
                      <TableCell>
                        <FactureStatutControl
                          facture={{
                            id: facture.id,
                            reference: facture.reference,
                            status: facture.status,
                            commandeId: facture.commandeId,
                            ligneBudgetId: facture.ligneBudgetId,
                            paiementManuelDate: facture.paiementManuelDate ? String(facture.paiementManuelDate) : null,
                            paiementManuelMode: facture.paiementManuelMode,
                          }}
                          onChange={fetchFournisseurDetails}
                        />
                      </TableCell>
                      <TableCell>
                        <AttachmentPreviewButton url={facture.pieceJointe} title={`Facture ${facture.reference}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                        {!peut("canPayBudget") ? null : facture.echeance?.enRetard ? (
                          <BoutonRetardPaiement echeance={facture.echeance} onClick={() => setFactureAPayer(facture.id)} />
                        ) : facture.status === "EN_ATTENTE" && (
                          <Button size="sm" className="h-8 gap-1" onClick={() => setFactureAPayer(facture.id)}>
                            <Wallet className="h-3.5 w-3.5" /> Appliquer le paiement
                          </Button>
                        )}
                        {(isLocked || peut("fournisseurs.factureModifier")) && (
<TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setEditingFacture({
                                    id: facture.id,
                                    reference: facture.reference,
                                    montant: Number(facture.montant),
                                    date: facture.date as unknown as string,
                                    fournisseurId: facture.fournisseurId,
                                    status: facture.status,
                                    pieceJointe: facture.pieceJointe,
                                  })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isLocked ? 'Voir la facture' : 'Modifier la facture'}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );})
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <FournisseurDocuments fournisseurId={id} />
        </TabsContent>

        <TabsContent value="catalogue">
          <FournisseurProduits fournisseurId={id} />
        </TabsContent>

        <TabsContent value="commandes">
          <FournisseurCommandes fournisseurId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
