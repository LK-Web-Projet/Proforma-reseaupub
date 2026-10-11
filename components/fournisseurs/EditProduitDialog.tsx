"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { TypeUnite } from "@prisma/client";
import type { ProduitPhoto } from "./ProduitPhotosDialog";

export interface ProduitToEdit {
    id: string;
    designation: string;
    description: string | null;
    prixUnitaire: number;
    typeUnite: TypeUnite;
    fournisseurId: string;
    photos: ProduitPhoto[];
}

interface EditProduitDialogProps {
    produit: ProduitToEdit | null;
    onClose: () => void;
    onSaved: (updated: ProduitToEdit) => void;
}

export function EditProduitDialog({ produit, onClose, onSaved }: EditProduitDialogProps) {
    const [form, setForm] = useState({
        designation: "",
        description: "",
        prixUnitaire: "",
        typeUnite: "UNITE" as TypeUnite,
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (produit) {
            setForm({
                designation: produit.designation,
                description: produit.description || "",
                prixUnitaire: String(produit.prixUnitaire),
                typeUnite: produit.typeUnite,
            });
        }
    }, [produit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!produit) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/fournisseurs/produits/${produit.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    designation: form.designation,
                    description: form.description || undefined,
                    prixUnitaire: parseFloat(form.prixUnitaire),
                    typeUnite: form.typeUnite,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Erreur lors de la modification du produit.");
            }

            const updated = await res.json();
            onSaved(updated);
            toast.success("Produit modifié !");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Erreur lors de la modification du produit.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={!!produit} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Modifier le produit</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-designation">Désignation</Label>
                        <Input
                            id="edit-designation"
                            required
                            value={form.designation}
                            onChange={(e) => setForm({ ...form, designation: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Description (Optionnel)</Label>
                        <Input
                            id="edit-description"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-prix">Prix Unitaire</Label>
                            <Input
                                id="edit-prix"
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={form.prixUnitaire}
                                onChange={(e) => setForm({ ...form, prixUnitaire: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-unite">Unité</Label>
                            <Select
                                value={form.typeUnite}
                                onValueChange={(val: TypeUnite) => setForm({ ...form, typeUnite: val })}
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
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
