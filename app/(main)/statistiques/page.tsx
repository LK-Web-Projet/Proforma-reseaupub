'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type StatData = {
  count: number;
  sum: number;
};

type Stats = {
  brouillon: StatData;
  totalInvoices: number;
  validated: StatData;
  sent: StatData;
  cancelled: StatData;
  archived: StatData;
};

type Client = {
  id: string;
  nom: string;
};

type Gestionnaire = {
  id: string;
  nom: string;
  prenom: string;
};

const StatCard = ({ title, value, subValue }: { title: string; value: number; subValue?: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h3 className="text-lg font-semibold text-gray-600">{title}</h3>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
    {subValue && <p className="text-sm text-gray-500">{subValue}</p>}
  </div>
);

export default function StatistiquesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [filters, setFilters] = useState({
    clientId: '',
    gestionnaireId: '',
    startDate: '',
    endDate: '',
    year: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    if (!data.error) {
      setClients(data);
    }
  };

  const fetchGestionnaires = async () => {
    const res = await fetch('/api/gestionnaires');
    const data = await res.json();
    if (!data.error) {
      setGestionnaires(data);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.clientId) params.append('clientId', filters.clientId);
    if (filters.gestionnaireId) params.append('gestionnaireId', filters.gestionnaireId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.year) params.append('year', filters.year);

    const res = await fetch(`/api/statistiques?${params.toString()}`);
    const data = await res.json();
    setStats(data.error ? null : data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
    fetchGestionnaires();
    fetchStats();
  }, []);

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchStats();
  };
  // variable pour enregistrer l'année actuel
 const currentYear = new Date().getFullYear();
 const startYear = 2016;

 // Génère un tableau [2016, 2017, ..., currentYear]
 const years = [];
 for (let y = startYear; y <= currentYear; y++) {
   years.push(y);
 }
  const handleResetFilters = () => {
    setFilters({
      clientId: '',
      gestionnaireId: '',
      startDate: '',
      endDate: '',
      year: currentYear.toString(),
    });
    fetchStats();
  };
  const clientOptions = clients.map(c => ({ value: c.id, label: c.nom }));
  const gestionnaireOptions = gestionnaires.map(g => ({ value: g.id, label: `${g.prenom} ${g.nom}` }));

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Statistiques</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          <Combobox
            options={clientOptions}
            value={filters.clientId}
            onChange={(value) =>
              handleFilterChange(
                "clientId",
                value === filters.clientId ? "" : value
              )
            }
            placeholder="Sélectionner un client"
          />
          <Combobox 
            options={gestionnaireOptions}
            value={filters.gestionnaireId}
            onChange={(value) =>
              handleFilterChange(
                "gestionnaireId",
                value === filters.gestionnaireId ? "" : value
              )
            }
            placeholder="Sélectionner un commercial"
          />
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
          <select
            aria-label="Sélectionner une année"
            value={filters.year}
            onChange={(e) => handleFilterChange("year", e.target.value)}
            className="border rounded p-2"
          >
            <option value="">-- Sélectionner une année --</option>
            {years.map((year) => (
              <option key={year} value={year.toString()}>
                {year}
              </option>
            ))}
          </select>
          <div className="flex space-x-2">
            <Button onClick={handleApplyFilters}>Appliquer</Button>
            <Button onClick={handleResetFilters} variant="outline">
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          Chargement...
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="Total Factures" value={stats.totalInvoices} />
          <StatCard
            title="Factures Validées"
            value={stats.validated.count}
            subValue={`${Number(stats.validated.sum).toLocaleString("fr-FR", {
              style: "currency",
              currency: "XOF",
            })} `}
          />
          <StatCard
            title="Factures Envoyées"
            value={stats.sent.count}
            subValue={`${Number(stats.sent.sum).toLocaleString("fr-FR", {
              style: "currency",
              currency: "XOF",
            })} `}
          />
          <StatCard
            title="Factures Annulées"
            value={stats.cancelled.count}
            subValue={`${Number(stats.cancelled.sum).toLocaleString("fr-FR", {
              style: "currency",
              currency: "XOF",
            })} `}
          />
          <StatCard
            title="Factures Archivées"
            value={stats.archived.count}
            subValue={`${Number(stats.archived.sum).toLocaleString("fr-FR", {
              style: "currency",
              currency: "XOF",
            })} `}
          />
          <StatCard
            title="Factures Brouillon"
            value={stats.brouillon.count}
            subValue={`${Number(stats.brouillon.sum).toLocaleString("fr-FR", {
              style: "currency",
              currency: "XOF",
            })} `}
          />
        </div>
      ) : (
        <div className="text-center text-red-500 mt-10">
          Erreur lors du chargement des données ou aucune donnée à afficher.
        </div>
      )}
    </div>
  );
}
