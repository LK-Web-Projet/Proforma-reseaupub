"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  objet: string;
  statut: string;
  totalHT: string;
  tva: string;
  totalTTC: string;
  societeNom: string;
  societeIFU: string;
  societeAdresse?: string;
  client: {
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    ifu?: string;
  };
  produits: Array<{
    id: string;
    designation: string;
    quantite: number;
    prixUnitaire: string;
    duree?: string;
    uniteDuree?: string;
    montantTotal: string;
  }>;
};

export default function FactureDetailPage() {
  const { id } = useParams();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFacture() {
      setLoading(true);
      const res = await fetch(`/api/factures/${id}`);
      const data = await res.json();
      setFacture(data.error ? null : data);
      setLoading(false);
    }
    if (id) fetchFacture();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center h-96">Chargement...</div>;
  if (!facture) return <div className="text-center text-red-500 mt-10">Facture non trouvée.</div>;

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8 my-10">
      {/* En-tête facture */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">Facture Proforma</h1>
          <div className="text-gray-600">N° <span className="font-mono">{facture.numero}</span></div>
          <div className="text-sm text-gray-500">Date : {new Date(facture.dateCreation).toLocaleDateString("fr-FR")}</div>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
            facture.statut === "deliver"
              ? "bg-green-100 text-green-700"
              : facture.statut === "draft"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-200 text-gray-800"
          }`}>
            {facture.statut.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Société & Client */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-semibold text-lg mb-2 text-primary">Émetteur</h2>
          <div className="font-bold">{facture.societeNom}</div>
          <div>IFU : {facture.societeIFU}</div>
          {facture.societeAdresse && <div>Adresse : {facture.societeAdresse}</div>}
        </div>
        <div>
          <h2 className="font-semibold text-lg mb-2 text-primary">Client</h2>
          <div className="font-bold">{facture.client.nom}</div>
          {facture.client.email && <div>Email : {facture.client.email}</div>}
          {facture.client.telephone && <div>Tél : {facture.client.telephone}</div>}
          {facture.client.adresse && <div>Adresse : {facture.client.adresse}</div>}
          {facture.client.ifu && <div>IFU : {facture.client.ifu}</div>}
        </div>
      </div>

      {/* Objet */}
      <div className="mb-6">
        <span className="font-semibold text-primary">Objet :</span> {facture.objet}
      </div>

      {/* Tableau des produits/services */}
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Désignation</th>
              <th className="px-4 py-2 text-center">Qté</th>
              <th className="px-4 py-2 text-right">Prix U.</th>
              <th className="px-4 py-2 text-center">Durée</th>
              <th className="px-4 py-2 text-center">Unité</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {facture.produits.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-2">{p.designation}</td>
                <td className="px-4 py-2 text-center">{p.quantite}</td>
                <td className="px-4 py-2 text-right">{Number(p.prixUnitaire).toLocaleString("fr-FR", { style: "currency", currency: "XOF" })}</td>
                <td className="px-4 py-2 text-center">{p.duree ?? "-"}</td>
                <td className="px-4 py-2 text-center">{p.uniteDuree ?? "-"}</td>
                <td className="px-4 py-2 text-right">{Number(p.montantTotal).toLocaleString("fr-FR", { style: "currency", currency: "XOF" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Bouton PDF */}
      <div className="flex justify-end mb-6">
        <a
          href={`/api/factures/${id}/pdf`}
          target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/80 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Télécharger PDF
              </a>
            </div>
            {/* Tableau des produits/services */}
            <div className="overflow-x-auto mb-8">
              <table className="min-w-full border rounded">
                {/* ...existing table code... */}
              </table>
            </div>
            {/* ...existing code... */}

      {/* Totaux */}
      <div className="flex flex-col items-end gap-2 mb-8">
        <div>Total HT : <span className="font-semibold">{Number(facture.totalHT).toLocaleString("fr-FR", { style: "currency", currency: "XOF" })}</span></div>
        <div>TVA (18%) : <span className="font-semibold">{Number(facture.tva).toLocaleString("fr-FR", { style: "currency", currency: "XOF" })}</span></div>
        <div className="text-xl font-bold text-primary">Total TTC : {Number(facture.totalTTC).toLocaleString("fr-FR", { style: "currency", currency: "XOF" })}</div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pt-4 border-t">
        Facture générée le {new Date(facture.dateCreation).toLocaleDateString("fr-FR")} &mdash; Proforma Générateur
      </div>
    </div>
  );
}