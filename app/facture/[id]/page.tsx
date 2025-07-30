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

  if (loading) return <div>Chargement...</div>;
  if (!facture) return <div>Facture non trouvée.</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Facture n° {facture.numero}</h1>
      <div className="mb-4">
        <div><strong>Date :</strong> {new Date(facture.dateCreation).toLocaleDateString()}</div>
        <div><strong>Statut :</strong> {facture.statut}</div>
        <div><strong>Objet :</strong> {facture.objet}</div>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold">Client</h2>
        <div>Nom : {facture.client.nom}</div>
        {facture.client.email && <div>Email : {facture.client.email}</div>}
        {facture.client.telephone && <div>Téléphone : {facture.client.telephone}</div>}
        {facture.client.adresse && <div>Adresse : {facture.client.adresse}</div>}
        {facture.client.ifu && <div>IFU : {facture.client.ifu}</div>}
      </div>
      <div className="mb-4">
        <h2 className="font-semibold">Produits / Services</h2>
        <table className="w-full border">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Qté</th>
              <th>Prix U.</th>
              <th>Durée</th>
              <th>Unité</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {facture.produits.map((p) => (
              <tr key={p.id}>
                <td>{p.designation}</td>
                <td>{p.quantite}</td>
                <td>{p.prixUnitaire} XOF</td>
                <td>{p.duree ?? "-"}</td>
                <td>{p.uniteDuree ?? "-"}</td>
                <td>{p.montantTotal} XOF</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold">Totaux</h2>
        <div>Total HT : {facture.totalHT} XOF</div>
        <div>TVA : {facture.tva} XOF</div>
        <div className="font-bold">Total TTC : {facture.totalTTC} XOF</div>
      </div>
      <div className="mb-4">
        <h2 className="font-semibold">Société</h2>
        <div>Nom : {facture.societeNom}</div>
        <div>IFU : {facture.societeIFU}</div>
        {facture.societeAdresse && <div>Adresse : {facture.societeAdresse}</div>}
      </div>
    </div>
  );
}