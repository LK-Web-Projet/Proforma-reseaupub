"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ProduitFournisseur, TypeUnite } from "@prisma/client";

interface FournisseurProduitsProps {
    fournisseurId: string;
}

export default function FournisseurProduits({ fournisseurId }: FournisseurProduitsProps) {
    const [produits, setProduits] = useState<ProduitFournisseur[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [newProduct, setNewProduct] = useState({
        designation: "",
        description: "",
        prixUnitaire: "",
        typeUnite: "UNITE" as TypeUnite,
    });

    const fetchProduits = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fournisseurs/produits?fournisseurId=${fournisseurId}`);
            if (!res.ok) {
                const text = await res.text();
                console.error("API Error Response:", res.status, text);
                throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            setProduits(data);
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors du chargement du catalogue. Vérifiez la console.");
        } finally {
            setLoading(false);
        }
    }, [fournisseurId]);

    useEffect(() => {
        fetchProduits();
    }, [fetchProduits]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...newProduct,
                prixUnitaire: parseFloat(newProduct.prixUnitaire),
                fournisseurId,
            };

            const res = await fetch("/api/fournisseurs/produits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to create product");
            }

            await fetchProduits();
            setIsDialogOpen(false);
            setNewProduct({
                designation: "",
                description: "",
                prixUnitaire: "",
                typeUnite: "UNITE",
            });
            toast.success("Produit ajouté au catalogue !");
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'ajout du produit.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Catalogue Produits</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter un produit
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Ajouter un nouveau produit</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="designation">Désignation</Label>
                                <Input
                                    id="designation"
                                    required
                                    value={newProduct.designation}
                                    onChange={(e) =>
                                        setNewProduct({ ...newProduct, designation: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optionnel)</Label>
                                <Input
                                    id="description"
                                    value={newProduct.description}
                                    onChange={(e) =>
                                        setNewProduct({ ...newProduct, description: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="prix">Prix Unitaire</Label>
                                    <Input
                                        id="prix"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={newProduct.prixUnitaire}
                                        onChange={(e) =>
                                            setNewProduct({ ...newProduct, prixUnitaire: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unite">Unité</Label>
                                    <Select
                                        value={newProduct.typeUnite}
                                        onValueChange={(val: TypeUnite) =>
                                            setNewProduct({ ...newProduct, typeUnite: val })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UNITE">Unité</SelectItem>
                                            <SelectItem value="METRE_CARRE">Mètre Carré (m²)</SelectItem>
                                            <SelectItem value="ROULEAU">Rouleau</SelectItem>
                                            <SelectItem value="METRE_LINEAIRE">Mètre Linéaire</SelectItem>
                                            <SelectItem value="FORFAIT">Forfait</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? "Ajout..." : "Ajouter"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Désignation</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Unité</TableHead>
                            <TableHead className="text-right">Prix Unitaire</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    Chargement...
                                </TableCell>
                            </TableRow>
                        ) : produits.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    Aucun produit dans le catalogue.
                                </TableCell>
                            </TableRow>
                        ) : (
                            produits.map((prod) => (
                                <TableRow key={prod.id}>
                                    <TableCell className="font-medium">{prod.designation}</TableCell>
                                    <TableCell>{prod.description || "-"}</TableCell>
                                    <TableCell>
                                        {prod.typeUnite === "METRE_CARRE" ? "m²" : prod.typeUnite}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat("fr-FR", {
                                            style: "currency",
                                            currency: "XOF",
                                        }).format(Number(prod.prixUnitaire))}
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
