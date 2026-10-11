"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, ImagePlus, Image as ImageIcon, X, Pencil } from "lucide-react";
import type { TypeUnite } from "@prisma/client";
import { ProduitPhotosDialog, ProduitPhoto } from "./ProduitPhotosDialog";
import { EditProduitDialog } from "./EditProduitDialog";

interface FournisseurProduitsProps {
    fournisseurId: string;
}

interface Produit {
    id: string;
    designation: string;
    description: string | null;
    prixUnitaire: number;
    typeUnite: TypeUnite;
    fournisseurId: string;
    photos: ProduitPhoto[];
}

const formatMontant = (value: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(value);

export default function FournisseurProduits({ fournisseurId }: FournisseurProduitsProps) {
    const [produits, setProduits] = useState<Produit[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
    const [editingProduit, setEditingProduit] = useState<Produit | null>(null);

    const [newProduct, setNewProduct] = useState({
        designation: "",
        description: "",
        prixUnitaire: "",
        typeUnite: "UNITE" as TypeUnite,
    });
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

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

    useEffect(() => {
        const urls = selectedFiles.map((f) => URL.createObjectURL(f));
        setPreviewUrls(urls);
        return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, [selectedFiles]);

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        e.target.value = "";
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const resetForm = () => {
        setNewProduct({ designation: "", description: "", prixUnitaire: "", typeUnite: "UNITE" });
        setSelectedFiles([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("designation", newProduct.designation);
            formData.append("description", newProduct.description);
            formData.append("prixUnitaire", newProduct.prixUnitaire);
            formData.append("typeUnite", newProduct.typeUnite);
            formData.append("fournisseurId", fournisseurId);
            selectedFiles.forEach((file) => formData.append("photos", file));

            const res = await fetch("/api/fournisseurs/produits", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to create product");
            }

            await fetchProduits();
            setIsDialogOpen(false);
            resetForm();
            toast.success("Produit ajouté au catalogue !");
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'ajout du produit.");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePhotosChange = (produitId: string, photos: ProduitPhoto[]) => {
        setProduits((prev) => prev.map((p) => (p.id === produitId ? { ...p, photos } : p)));
        setSelectedProduit((prev) => (prev && prev.id === produitId ? { ...prev, photos } : prev));
    };

    const handleProduitSaved = (updated: Produit) => {
        setProduits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSelectedProduit((prev) => (prev && prev.id === updated.id ? updated : prev));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Catalogue Produits</h3>
                <Dialog
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}
                >
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Ajouter un produit
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
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

                            <div className="space-y-2">
                                <Label>Photos (optionnel)</Label>
                                {previewUrls.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {previewUrls.map((url, index) => (
                                            <div key={url} className="relative aspect-square rounded-md overflow-hidden border">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSelectedFile(index)}
                                                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-600"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-3 cursor-pointer text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                    <ImagePlus className="h-4 w-4" />
                                    Ajouter des photos
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleFilesSelected}
                                    />
                                </label>
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

            {loading ? (
                <p className="text-center text-muted-foreground py-12">Chargement...</p>
            ) : produits.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 border rounded-md bg-white">
                    Aucun produit dans le catalogue.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {produits.map((prod) => (
                        <Card
                            key={prod.id}
                            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow py-0 gap-0"
                            onClick={() => setSelectedProduit(prod)}
                        >
                            <div className="relative aspect-video bg-muted">
                                {prod.photos.length > 0 ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={prod.photos[0].url}
                                        alt={prod.designation}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                                        <ImageIcon className="h-10 w-10" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingProduit(prod);
                                    }}
                                    className="absolute top-2 right-2 bg-white/90 text-gray-700 rounded-full p-1.5 shadow hover:bg-white hover:text-primary transition-colors"
                                    title="Modifier le produit"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {prod.photos.length > 1 && (
                                    <Badge className="absolute bottom-2 right-2 bg-black/60 text-white border-0 hover:bg-black/60">
                                        +{prod.photos.length - 1} photo{prod.photos.length - 1 > 1 ? "s" : ""}
                                    </Badge>
                                )}
                            </div>
                            <CardContent className="p-4 space-y-1.5">
                                <p className="font-semibold truncate">{prod.designation}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2em]">
                                    {prod.description || "Aucune description"}
                                </p>
                                <div className="flex items-center justify-between pt-1">
                                    <Badge variant="outline" className="text-[10px] font-normal">
                                        {prod.typeUnite === "METRE_CARRE" ? "m²" : prod.typeUnite}
                                    </Badge>
                                    <span className="font-semibold text-sm">
                                        {formatMontant(Number(prod.prixUnitaire))}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ProduitPhotosDialog
                produitId={selectedProduit?.id ?? null}
                produitNom={selectedProduit?.designation ?? ""}
                photos={selectedProduit?.photos ?? []}
                onClose={() => setSelectedProduit(null)}
                onPhotosChange={(photos) => selectedProduit && handlePhotosChange(selectedProduit.id, photos)}
            />

            <EditProduitDialog
                produit={editingProduit}
                onClose={() => setEditingProduit(null)}
                onSaved={handleProduitSaved}
            />
        </div>
    );
}
