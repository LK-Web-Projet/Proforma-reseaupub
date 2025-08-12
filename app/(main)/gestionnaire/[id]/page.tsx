"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

// Définition des types
interface Client {
  id: string;
  nom: string;
}

interface Invoice {
  id: string;
  numero: string;
  objet: string;
  statut: string;
  totalTTC: number;
  dateCreation: string;
  client: Client;
}

interface GestionnaireDetails {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  factures: { invoice: Invoice }[];
  stats: {
    validated: { count: number; total: number };
    sent: { count: number; total: number };
    cancelled: { count: number; total: number };
    totalInvoices: number;
    totalAmount: number;
  };
}

export default function GestionnaireDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [gestionnaire, setGestionnaire] = useState<GestionnaireDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchGestionnaireDetails = async () => {
      try {
        const res = await fetch(`/api/gestionnaires/${id}`);
        if (!res.ok) {
          throw new Error("Gestionnaire non trouvé");
        }
        const data = await res.json();
        setGestionnaire(data);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchGestionnaireDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Chargement...
      </div>
    );
  }

  if (!gestionnaire) {
    return <div className="text-center mt-10">Gestionnaire non trouvé.</div>;
  }

  const { stats } = gestionnaire;

  return (
    <div className="container mx-auto p-4">
      {/* Informations sur le gestionnaire */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Détails du Gestionnaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>Nom:</strong> {gestionnaire.prenom} {gestionnaire.nom}
          </p>
          <p>
            <strong>Email:</strong> {gestionnaire.email}
          </p>
          {gestionnaire.telephone && (
            <p>
              <strong>Téléphone:</strong> {gestionnaire.telephone}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statistique Gestionnaire</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold">Factures Émises</h3>
            <p className="text-2xl">{stats.totalInvoices}</p>
            <p className="text-gray-500">{stats.totalAmount.toFixed(2)} XOF</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold">Factures Validées</h3>
            <p className="text-2xl">{stats.validated.count}</p>
            <p className="text-gray-500">
              {stats.validated.total.toFixed(2)} XOF
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold">Factures Envoyées</h3>
            <p className="text-2xl">{stats.sent.count}</p>
            <p className="text-gray-500">{stats.sent.total.toFixed(2)} XOF</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold">Factures Annulées</h3>
            <p className="text-2xl">{stats.cancelled.count}</p>
            <p className="text-gray-500">
              {stats.cancelled.total.toFixed(2)} XOF
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liste des factures associées */}
      <Card>
        <CardHeader>
          <CardTitle>Factures Associées</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gestionnaire.factures.length > 0 ? (
                gestionnaire.factures.map(({ invoice }) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/facture/${invoice.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {invoice.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.client.nom}</TableCell>
                    <TableCell>{invoice.objet}</TableCell>
                    <TableCell>{invoice.statut}</TableCell>
                    <TableCell>
                      {new Date(invoice.dateCreation).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(invoice.totalTTC).toFixed(2)} XOF
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Aucune facture associée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
