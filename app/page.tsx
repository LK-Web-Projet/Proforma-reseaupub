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

function formatDateFR(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatMoney(amount: number) {
  return Number(amount).toLocaleString("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 2,
  });
}

export default function Home() {
  const [factures, setFactures] = useState<any[]>([]);
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
            className="border rounded px-2 py-1"
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
            className="border rounded px-2 py-1"
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
            className="border rounded px-2 py-1"
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
            placeholder="Rechercher par objet"
            className="border rounded px-2 py-1"
          />
        </div>
      </form>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-center">Action</TableHead>
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
                  <TableCell>
                    {formatDateFR(facture.dateCreation)}
                  </TableCell>
                  <TableCell className="font-mono">{facture.numero}</TableCell>
                  <TableCell>{facture.client?.nom || "-"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(facture.totalTTC)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        facture.statut === "Envoyé"
                        ? "bg-green-100 text-green-700"
                        : facture.statut === "Validé"
                        ? "bg-blue-100 text-blue-700"
                        : facture.statut === "Annulé"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {facture.statut}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/facture/${facture.id}`}
                      className="text-primary underline hover:text-primary/80"
                    >
                      Voir
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
