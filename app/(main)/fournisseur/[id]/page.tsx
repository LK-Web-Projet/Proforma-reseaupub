"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Fournisseur } from "@/components/FournisseurModal";
import { FactureFournisseur, StatutFactureFournisseur } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

interface FournisseurDetails extends Fournisseur {
  factures: FactureFournisseur[];
}

export default function FournisseurDetailsPage() {
  const [fournisseur, setFournisseur] = useState<FournisseurDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatutFactureFournisseur | null>(null);
  const params = useParams();
  const id = params.id as string;

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
      toast.error("Erreur lors de la récupération des détails du fournisseur.");
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
        throw new Error('Failed to update status');
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
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  };

  const getStatusVariant = (status: StatutFactureFournisseur) => {
    switch (status) {
      case 'PAYEE': return 'success';
      case 'EN_ATTENTE': return 'brouillon';
      case 'ANNULEE': return 'annuler';
      default: return 'secondary';
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
    return <div>Fournisseur non trouvé.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{fournisseur.entreprise}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card
          onClick={() =>
            setStatusFilter(statusFilter === "PAYEE" ? null : "PAYEE")
          }
          className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === "PAYEE" ? "ring-2 ring-green-500" : ""}`}
        >
          <CardHeader>
            <CardTitle>Factures Payées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("fr-FR").format(paidInvoicesAmount)} XOF
            </p>
          </CardContent>
        </Card>
        <Card
          onClick={() =>
            setStatusFilter(statusFilter === "EN_ATTENTE" ? null : "EN_ATTENTE")
          }
          className={`cursor-pointer transition-all hover:shadow-lg ${statusFilter === "EN_ATTENTE" ? "ring-2 ring-yellow-500" : ""}`}
        >
          <CardHeader>
            <CardTitle>Factures en Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("fr-FR").format(pendingInvoicesAmount)} XOF
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold mb-4">Factures</h2>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(displayedFactures?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              (displayedFactures ?? []).map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell>{facture.reference}</TableCell>
                  <TableCell>
                    {format(new Date(facture.date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("fr-FR").format(
                      Number(facture.montant),
                    )}{" "}
                    XOF
                  </TableCell>
                  <TableCell>
                    <Select
                      value={facture.status}
                      onValueChange={(newStatus: StatutFactureFournisseur) =>
                        handleStatusChange(facture.id, newStatus)
                      }
                    >
                      <SelectTrigger className="border-none bg-transparent! p-0 h-auto">
                        <SelectValue asChild>
                          <Badge
                            variant={getStatusVariant(facture.status)}
                            className="cursor-pointer"
                          >
                            {facture.status.replace("_", " ")}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                        <SelectItem value="PAYEE">Payée</SelectItem>
                        <SelectItem value="ANNULEE">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    {facture.pieceJointe && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={facture.pieceJointe}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Voir PJ
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
