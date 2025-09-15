
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddEntryModal } from '@/components/AddEntryModal';

// This will be the new page for the cash journal
export default function CashJournalPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const res = await fetch('/api/cash-journal');
      const data = await res.json();
      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch cash journal entries:', error);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const totalRecettes = entries.filter(e => e.type === 'RECETTE').reduce((acc, curr) => acc + curr.montant, 0);
  const totalDepenses = entries.filter(e => e.type === 'DEPENSE').reduce((acc, curr) => acc + curr.montant, 0);
  const soldeFinal = totalRecettes - totalDepenses;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Journal de Caisse</h1>
        <AddEntryModal onEntryAdded={fetchData} />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Recettes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRecettes.toLocaleString('fr-FR')} FCFA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDepenses.toLocaleString('fr-FR')} FCFA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Solde Final</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{soldeFinal.toLocaleString('fr-FR')} FCFA</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Recette</TableHead>
              <TableHead className="text-right">Dépense</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Chargement...</TableCell>
              </TableRow>
            ) : (
              entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date_operation).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{entry.libelle}</TableCell>
                  <TableCell className="text-right text-green-600">{entry.type === 'RECETTE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}</TableCell>
                  <TableCell className="text-right text-red-600">{entry.type === 'DEPENSE' ? `${entry.montant.toLocaleString('fr-FR')} FCFA` : ''}</TableCell>
                  <TableCell className="text-right font-medium">{entry.solde.toLocaleString('fr-FR')} FCFA</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

