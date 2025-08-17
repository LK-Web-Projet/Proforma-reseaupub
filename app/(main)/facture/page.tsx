"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {Eye} from "lucide-react"

function formatDateFR(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatMoney(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  });
}

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [factures, setFactures] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");
  const [objet, setObjet] = useState("");
  const [loading, setLoading] = useState(false);

  // Charger la liste des clients pour le filtre
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // Charger les factures filtrées
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    //params.set("statut", "deliver");
    if (clientId) params.set("clientId", clientId);
    if (dateMin) params.set("dateMin", dateMin);
    if (dateMax) params.set("dateMax", dateMax);
    if (objet) params.set("objet", objet);

    fetch(`/api/factures?${params.toString()}`)
      .then((res) => res.json())
      .then(setFactures)
      .finally(() => setLoading(false));
  }, [clientId, dateMin, dateMax, objet]);


  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Liste des factures délivrées</h1>

      {/* Filtres */}
      <form className="mb-6 flex gap-4 flex-wrap items-end">
        <div>
          <label className="block text-xs mb-1">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className=" rounded px-2 py-1"
            title="Sélectionnez un client"
          >
            <option value="">Tous</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Date min</label>
          <input
            type="date"
            value={dateMin}
            onChange={(e) => setDateMin(e.target.value)}
            className="  rounded px-2 py-1"
            title="Date minimale"
            placeholder="Sélectionnez la date min"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Date max</label>
          <input
            type="date"
            value={dateMax}
            onChange={(e) => setDateMax(e.target.value)}
            className="  rounded px-2 py-1"
            title="Date maximale"
            placeholder="Sélectionnez la date max"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Objet</label>
          <input
            type="text"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder= "Rechercher par objet"
            className="border-2 border-gray-300 w-[300px] rounded-full px-2 py-1"
          />
        </div>
      </form>

      <div className="rounded-md   bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead className="text-center">Gestionnaire</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-center">Voir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : factures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              factures.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell>{formatDateFR(facture.dateCreation)}</TableCell>
                  <TableCell className="font-mono">{facture.numero}</TableCell>
                  <TableCell>{facture.client?.nom || "-"}</TableCell>
                  <TableCell>{facture.objet}</TableCell>
                  <TableCell className="text-center">
                    {facture.gestionnaires?.length > 0
                      ? facture.gestionnaires
                          .map(
                            (g: {
                              gestionnaire: { prenom: string; nom: string };
                            }) =>
                              `${g.gestionnaire.prenom} ${g.gestionnaire.nom}`
                          )
                          .join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(facture.totalTTC, facture.devise)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        facture.statut === "Envoyer"
                          ? "envoyer"
                          : facture.statut === "Valider"
                            ? "valider"
                            : facture.statut === "Payer"
                            ? "payer"
                            : facture.statut === "Annuler"
                          ? "annuler"
                          : facture.statut === "Archiver"
                          ? "archiver"
                          : "default" // Fallback to "default" if no match
                      }
                    >
                      {facture.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/facture/${facture.id}`}
                      className="text-primary font-extrabold hover:text-pink-500/80"
                    >
                      <Eye />
                    </Link>
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
