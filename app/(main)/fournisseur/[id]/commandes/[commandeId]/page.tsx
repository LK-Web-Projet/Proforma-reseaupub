"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next-nprogress-bar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Download, Building2, Mail, Phone, MapPin, FileText, Receipt, Pencil, SlidersHorizontal } from "lucide-react";
import type { StatutCommandeFournisseur } from "@prisma/client";
import { FactureStatusBadge } from "@/components/FactureStatusBadge";
import { CommandeStatutControl } from "@/components/fournisseurs/CommandeStatutControl";
import { EditCommandeFournisseurModal } from "@/components/fournisseurs/EditCommandeFournisseurModal";
import { resolveTypeFournisseur } from "@/lib/typeFournisseur";
import { CommandeLiasseCard, type CommandeSuivi } from "@/components/fournisseurs/CommandeLiasseCard";
import { commandeSansLiaison, etatLiasse } from "@/lib/commandeFournisseurLiasse";
import { genererBonCommandePdf } from "@/lib/pdf/bonCommandePdf";
import { useDroits } from "@/components/DroitsProvider";

interface ProduitFournisseur {
    id: string;
    designation: string;
    typeUnite: string;
    prixUnitaire: number;
}

interface LigneCommande {
    id: string;
    designation: string;
    quantite: number;
    largeur: number | null;
    hauteur: number | null;
    surface: number | null;
    prixUnitaire: number;
    prixTotal: number;
    produitFournisseur: ProduitFournisseur;
}

interface Fournisseur {
    id: string;
    entreprise: string;
    nom: string | null;
    prenom: string | null;
    email: string | null;
    contact: string;
    adresse: string;
    domaineActivite: string;
    typeFournisseur: string | null;
}

interface EntrepriseConfig {
    id: string;
    nom: string;
    slogan: string | null;
    adresse: string;
    telephone: string;
    email: string;
    emailFinance: string;
    ifu: string;
    rccm: string | null;
    nomDirecteur: string;
    logoPath: string;
}

interface ProformaAssociee {
    invoice: {
        id: string;
        numero: string;
        objet: string;
        statut: string;
        client: { nom: string } | null;
    };
}

interface CommandeDetail {
    id: string;
    numero: string;
    dateCommande: string;
    statut: StatutCommandeFournisseur;
    totalHT: number;
    appliquerTva: boolean;
    tva: number;
    appliquerAib: boolean;
    montantAib: number;
    totalTTC: number;
    montantNet: number;
    fournisseur: Fournisseur;
    lignes: LigneCommande[];
    proformas: ProformaAssociee[];
    createdAt: string;
    // Lot C : ligne de budget, liasse, factures et paiements (voir CommandeLiasseCard).
    fournisseurId: string;
    ligneBudget: CommandeSuivi["ligneBudget"];
    /** Ancien rattachement d'un budget entier au bon (sert seulement à savoir si le bon est lié). */
    demandesBudget?: { id: string }[];
    documents: CommandeSuivi["documents"];
    factures: CommandeSuivi["factures"];
    depenses: CommandeSuivi["depenses"];
    imputations: CommandeSuivi["imputations"];
}

const cleanText = (text: string) => {
    return text.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
};

const formatCurrency = (amount: number) => {
    return cleanText(new Intl.NumberFormat("fr-BJ", {
        style: "currency",
        currency: "XOF",
    }).format(amount));
};


export default function CommandeDetailPage() {
    const { peut } = useDroits();
    const [commande, setCommande] = useState<CommandeDetail | null>(null);
    const [entreprise, setEntreprise] = useState<EntrepriseConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [includeClientPdf, setIncludeClientPdf] = useState(true);
    const [includeObjetPdf, setIncludeObjetPdf] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const params = useParams();
    const router = useRouter();
    const commandeId = params.commandeId as string;
    const fournisseurId = params.id as string;

    const fetchCommande = useCallback(async () => {
        if (!commandeId) return;
        setLoading(true);
        try {
            const [cmdRes, entRes] = await Promise.all([
                fetch(`/api/fournisseurs/commandes/${commandeId}`),
                fetch(`/api/entreprise`),
            ]);
            if (!cmdRes.ok) throw new Error("Erreur lors du chargement");
            const cmdData = await cmdRes.json();
            setCommande(cmdData);
            if (entRes.ok) {
                const entData = await entRes.json();
                setEntreprise(entData);
            }
        } catch (error) {
            console.error(error);
            toast.error("Impossible de charger le bon de commande.");
        } finally {
            setLoading(false);
        }
    }, [commandeId]);

    useEffect(() => {
        fetchCommande();
    }, [fetchCommande]);

    useEffect(() => {
        fetch("/api/demandes-budget/me-role")
            .then((res) => (res.ok ? res.json() : { isAdmin: false }))
            .then((data) => setIsAdmin(!!data.isAdmin))
            .catch(() => setIsAdmin(false));
    }, []);

    const handleStatutChange = async (newStatut: StatutCommandeFournisseur) => {
        if (!commande) return;
        try {
            const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ statut: newStatut }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Erreur lors de la mise à jour du statut.");
            }
            setCommande((prev) => (prev ? { ...prev, statut: newStatut } : prev));
            toast.success("Statut mis à jour avec succès !");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour du statut.");
        }
    };

    const handleDownloadPDF = async () => {
        if (!commande) return;
        setGeneratingPdf(true);
        try {
            const ent = entreprise ?? {
                id: "singleton",
                nom: "Reseaupub",
                slogan: null,
                adresse: "Etoile Rouge, Cotonou, Bénin",
                telephone: "+229 01 69 81 30 30",
                email: "info@reseaupub.com",
                emailFinance: "finance@reseaupub.com",
                ifu: "0201710009974",
                rccm: null,
                nomDirecteur: "Directeur Général",
                logoPath: "rplogo.png",
            };
            const pdfBytes = await genererBonCommandePdf(commande, ent, {
                includeClient: includeClientPdf,
                includeObjet: includeObjetPdf,
            });

            // Correction TypeScript : Forcer le type avec `as unknown as BlobPart`
            const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${commande.numero}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("PDF généré avec succès !");
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la génération du PDF.");
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3" />
                <div className="h-40 bg-gray-200 rounded" />
                <div className="h-64 bg-gray-200 rounded" />
            </div>
        );
    }

    if (!commande) {
        return (
            <div className="max-w-5xl mx-auto text-center py-20">
                <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">Bon de commande introuvable.</p>
                <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push(`/fournisseur/${fournisseurId}`)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Barre d'actions */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    onClick={() => router.push(`/fournisseur/${fournisseurId}?tab=commandes`)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour aux commandes
                </Button>
                <div className="flex items-center gap-2">
                    {commande.statut === "BROUILLON" && peut("fournisseurs.commandeModifier") && (
                        <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Modifier
                        </Button>
                    )}
                    {commande.proformas.length > 0 && peut("fournisseurs.commandeExporter") && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" title="Options du PDF">
                                    <SlidersHorizontal className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" align="end">
                                <p className="text-sm font-medium mb-3">Dans le PDF, inclure :</p>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="pdf-include-client" className="text-sm font-normal">
                                            Le client de la proforma associée
                                        </Label>
                                        <Switch
                                            id="pdf-include-client"
                                            checked={includeClientPdf}
                                            onCheckedChange={setIncludeClientPdf}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="pdf-include-objet" className="text-sm font-normal">
                                            L&apos;objet de la proforma associée
                                        </Label>
                                        <Switch
                                            id="pdf-include-objet"
                                            checked={includeObjetPdf}
                                            onCheckedChange={setIncludeObjetPdf}
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {peut("fournisseurs.commandeExporter") && (
                    <Button
                        onClick={handleDownloadPDF}
                        loading={generatingPdf} disabled={generatingPdf}
                        className="gap-2 bg-[#ef0b53] hover:bg-[#d10a48] text-white"
                    >
                        <Download className="h-4 w-4" />
                        {generatingPdf ? "Génération..." : "Télécharger PDF"}
                    </Button>
                    )}
                </div>
            </div>

            {/* En-tête du bon de commande */}
            <Card className="border-0 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-[#ef0b53] to-[#c10943] p-6 text-white">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-rose-100 text-sm font-medium uppercase tracking-wider mb-1">
                                Bon de Commande Fournisseur
                            </p>
                            <h1 className="text-3xl font-bold">{commande.numero}</h1>
                        </div>
                        <div className="text-right">
                            <div className="mb-2 flex justify-end">
                                <CommandeStatutControl
                                    statut={commande.statut}
                                    isAdmin={isAdmin}
                                    bcSigne={etatLiasse(commande.documents ?? []).bcSigne}
                                    sansLiaison={commandeSansLiaison({ ligneBudgetId: commande.ligneBudget?.id, proformas: commande.proformas, demandesBudget: commande.demandesBudget })}
                                    onChange={handleStatutChange}
                                    badgeClassName="text-sm px-3 py-1 bg-white/20 text-white hover:bg-white/30 border-0"
                                    triggerClassName="border-none bg-transparent! p-0 h-auto cursor-pointer w-auto"
                                    buttonClassName="h-8 text-xs bg-white text-[#ef0b53] hover:bg-white/90"
                                />
                            </div>
                            <p className="text-rose-100 text-sm mt-2">
                                Date :{" "}
                                <span className="text-white font-medium">
                                    {format(new Date(commande.dateCommande), "dd MMMM yyyy", { locale: fr })}
                                </span>
                            </p>
                            <p className="text-rose-100 text-sm">
                                Créé le :{" "}
                                <span className="text-white font-medium">
                                    {format(new Date(commande.createdAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Procédure de paiement : budget, liasse (BC signé, proforma fournisseur, BAT, livraison, facture, autres), paiements */}
            <CommandeLiasseCard commande={commande} onChange={fetchCommande} />

            {/* Informations Prestataire */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-[#ef0b53]">
                            <Building2 className="h-4 w-4" />
                            Informations {resolveTypeFournisseur(commande.fournisseur.typeFournisseur)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-lg font-bold text-gray-900">{commande.fournisseur.entreprise}</p>
                                {(commande.fournisseur.nom || commande.fournisseur.prenom) && (
                                    <p className="text-gray-600 text-sm mt-1">
                                        {commande.fournisseur.prenom} {commande.fournisseur.nom}
                                    </p>
                                )}
                                <p className="text-gray-500 text-sm mt-1 italic">{commande.fournisseur.domaineActivite}</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <MapPin className="h-4 w-4 text-[#ef0b53] flex-shrink-0" />
                                    <span>{commande.fournisseur.adresse}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Mail className="h-4 w-4 text-[#ef0b53] flex-shrink-0" />
                                    <span>{commande.fournisseur.email || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="h-4 w-4 text-[#ef0b53] flex-shrink-0" />
                                    <span>{commande.fournisseur.contact}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-[#ef0b53]">
                            <Building2 className="h-4 w-4" />
                            Notre Entreprise
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="font-bold text-gray-900">{entreprise?.nom ?? "Reseaupub"}</p>
                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-3.5 w-3.5 mt-0.5 text-[#ef0b53] flex-shrink-0" />
                                <span>{entreprise?.adresse}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-[#ef0b53] flex-shrink-0" />
                                <span>{entreprise?.telephone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-[#ef0b53] flex-shrink-0" />
                                <span>{entreprise?.emailFinance}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lignes de commande */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-[#ef0b53]">
                        <FileText className="h-4 w-4" />
                        Produits Commandés
                        <span className="ml-auto text-sm font-normal text-gray-500">
                            {commande.lignes.length} article{commande.lignes.length > 1 ? "s" : ""}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="pl-6">Désignation</TableHead>
                                    <TableHead className="text-center">Dimensions</TableHead>
                                    <TableHead className="text-center">Surface</TableHead>
                                    <TableHead className="text-center">Qté</TableHead>
                                    <TableHead className="text-right">Prix Unitaire</TableHead>
                                    <TableHead className="text-right pr-6">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {commande.lignes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-gray-400">
                                            Aucun produit dans cette commande.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    commande.lignes.map((ligne) => (
                                        <TableRow key={ligne.id} className="hover:bg-rose-50/30 transition-colors">
                                            <TableCell className="pl-6">
                                                <p className="font-medium text-gray-900">{ligne.designation}</p>
                                                <p className="text-xs text-gray-400">
                                                    {ligne.produitFournisseur.typeUnite.replace(/_/g, " ")}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-gray-600">
                                                {ligne.largeur && ligne.hauteur
                                                    ? `${ligne.largeur} × ${ligne.hauteur} cm`
                                                    : <span className="text-gray-300">—</span>}
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-gray-600">
                                                {ligne.surface
                                                    ? `${Number(ligne.surface).toFixed(2)} m²`
                                                    : <span className="text-gray-300">—</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-[#ef0b53] text-sm font-semibold">
                                                    {ligne.quantite}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-gray-600">
                                                {formatCurrency(Number(ligne.prixUnitaire))}
                                            </TableCell>
                                            <TableCell className="text-right pr-6 font-semibold text-gray-900">
                                                {formatCurrency(Number(ligne.prixTotal))}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Total */}
                    <Separator />
                    <div className="flex justify-end p-4 pr-6">
                        <div className="w-full sm:w-80 space-y-1.5 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Total HT</span>
                                <span>{formatCurrency(Number(commande.totalHT))}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>
                                    TVA (18%)
                                    {!commande.appliquerTva && <span className="text-xs italic text-gray-400"> — non appliquée</span>}
                                </span>
                                <span>{formatCurrency(Number(commande.tva))}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-gray-900 border-t pt-1.5">
                                <span>Total TTC</span>
                                <span>{formatCurrency(Number(commande.totalTTC))}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>
                                    AIB (3%) — déduite
                                    {!commande.appliquerAib && <span className="text-xs italic text-gray-400"> — non appliqué</span>}
                                </span>
                                <span>− {formatCurrency(Number(commande.montantAib))}</span>
                            </div>
                            <div className="bg-[#ef0b53] text-white rounded-lg px-6 py-3 text-right mt-2">
                                <p className="text-rose-100 text-xs uppercase tracking-wider mb-1">Montant Net</p>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(Number(commande.montantNet))}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Proformas associées */}
            {commande.proformas.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-[#ef0b53]">
                            <Receipt className="h-4 w-4" />
                            Proforma(s) associée(s)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {commande.proformas.map((p) => (
                            <div
                                key={p.invoice.id}
                                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-gray-50"
                            >
                                <div>
                                    <Link
                                        href={`/facture/${p.invoice.id}`}
                                        className="font-medium text-gray-900 hover:text-[#ef0b53] hover:underline"
                                    >
                                        {p.invoice.numero} — {p.invoice.objet}
                                    </Link>
                                    {p.invoice.client?.nom && (
                                        <p className="text-xs text-gray-500 mt-0.5">{p.invoice.client.nom}</p>
                                    )}
                                </div>
                                <FactureStatusBadge status={p.invoice.statut} />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <EditCommandeFournisseurModal
                commande={commande.statut === "BROUILLON" && isEditOpen ? commande : null}
                onClose={() => setIsEditOpen(false)}
                onSuccess={fetchCommande}
            />
        </div>
    );
}