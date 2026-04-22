'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Filter, Wallet, Send, CheckCircle, Banknote, XCircle, Archive, Check } from 'lucide-react';
import { FactureTableSkeleton } from '@/components/FactureTableSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
    minimumFractionDigits: 0,
  });
}

// Taux de conversion pour la synthèse (approximatifs pour USD)
const CONVERSION_RATES: Record<string, number> = {
  'EUR': 655.957,
  'USD': 600,
  'XAF': 1,
  'XOF': 1,
};

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allFactures, setAllFactures] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');
  const [objet, setObjet] = useState('');
  const [statut, setStatut] = useState(''); // Utilisé pour filtrer la liste locale
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Charger la liste des clients pour le filtre
  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // Charger les factures (sans filtre de statut pour permettre le calcul des stats de toutes les cartes)
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year && year !== '') {
      params.set('year', year);
    } else {
      if (dateMin) params.set('dateMin', dateMin);
      if (dateMax) params.set('dateMax', dateMax);
    }
    if (clientId) params.set('clientId', clientId);

    fetch(`/api/factures?${params.toString()}`)
      .then((res) => res.json())
      .then(setAllFactures)
      .finally(() => setLoading(false));
  }, [clientId, dateMin, dateMax, year]);

  // Calcul des statistiques pour les cartes (dynamique selon les filtres de base)
  const stats = useMemo(() => {
    const initialStats: Record<string, { total: number; paid: number; remaining: number }> = {
      "Brouillon": { total: 0, paid: 0, remaining: 0 },
      "Envoyer": { total: 0, paid: 0, remaining: 0 },
      "Valider": { total: 0, paid: 0, remaining: 0 },
      "Payer": { total: 0, paid: 0, remaining: 0 },
      "Annuler": { total: 0, paid: 0, remaining: 0 },
      "Archiver": { total: 0, paid: 0, remaining: 0 },
      "Solde": { total: 0, paid: 0, remaining: 0 },
      "Total": { total: 0, paid: 0, remaining: 0 }
    };

    allFactures.forEach(f => {
      const rate = CONVERSION_RATES[f.devise] || 1;
      const totalTTC = Number(f.totalTTC) * rate;
      const remaining = Number(f.resteAPayer) * rate;
      const paid = totalTTC - remaining;
      
      if (initialStats[f.statut]) {
        initialStats[f.statut].total += totalTTC;
        initialStats[f.statut].paid += paid;
        initialStats[f.statut].remaining += remaining;
      }
      initialStats["Total"].total += totalTTC;
      initialStats["Total"].paid += paid;
      initialStats["Total"].remaining += remaining;
    });

    return initialStats;
  }, [allFactures]);

  // Filtrage final pour le tableau (Objet + Statut sélectionné via les cartes)
  const filteredFactures = useMemo(() => {
    return allFactures.filter(f => {
      const matchStatut = statut === '' || f.statut === statut;
      const matchObjet = objet === '' || f.objet.toLowerCase().includes(objet.toLowerCase());
      return matchStatut && matchObjet;
    });
  }, [allFactures, statut, objet]);

  const cards = [
    { label: "Toutes", value: "", stats: stats["Total"], icon: Wallet, color: "text-blue-600" },
    { label: "Brouillon", value: "Brouillon", stats: stats["Brouillon"], icon: XCircle, color: "text-gray-500" },
    { label: "Envoyée", value: "Envoyer", stats: stats["Envoyer"], icon: Send, color: "text-orange-500" },
    { label: "Validée", value: "Valider", stats: stats["Valider"], icon: CheckCircle, color: "text-purple-500" },
    { label: "En cours de paiement", value: "Payer", stats: stats["Payer"], icon: Banknote, color: "text-green-600" },
    { label: "Soldée", value: "Solde", stats: stats["Solde"], icon: Check, color: "text-emerald-600" },
    { label: "Annulée", value: "Annuler", stats: stats["Annuler"], icon: XCircle, color: "text-red-600" },
    { label: "Archivée", value: "Archiver", stats: stats["Archiver"], icon: Archive, color: "text-slate-600" },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h1 className="text-2xl font-bold mb-4">Liste des factures émises</h1>
      </div>

      {/* Cartes de sélection / Filtres de statut */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <Card
            key={card.label}
            className={cn(
              "cursor-pointer hover:shadow-lg transition-all border-2",
              statut === card.value ? "border-primary bg-primary/5 shadow-md" : "border-transparent"
            )}
            onClick={() => setStatut(card.value)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {card.stats.total.toLocaleString("fr-FR")} FCFA
              </div>
              
              {/* Détails financiers pour la carte "Payer" ou si sélectionnée */}
              {(card.value === "Payer" || (card.value === "" && card.stats.remaining > 0)) && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-green-600 font-bold uppercase">
                    <span>Payé:</span>
                    <span>{card.stats.paid.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-red-600 font-bold uppercase">
                    <span>Reste:</span>
                    <span>{card.stats.remaining.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-1">
                {allFactures.filter(f => card.value === "" || f.statut === card.value).length} facture(s)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtres de recherche */}
      <div className="w-full">
        <div className="flex gap-4 mb-4">
          <Button
            onClick={() => setFiltersVisible(!filtersVisible)}
            variant="outline"
          >
            <Filter className="mr-2 h-4 w-4" />
            {filtersVisible ? "Masquer les filtres" : "Afficher les filtres"}
          </Button>
          <div className="flex-1">
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

        {filtersVisible && (
          <div className="mb-6 bg-white p-4 rounded-md shadow-sm border">
            <h2 className="text-lg font-semibold mb-2">Filtres avancés</h2>
            <div className="flex gap-4 flex-wrap items-end">
               <div>
                <label className="block text-sm font-medium mb-1">
                  Année
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setDateMin("");
                    setDateMax("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Toutes les années</option>
                  <option value="2027">2027</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Tous les clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date min
                </label>
                <Input
                  type="date"
                  value={dateMin}
                  onChange={(e) => {
                    setDateMin(e.target.value);
                    setYear("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm"
                  disabled={!!year}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date max
                </label>
                <Input
                  type="date"
                  value={dateMax}
                  onChange={(e) => {
                    setDateMax(e.target.value);
                    setYear("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm"
                  disabled={!!year}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-white border">
        <Table>
          <TableHeader className="bg-rpcolor/10 sticky top-0 z-10">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Numéro</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead className="text-center">Gestionnaire</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead className="text-right">Reste à Payer</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-center">Voir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <FactureTableSkeleton />
            ) : filteredFactures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredFactures.map((facture) => (
                <TableRow key={facture.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>{formatDateFR(facture.dateCreation)}</TableCell>
                  <TableCell className="font-mono text-sm">{facture.numero}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate max-w-[150px] inline-block cursor-default">
                            {facture.client?.nom || "-"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{facture.client?.nom || "-"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate max-w-[150px] inline-block cursor-default">
                            {facture.objet}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{facture.objet}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center text-sm">
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
                  <TableCell className="text-right font-semibold text-red-600">
                    {formatMoney(facture.resteAPayer, facture.devise)}
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
                          : facture.statut === "Solde"
                          ? "success"
                          : "brouillon"
                      }
                    >
                      {facture.statut === "Envoyer" ? "Envoyée" : 
                       facture.statut === "Valider" ? "Validée" : 
                       facture.statut === "Payer" ? "En cours de paiement" : 
                       facture.statut === "Annuler" ? "Annulée" : 
                       facture.statut === "Archiver" ? "Archivée" : 
                       facture.statut === "Solde" ? "Soldée" : 
                       facture.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/facture/${facture.id}`}
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
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
