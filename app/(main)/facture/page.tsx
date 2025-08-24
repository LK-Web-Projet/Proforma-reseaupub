'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Filter } from 'lucide-react';
import { FactureTableSkeleton } from '@/components/FactureTableSkeleton';

function formatDateFR(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

function formatMoney(amount: number, currency: string) {
  return Number(amount).toLocaleString('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
}

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [factures, setFactures] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');
  const [objet, setObjet] = useState('');
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Charger la liste des clients pour le filtre
  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // Charger les factures filtrées
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    //params.set("statut", "deliver");
    if (clientId) params.set('clientId', clientId);
    if (dateMin) params.set('dateMin', dateMin);
    if (dateMax) params.set('dateMax', dateMax);
    if (objet) params.set('objet', objet);
    if (statut) params.set('statut', statut);

    fetch(`/api/factures?${params.toString()}`)
      .then((res) => res.json())
      .then(setFactures)
      .finally(() => setLoading(false));
  }, [clientId, dateMin, dateMax, objet, statut]);


  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-between items-center  mb-6">
        <h1 className="text-2xl font-bold mb-8">
          Liste des factures délivrées
        </h1>

        {/* Filtres et Recherche */}
        <div className="w-full">
          <div className="flex gap-4 mb-4">
            <Button onClick={() => setFiltersVisible(!filtersVisible)} variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {filtersVisible ? 'Masquer les filtres' : 'Afficher les filtres'}
            </Button>
          </div>

          {filtersVisible && (
            <div className="mb-6 bg-white p-4 rounded-md shadow-sm border">
              <h2 className="text-lg font-semibold mb-2">Filtres</h2>
              <div className="flex gap-4 flex-wrap items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="border-gray-300 rounded-md shadow-sm p-2"
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
                  <label className="block text-sm font-medium mb-1">Date min</label>
                  <Input
                    type="date"
                    value={dateMin}
                    onChange={(e) => setDateMin(e.target.value)}
                    className="border-gray-300 rounded-md shadow-sm"
                    title="Date minimale"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date max</label>
                  <Input
                    type="date"
                    value={dateMax}
                    onChange={(e) => setDateMax(e.target.value)}
                    className="border-gray-300 rounded-md shadow-sm"
                    title="Date maximale"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={statut}
                    onChange={(e) => setStatut(e.target.value)}
                    className="border-gray-300 rounded-md shadow-sm p-2"
                    title="Sélectionnez un statut"
                  >
                    <option value="">Tous</option>
                    <option value="Envoyer">Envoyer</option>
                    <option value="Valider">Valider</option>
                    <option value="Payer">Payer</option>
                    <option value="Annuler">Annuler</option>
                    <option value="Archiver">Archiver</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          <div className="w-full">
            <label htmlFor="search-objet" className="sr-only">Rechercher par objet</label>
            <Input
              id="search-objet"
              type="text"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Rechercher par objet..."
              className="w-full md:w-1/3"
            />
          </div>
        </div>
      </div>

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
              <FactureTableSkeleton />
            ) : factures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              factures.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell>{formatDateFR(facture.dateCreation)}</TableCell>
                  <TableCell className="font-mono">{facture.numero}</TableCell>
                  <TableCell>{facture.client?.nom || '-'}</TableCell>
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
                          .join(', ')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(facture.totalTTC, facture.devise)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={
                        facture.statut === 'Envoyer'
                          ? 'envoyer'
                          : facture.statut === 'Valider'
                          ? 'valider'
                          : facture.statut === 'Payer'
                          ? 'payer'
                          : facture.statut === 'Annuler'
                          ? 'annuler'
                          : facture.statut === 'Archiver'
                          ? 'archiver'
                          : 'default' // Fallback to "default" if no match
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
