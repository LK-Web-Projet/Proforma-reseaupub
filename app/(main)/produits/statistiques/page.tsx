"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import { BarChart3, ArrowUp, ArrowDown, ArrowUpDown, Coins, Package, CheckCircle2, Trophy, Search, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProduitStat {
  id: string;
  nom: string;
  actif: boolean;
  prixUnitaire: number;
  quantiteVendue: number;
  montantTotal: number;
  nombreFactures: number;
}

type SortKey = "nom" | "quantiteVendue" | "montantTotal" | "nombreFactures";

const formatMontant = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(value);

export default function ProduitsStatistiquesPage() {
  const [stats, setStats] = useState<ProduitStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("montantTotal");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    fetch("/api/produits/statistiques")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(setStats)
      .catch(() => toast.error("Erreur lors du chargement des statistiques produits."))
      .finally(() => setLoading(false));
  }, []);

  const inactiveCount = useMemo(() => stats.filter((p) => !p.actif).length, [stats]);

  const filteredStats = useMemo(() => {
    const term = search.toLowerCase().trim();
    return stats.filter((p) => {
      if (!showInactive && !p.actif) return false;
      if (!term) return true;
      return p.nom.toLowerCase().includes(term);
    });
  }, [stats, search, showInactive]);

  const sortedStats = useMemo(() => {
    const sorted = [...filteredStats].sort((a, b) => {
      if (sortKey === "nom") return a.nom.localeCompare(b.nom);
      return a[sortKey] - b[sortKey];
    });
    return sortDesc && sortKey !== "nom" ? sorted.reverse() : sorted;
  }, [filteredStats, sortKey, sortDesc]);

  const summary = useMemo(() => {
    const caTotal = stats.reduce((acc, p) => acc + p.montantTotal, 0);
    const quantiteTotale = stats.reduce((acc, p) => acc + p.quantiteVendue, 0);
    const actifs = stats.filter((p) => p.actif).length;
    const topProduit = [...stats].sort((a, b) => b.montantTotal - a.montantTotal)[0];
    return { caTotal, quantiteTotale, actifs, topProduit };
  }, [stats]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortableHead = ({ label, keyName, className }: { label: string; keyName: SortKey; className?: string }) => {
    const isActive = sortKey === keyName;
    const Icon = isActive ? (sortDesc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => handleSort(keyName)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors",
            isActive && "text-foreground font-semibold"
          )}
        >
          {label}
          <Icon className={cn("h-3 w-3", isActive ? "opacity-100" : "opacity-40")} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Statistiques Produits
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          CA réalisé sur les proformas validées, payées ou soldées.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="CA total réalisé"
          value={formatMontant(summary.caTotal)}
          icon={Coins}
          accent={{ bg: "bg-emerald-50", text: "text-emerald-600", border: "border-t-emerald-500" }}
        />
        <StatCard
          title="Quantité totale vendue"
          value={summary.quantiteTotale.toLocaleString("fr-FR")}
          icon={Package}
          accent={{ bg: "bg-blue-50", text: "text-blue-600", border: "border-t-blue-500" }}
        />
        <StatCard
          title="Produits actifs"
          value={`${summary.actifs} / ${stats.length}`}
          icon={CheckCircle2}
          accent={{ bg: "bg-violet-50", text: "text-violet-600", border: "border-t-violet-500" }}
        />
        <StatCard
          title="Produit le plus vendu"
          value={summary.topProduit?.nom ?? "—"}
          subValue={summary.topProduit ? formatMontant(summary.topProduit.montantTotal) : undefined}
          icon={Trophy}
          accent={{ bg: "bg-amber-50", text: "text-amber-600", border: "border-t-amber-500" }}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit par nom..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 text-sm">
          <Switch id="showInactiveStats" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="showInactiveStats" className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" />
            Afficher les produits désactivés
            {inactiveCount > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-0.5">
                {inactiveCount}
              </Badge>
            )}
          </Label>
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <SortableHead label="Produit" keyName="nom" className="max-w-[220px]" />
              <TableHead>Statut</TableHead>
              <SortableHead label="Quantité vendue" keyName="quantiteVendue" className="text-right" />
              <SortableHead label="CA réalisé" keyName="montantTotal" className="text-right" />
              <SortableHead label="Factures" keyName="nombreFactures" className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : sortedStats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <p>Aucun produit trouvé.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedStats.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="py-3 font-medium max-w-[220px]">
                    <span className="truncate block" title={p.nom}>
                      {p.nom}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {p.actif ? (
                      <Badge variant="outline" className="font-normal bg-emerald-50 text-emerald-700 border-emerald-200">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal bg-gray-50 text-gray-500 border-gray-200">
                        Inactif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right tabular-nums">{p.quantiteVendue.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="py-3 text-right font-semibold tabular-nums">{formatMontant(p.montantTotal)}</TableCell>
                  <TableCell className="py-3 text-right tabular-nums">{p.nombreFactures}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
