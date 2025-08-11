'use client';

import { useEffect, useState } from 'react';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
} from 'recharts';

type StatData = {
 count: number;
 sum: number;
};

const StatCard = ({ title, value, subValue }: { title: string; value: number; subValue?: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h3 className="text-lg font-semibold text-gray-600">{title}</h3>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
    {subValue && <p className="text-sm text-gray-500">{subValue}</p>}
  </div>
);

export default function StatistiquesPage() {
  const [data, setData] = useState<{
    validatedInvoices: StatData;
    sentInvoices: StatData;
    validatedInvoicesThisMonth: StatData;
    monthlyChartData: Array<{
      month: string;
      Envoyer: number;
      Valider: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/statistiques");
      const data = await res.json();
      setData(data.error ? null : data);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center h-96">Chargement...</div>
    );
  if (!data)
    return (
      <div className="text-center text-red-500 mt-10">
        Erreur lors du chargement des données.
      </div>
    );

  const { validatedInvoices, sentInvoices, validatedInvoicesThisMonth, monthlyChartData } = data;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-10">Statistiques</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Factures Validées (Total)"
          value={validatedInvoices.count}
          subValue={`Total: ${Number(validatedInvoices.sum).toLocaleString(
            "fr-FR"
          )} FCFA`}
        />
        <StatCard
          title="Factures Envoyées (Sans réponse)"
          value={sentInvoices.count}
          subValue={`Total: ${Number(sentInvoices.sum).toLocaleString("fr-FR")} FCFA`}
        />
 
        <StatCard
          title="Factures Validées (Ce mois)"
          value={validatedInvoicesThisMonth.count}
          subValue={`Total: ${Number(
            validatedInvoicesThisMonth.sum
          ).toLocaleString("fr-FR")} FCFA`}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Montant Total par Mois (Envoyé vs Validé)
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Envoyer" stackId="b" fill="#8884d8" />
            <Bar dataKey="Valider" stackId="a" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
