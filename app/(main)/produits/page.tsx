"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProduitModal } from "@/components/ProduitModal";
import type { Produit } from "@/components/ProduitCombobox";
import { PlusCircle, Pencil, Trash2, Package, Search, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDroits } from "@/components/DroitsProvider";

const formatMontant = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(value);

export default function ProduitsPage() {
  const { peut } = useDroits();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const fetchProduits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/produits");
      if (!res.ok) throw new Error("Failed to fetch produits");
      setProduits(await res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProduits();
  }, [fetchProduits]);

  const inactiveCount = useMemo(() => produits.filter((p) => !p.actif).length, [produits]);

  const filteredProduits = useMemo(() => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter((t) => t !== "");
    return produits.filter((p) => {
      if (!showInactive && !p.actif) return false;
      if (searchTerms.length === 0) return true;
      return searchTerms.every((term) => p.nom.toLowerCase().includes(term));
    });
  }, [produits, search, showInactive]);

  const handleOpenModal = (produit: Produit | null = null) => {
    setSelectedProduit(produit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduit(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchProduits();
  };

  const handleToggleActif = async (produit: Produit) => {
    try {
      const res = await fetch(`/api/produits/${produit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !produit.actif }),
      });
      if (!res.ok) throw new Error();
      toast.success(produit.actif ? "Produit désactivé." : "Produit activé.");
      fetchProduits();
    } catch {
      toast.error("Erreur lors de la mise à jour du statut.");
    }
  };

  const handleDelete = async (produit: Produit) => {
    try {
      const res = await fetch(`/api/produits/${produit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur lors de la suppression.");
      }
      toast.success("Produit supprimé.");
      fetchProduits();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression.");
    }
  };

  return (
    <>
      <ProduitModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        initialData={selectedProduit}
      />
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Liste des Produits</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Chargement..." : `${filteredProduits.length} / ${produits.length} produit(s)`}
            </p>
          </div>
          {peut("produits.creer") && (
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un produit
          </Button>
          )}
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
            <Switch id="showInactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="showInactive" className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
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
                <TableHead className="max-w-[280px]">Nom</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredProduits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-32">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="h-8 w-8" />
                      <p>Aucun produit trouvé.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProduits.map((produit) => (
                  <TableRow key={produit.id} className="hover:bg-muted/30">
                    <TableCell className="py-3 font-medium max-w-[280px]">
                      <span className="truncate block" title={produit.nom}>
                        {produit.nom}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">{formatMontant(produit.prixUnitaire)}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={produit.actif} onCheckedChange={() => handleToggleActif(produit)} disabled={!peut("produits.modifier")} />
                        {!produit.actif && (
                          <Badge variant="destructive" className="text-[10px]">
                            Inactif
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {peut("produits.modifier") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Modifier le produit"
                          onClick={() => handleOpenModal(produit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        )}
                        {peut("produits.supprimer") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Supprimer le produit"
                          onClick={() => handleDelete(produit)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
