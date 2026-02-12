"use client";

import React, { useState, useEffect } from "react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ProduitFournisseur } from "@prisma/client";

interface NewCommandeFormProps {
    fournisseurId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

interface LigneCommande {
    produitFournisseurId: string;
    designation: string; // Pour affichage/override
    quantite: number;
    largeur?: number;
    hauteur?: number;
    prixUnitaire: number;
    typeUnite: string; // Pour affichage conditionnel des champs L/H
}

export default function NewCommandeForm({ fournisseurId, onSuccess, onCancel }: NewCommandeFormProps) {
    const [produits, setProduits] = useState<ProduitFournisseur[]>([]);
    const [lignes, setLignes] = useState<LigneCommande[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [dateCommande, setDateCommande] = useState(new Date().toISOString().split('T')[0]);

    // Charger le catalogue
    useEffect(() => {
        const fetchProduits = async () => {
            try {
                const res = await fetch(`/api/fournisseurs/produits?fournisseurId=${fournisseurId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProduits(data);
                }
            } catch (error) {
                console.error("Erreur chargement produits", error);
            } finally {
                // setLoadingProduits(false); // Removed as loadingProduits is no longer used
            }
        };
        fetchProduits();
    }, [fournisseurId]);

    const addLigne = () => {
        setLignes([
            ...lignes,
            {
                produitFournisseurId: "",
                designation: "",
                quantite: 1,
                prixUnitaire: 0,
                typeUnite: "UNITE",
            },
        ]);
    };

    const removeLigne = (index: number) => {
        const newLignes = [...lignes];
        newLignes.splice(index, 1);
        setLignes(newLignes);
    };

    const updateLigne = (index: number, field: keyof LigneCommande, value: string) => {
        const newLignes = [...lignes];
        const ligne = { ...newLignes[index] };

        if (field === "produitFournisseurId") {
            const prod = produits.find((p) => p.id === value);
            if (prod) {
                ligne.produitFournisseurId = prod.id;
                ligne.designation = prod.designation;
                ligne.prixUnitaire = Number(prod.prixUnitaire);
                ligne.typeUnite = prod.typeUnite;
            }
        } else if (field === 'quantite' || field === 'largeur' || field === 'hauteur' || field === 'prixUnitaire') {
            (ligne[field] as number | undefined) = value === '' ? undefined : Number(value);
        } else if (field === 'designation' || field === 'typeUnite') {
            (ligne[field] as string) = value;
        }

        newLignes[index] = ligne;
        setLignes(newLignes);
    };

    const calculateTotalLine = (ligne: LigneCommande) => {
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prixUnitaire) || 0;

        if (ligne.typeUnite === "METRE_CARRE" && ligne.largeur && ligne.hauteur) {
            const surface = Number(ligne.largeur) * Number(ligne.hauteur);
            // Supposons que PU est au m²
            return surface * qte * pu;
        }
        return qte * pu;
    };

    const calculateTotalGeneral = () => {
        return lignes.reduce((acc, ligne) => acc + calculateTotalLine(ligne), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Validation basique
            const lignesValides = lignes.filter(l => l.produitFournisseurId);
            if (lignesValides.length === 0) {
                toast.error("Veuillez ajouter au moins une ligne valide.");
                setSubmitting(false);
                return;
            }

            const payload = {
                fournisseurId,
                dateCommande: new Date(dateCommande).toISOString(),
                lignes: lignesValides.map(l => ({
                    produitFournisseurId: l.produitFournisseurId,
                    quantite: Number(l.quantite),
                    largeur: l.largeur ? Number(l.largeur) : undefined,
                    hauteur: l.hauteur ? Number(l.hauteur) : undefined,
                    prixUnitaire: Number(l.prixUnitaire),
                }))
            };

            const res = await fetch("/api/fournisseurs/commandes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Erreur création commande");
            }

            toast.success("Bon de commande créé avec succès !");
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Impossible de créer la commande.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Nouveau Bon de Commande</h2>
                <Input
                    type="date"
                    value={dateCommande}
                    onChange={(e) => setDateCommande(e.target.value)}
                    className="w-auto"
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%]">Produit</TableHead>
                            <TableHead className="w-[10%]">Dimensions (m)</TableHead>
                            <TableHead className="w-[10%]">Qté</TableHead>
                            <TableHead className="w-[15%]">P.U.</TableHead>
                            <TableHead className="w-[15%] text-right">Total</TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lignes.map((ligne, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Select
                                        value={ligne.produitFournisseurId}
                                        onValueChange={(val) => updateLigne(index, "produitFournisseurId", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner un produit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {produits.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.designation}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {ligne.produitFournisseurId && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Unité: {ligne.typeUnite}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {ligne.typeUnite === 'METRE_CARRE' ? (
                                        <div className="flex space-x-1">
                                            <Input
                                                placeholder="L"
                                                type="number"
                                                step="0.01"
                                                value={ligne.largeur || ''}
                                                onChange={(e) => updateLigne(index, 'largeur', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                            <span className="self-center">x</span>
                                            <Input
                                                placeholder="H"
                                                type="number"
                                                step="0.01"
                                                value={ligne.hauteur || ''}
                                                onChange={(e) => updateLigne(index, 'hauteur', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">N/A</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={ligne.quantite}
                                        onChange={(e) => updateLigne(index, "quantite", e.target.value)}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={ligne.prixUnitaire}
                                        onChange={(e) => updateLigne(index, "prixUnitaire", e.target.value)}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(calculateTotalLine(ligne))}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLigne(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-between items-center">
                <Button variant="outline" onClick={addLigne} type="button">
                    <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
                </Button>
                <div className="text-xl font-bold">
                    Total H.T. : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(calculateTotalGeneral())}
                </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={onCancel} disabled={submitting} type="button">
                    Annuler
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Création..." : "Valider la Commande"}
                </Button>
            </div>
        </div>
    );
}
