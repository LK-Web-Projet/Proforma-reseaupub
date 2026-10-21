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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FournisseurProduits from "@/components/fournisseurs/FournisseurProduits";
import FournisseurCommandes from "@/components/fournisseurs/FournisseurCommandes";
import { AttachmentPreviewButton } from "@/components/AttachmentPreviewButton";
import { FactureFournisseurModal, FactureFournisseurData } from "@/components/FactureFournisseurModal";
import { FactureFournisseurStatusBadge, StatusDot } from "@/components/FactureFournisseurStatusBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TYPE_FOURNISSEUR_COLORS, resolveTypeFournisseur } from "@/lib/typeFournisseur";

interface FournisseurDetails extends Fournisseur {
  factures: FactureFournisseur[];
}

export default function FournisseurDetailsPage() {
  const [fournisseur, setFournisseur] = useState<FournisseurDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatutFactureFournisseur | null>(null);
  const [editingFacture, setEditingFacture] = useState<FactureFournisseurData | null>(null);
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

  const handleStatusChange = async (factureId: string, newStatus: StatutFactureFournisseur) => {
    try {
      const response = await fetch(`/api/factures-fournisseurs/${factureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      // Update the state locally
      setFournisseur(prev => {
        if (!prev) return null;
        return {
          ...prev,
          factures: prev.factures.map(f =>
            f.id === factureId ? { ...f, status: newStatus } : f
          )
        };
      });

      toast.success('Statut mis à jour avec succès !');
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut.';
      toast.error(message);
    }
  };

  const paidInvoicesAmount = fournisseur?.factures
    ?.filter(inv => inv.status === 'PAYEE')
    .reduce((sum, inv) => sum + Number(inv.montant), 0) || 0;

  const pendingInvoicesAmount = fournisseur?.factures
    ?.filter(inv => inv.status === 'EN_ATTENTE')
    .reduce((sum, inv) => sum + Number(inv.montant), 0) || 0;

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
      </div>

      <FactureFournisseurModal
        isOpen={!!editingFacture}
        onClose={() => setEditingFacture(null)}
        onSuccess={fetchFournisseurDetails}
        fournisseurs={[fournisseur]}
        onFournisseurCreated={() => {}}
        initialData={editingFacture}
      />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="factures">Factures</TabsTrigger>
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
                    <TableRow key={facture.id} className="hover:bg-muted/30">
                      <TableCell>{facture.reference}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(facture.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(Number(facture.montant))} XOF</TableCell>
                      <TableCell>
                        {isLocked ? (
                          <FactureFournisseurStatusBadge status={facture.status} animate={false} />
                        ) : (
                          <Select value={facture.status} onValueChange={(newStatus: StatutFactureFournisseur) => handleStatusChange(facture.id, newStatus)}>
                            <SelectTrigger className="border-none !bg-transparent p-0 h-auto cursor-pointer">
                              <SelectValue>
                                <FactureFournisseurStatusBadge status={facture.status} />
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EN_ATTENTE">
                                <span className="flex items-center gap-2"><StatusDot status="EN_ATTENTE" animate={false} />En attente</span>
                              </SelectItem>
                              <SelectItem value="PAYEE">
                                <span className="flex items-center gap-2"><StatusDot status="PAYEE" animate={false} />Payée</span>
                              </SelectItem>
                              <SelectItem value="ANNULEE">
                                <span className="flex items-center gap-2"><StatusDot status="ANNULEE" animate={false} />Annulée</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <AttachmentPreviewButton url={facture.pieceJointe} title={`Facture ${facture.reference}`} />
                      </TableCell>
                      <TableCell className="text-center">
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
                      </TableCell>
                    </TableRow>
                  );})
                )}
              </TableBody>
            </Table>
          </div>
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
