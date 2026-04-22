// Page: app/(main)/client/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientTableSkeleton } from "@/components/ClientTableSkeleton";
import { Search, UserPlus, FileText, CheckCircle2, Wallet, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ClientStats = {
  total: number;
  validees: number;
  payees: number;
  soldees: number;
};

type Client = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  stats: ClientStats;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) {
          throw new Error("Failed to fetch clients");
        }
        const data = await res.json();
        setClients(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const searchStr = searchTerm.toLowerCase();
      return (
        client.nom.toLowerCase().includes(searchStr) ||
        (client.email && client.email.toLowerCase().includes(searchStr)) ||
        (client.telephone && client.telephone.includes(searchTerm))
      );
    });
  }, [clients, searchTerm]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portefeuille Clients</h1>
          <p className="text-muted-foreground">Gérez vos relations clients et suivez leur activité de facturation.</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/client/new">
            <UserPlus className="w-4 h-4 mr-2" />
            Nouveau Client
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md bg-white rounded-lg border shadow-sm px-3 py-1">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou téléphone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
        />
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[250px]">Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-center">Total Factures</TableHead>
              <TableHead className="text-center">Validées</TableHead>
              <TableHead className="text-center">Payées</TableHead>
              <TableHead className="text-center">Soldées</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <ClientTableSkeleton />
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  {searchTerm ? "Aucun client ne correspond à votre recherche." : "Aucun client enregistré."}
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{client.nom}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{client.adresse || "Pas d'adresse"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{client.telephone || "-"}</span>
                      <span className="text-xs text-muted-foreground">{client.email || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-medium">
                      <FileText className="w-3 h-3 mr-1" />
                      {client.stats.total}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {client.stats.validees}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                      <Wallet className="w-3 h-3 mr-1" />
                      {client.stats.payees}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <CheckSquare className="w-3 h-3 mr-1" />
                      {client.stats.soldees}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm" className="hover:text-primary">
                      <Link href={`/client/${client.id}`}>Détails</Link>
                    </Button>
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
