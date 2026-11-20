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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, UserX, UserCheck } from "lucide-react";
import { useDroits } from "@/components/DroitsProvider";

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
  actif?: boolean;
  factures: { invoice: Invoice }[];
  stats: {
    validated: { count: number; total: number };
    sent: { count: number; total: number };
    cancelled: { count: number; total: number };
    payer: { count: number; total: number };
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
  const { peut } = useDroits();
  const [edition, setEdition] = useState<{ nom: string; prenom: string; email: string; telephone: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    if (!edition) return;
    setEnCours(true);
    try {
      const res = await fetch(`/api/gestionnaires/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edition),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Erreur lors de l'enregistrement.");
      setGestionnaire((prev) => (prev ? { ...prev, ...data } : prev));
      setEdition(null);
      toast.success("Commercial mis à jour.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const basculerActif = async () => {
    if (!gestionnaire) return;
    const actif = gestionnaire.actif === false;
    if (!actif && !window.confirm("Désactiver ce commercial ? Il ne sera plus proposé sur les nouvelles proformas ; ses proformas existantes ne changent pas.")) return;
    setEnCours(true);
    try {
      const res = await fetch(`/api/gestionnaires/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Erreur.");
      setGestionnaire((prev) => (prev ? { ...prev, actif: data.actif } : prev));
      toast.success(actif ? "Commercial réactivé." : "Commercial désactivé.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setEnCours(false);
    }
  };

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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2">
            Détails du Gestionnaire
            {gestionnaire.actif === false && <Badge variant="outline" className="font-normal">Inactif</Badge>}
          </CardTitle>
          <div className="flex gap-2">
            {peut("commercial.modifier") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEdition({
                    nom: gestionnaire.nom,
                    prenom: gestionnaire.prenom,
                    email: gestionnaire.email,
                    telephone: gestionnaire.telephone ?? "",
                  })
                }
              >
                <Pencil className="mr-2 h-4 w-4" /> Modifier
              </Button>
            )}
            {peut("commercial.desactiver") && (
              <Button variant="outline" size="sm" onClick={basculerActif} disabled={enCours}>
                {gestionnaire.actif === false ? (
                  <><UserCheck className="mr-2 h-4 w-4" /> Réactiver</>
                ) : (
                  <><UserX className="mr-2 h-4 w-4" /> Désactiver</>
                )}
              </Button>
            )}
          </div>
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
          <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-semibold">Factures Payées</h3>
            <p className="text-2xl">{stats.payer.count}</p>
            <p className="text-gray-500">{stats.payer.total.toFixed(2)} XOF</p>
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
      <Dialog open={!!edition} onOpenChange={(o) => !o && setEdition(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le commercial</DialogTitle>
          </DialogHeader>
          {edition && (
            <div className="grid gap-3">
              {(
                [
                  { cle: "prenom", label: "Prénom" },
                  { cle: "nom", label: "Nom" },
                  { cle: "email", label: "Email" },
                  { cle: "telephone", label: "Téléphone" },
                ] as const
              ).map((c) => (
                <div key={c.cle} className="space-y-1">
                  <Label htmlFor={`g-${c.cle}`}>{c.label}</Label>
                  <Input
                    id={`g-${c.cle}`}
                    type={c.cle === "email" ? "email" : "text"}
                    value={edition[c.cle]}
                    onChange={(e) => setEdition((p) => (p ? { ...p, [c.cle]: e.target.value } : p))}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdition(null)}>Annuler</Button>
            <Button onClick={enregistrer} disabled={enCours}>{enCours ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
