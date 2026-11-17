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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InvoiceCombobox, InvoiceOption } from "@/components/InvoiceCombobox";
import { LigneBudgetCommandeField } from "@/components/fournisseurs/LigneBudgetCommandeField";

const TAUX_TVA = 0.18;
const TAUX_AIB = 0.03;

// Seules les proformas confirmées côté client peuvent être associées à un BCF.
const STATUTS_PROFORMA_ASSOCIABLES = ['Valider', 'Payer', 'Solde'];

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
    const [appliquerTva, setAppliquerTva] = useState(false);
    const [appliquerAib, setAppliquerAib] = useState(false);
    const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
    // Une seule proforma par bon ; si elle a un budget, la ligne de ce budget est obligatoire.
    const [proformaId, setProformaId] = useState('');
    const [ligneBudgetId, setLigneBudgetId] = useState('');

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

    // Charger les proformas associables (validées, payées ou soldées)
    useEffect(() => {
        fetch('/api/factures')
            .then((res) => (res.ok ? res.json() : []))
            .then((data: (InvoiceOption & { statut: string })[]) =>
                setInvoices(data.filter((inv) => STATUTS_PROFORMA_ASSOCIABLES.includes(inv.statut)))
            )
            .catch(() => setInvoices([]));
    }, []);

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

    const calculateSurface = (ligne: LigneCommande) => {
        if (ligne.typeUnite !== "METRE_CARRE" || !ligne.largeur || !ligne.hauteur) return null;
        // Dimensions saisies en cm, conversion géométrique standard en m² : (L×H)/10000.
        return (Number(ligne.largeur) * Number(ligne.hauteur)) / 10000;
    };

    const calculateTotalLine = (ligne: LigneCommande) => {
        const qte = Number(ligne.quantite) || 0;
        const pu = Number(ligne.prixUnitaire) || 0;
        const surfaceM2 = calculateSurface(ligne);

        if (surfaceM2 !== null) {
            // Supposons que PU est au m²
            return surfaceM2 * qte * pu;
        }
        return qte * pu;
    };

    const calculateTotalGeneral = () => {
        return lignes.reduce((acc, ligne) => acc + calculateTotalLine(ligne), 0);
    };

    const totalGeneral = calculateTotalGeneral();
    const montantTva = appliquerTva ? totalGeneral * TAUX_TVA : 0;
    const totalTTC = totalGeneral + montantTva;
    const montantAib = appliquerAib ? totalGeneral * TAUX_AIB : 0;
    const montantNet = totalTTC - montantAib;

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
                })),
                appliquerTva,
                appliquerAib,
                proformaIds: proformaId ? [proformaId] : [],
                ligneBudgetId: ligneBudgetId || undefined,
            };

            const res = await fetch("/api/fournisseurs/commandes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(typeof errorData.error === "string" ? errorData.error : "Impossible de créer la commande.");
            }

            toast.success("Bon de commande créé avec succès !");
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Impossible de créer la commande.");
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

            <div className="space-y-2">
                <label className="text-sm font-medium">Proforma associée</label>
                <InvoiceCombobox invoices={invoices} value={proformaId} onChange={setProformaId} />
                <p className="text-[11px] text-muted-foreground">
                    Une seule proforma par bon de commande : validée, payée ou soldée.
                </p>
            </div>

            <LigneBudgetCommandeField proformaId={proformaId} montantNet={montantNet} value={ligneBudgetId} onChange={setLigneBudgetId} />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[25%]">Produit</TableHead>
                            <TableHead className="w-[10%]">Dimensions (cm)</TableHead>
                            <TableHead className="w-[10%]">Surface (m²)</TableHead>
                            <TableHead className="w-[9%]">Qté</TableHead>
                            <TableHead className="w-[13%]">P.U.</TableHead>
                            <TableHead className="w-[14%] text-right">Total</TableHead>
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
                                                className="h-8 min-w-[60px] text-xs"
                                            />
                                            <span className="self-center">x</span>
                                            <Input
                                                placeholder="H"
                                                type="number"
                                                step="0.01"
                                                value={ligne.hauteur || ''}
                                                onChange={(e) => updateLigne(index, 'hauteur', e.target.value)}
                                                className="h-8 min-w-[60px] text-xs"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">N/A</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {calculateSurface(ligne) !== null
                                        ? `${calculateSurface(ligne)!.toFixed(3)} m²`
                                        : <span className="text-xs italic">N/A</span>}
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={ligne.quantite}
                                        onChange={(e) => updateLigne(index, "quantite", e.target.value)}
                                        className="h-9 min-w-[70px]"
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
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">TVA (18%)</p>
                        <p className="text-[11px] text-muted-foreground">Appliquer la TVA à ce bon de commande</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={appliquerTva ? 'default' : 'outline'} className="text-[10px] uppercase">
                            {appliquerTva ? 'Appliquée' : 'Non appliquée'}
                        </Badge>
                        <Switch checked={appliquerTva} onCheckedChange={setAppliquerTva} />
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">AIB (3%)</p>
                        <p className="text-[11px] text-muted-foreground">Appliquer l&apos;AIB à ce bon de commande</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={appliquerAib ? 'default' : 'outline'} className="text-[10px] uppercase">
                            {appliquerAib ? 'Appliqué' : 'Non appliqué'}
                        </Badge>
                        <Switch checked={appliquerAib} onCheckedChange={setAppliquerAib} />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <div className="w-full sm:w-72 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Total H.T.</span>
                        <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(totalGeneral)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>
                            TVA (18%)
                            {!appliquerTva && <span className="text-[10px] italic"> — non appliquée</span>}
                        </span>
                        <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(montantTva)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total T.T.C.</span>
                        <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(totalTTC)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>
                            AIB (3%) — déduite
                            {!appliquerAib && <span className="text-[10px] italic"> — non appliqué</span>}
                        </span>
                        <span>− {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(montantAib)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-1">
                        <span>Montant Net</span>
                        <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(montantNet)}</span>
                    </div>
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
