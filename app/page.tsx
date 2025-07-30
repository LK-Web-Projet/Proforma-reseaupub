"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

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
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Date max</label>
          <input
            type="date"
            value={dateMax}
            onChange={(e) => setDateMax(e.target.value)}
            className="border rounded px-2 py-1"
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

      <div className="overflow-x-auto rounded shadow bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Numéro
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Client
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total TTC
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  Chargement...
                </td>
              </tr>
            ) : factures.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8">
                  Aucune facture trouvée.
                </td>
              </tr>
            ) : (
              factures.map((facture) => (
                <tr key={facture.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDateFR(facture.dateCreation)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono">
                    {facture.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {facture.client?.nom || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">
                    {formatMoney(facture.totalTTC)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        facture.statut === "deliver"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {facture.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <Link
                      href={`/facture/${facture.id}`}
                      className="text-primary underline hover:text-primary/80"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
