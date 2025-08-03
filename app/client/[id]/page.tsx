"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type Client = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
};

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  statut: string;
  totalTTC: number;
};

function formatMoney(amount: number) {
  return Number(amount).toLocaleString("fr-FR", {
    style: "currency",
    currency: "XOF",
  });
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingFactures, setLoadingFactures] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchClient() {
      setLoadingClient(true);
      try {
        const res = await fetch(`/api/clients/${id}`);
        if (!res.ok) throw new Error("Client non trouvé");
        const data = await res.json();
        setClient(data);
      } catch (error) {
        console.error(error);
        setClient(null);
      } finally {
        setLoadingClient(false);
      }
    }

    async function fetchFactures() {
      setLoadingFactures(true);
      try {
        const res = await fetch(`/api/factures?clientId=${id}`);
        if (!res.ok) throw new Error("Factures non trouvées");
        const data = await res.json();
        setFactures(data);
      } catch (error) {
        console.error(error);
        setFactures([]);
      } finally {
        setLoadingFactures(false);
      }
    }

    fetchClient();
    fetchFactures();
  }, [id]);

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!client) return;

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });
      if (!res.ok) throw new Error("La mise à jour a échoué");
      toast.success("Client mis à jour avec succès!");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de mettre à jour le client.");
    }
  };

  if (loadingClient) {
    return <div className="text-center p-10">Chargement du client...</div>;
  }

  if (!client) {
    return <div className="text-center text-red-500 p-10">Client non trouvé.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{client.nom}</h1>
        <Button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "Annuler" : "Modifier les informations"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations sur l&apos;entreprise</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nom">Nom</label>
                  <Input
                    id="nom"
                    value={client.nom}
                    onChange={(e) =>
                      setClient({ ...client, nom: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="email">Email</label>
                  <Input
                    id="email"
                    type="email"
                    value={client.email ?? ""}
                    onChange={(e) =>
                      setClient({ ...client, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="telephone">Téléphone</label>
                  <Input
                    id="telephone"
                    value={client.telephone ?? ""}
                    onChange={(e) =>
                      setClient({ ...client, telephone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="adresse">Adresse</label>
                  <Input
                    id="adresse"
                    value={client.adresse ?? ""}
                    onChange={(e) =>
                      setClient({ ...client, adresse: e.target.value })
                    }
                  />
                </div>
                
              </div>
              <Button type="submit">Enregistrer les modifications</Button>
            </form>
          ) : (
            <div className="space-y-2">
              <p>
                <strong>Email:</strong> {client.email || "N/A"}
              </p>
              <p>
                <strong>Téléphone:</strong> {client.telephone || "N/A"}
              </p>
              <p>
                <strong>Adresse:</strong> {client.adresse || "N/A"}
              </p>
              
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factures Associées</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFactures ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Chargement des factures...
                  </TableCell>
                </TableRow>
              ) : factures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Aucune facture pour ce client.
                  </TableCell>
                </TableRow>
              ) : (
                factures.map((facture) => (
                  <TableRow key={facture.id}>
                    <TableCell className="font-mono">
                      {facture.numero}
                    </TableCell>
                    <TableCell>
                      {new Date(facture.dateCreation).toLocaleDateString(
                        "fr-FR"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                          facture.statut === "deliver"
                            ? "bg-green-100 text-green-700"
                            : facture.statut === "draft"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {facture.statut}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(facture.totalTTC)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/facture/${facture.id}`}>
                          Voir la facture
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}