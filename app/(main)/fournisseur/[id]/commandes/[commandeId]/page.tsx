"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Download, Building2, Mail, Phone, MapPin, FileText } from "lucide-react";
import { StatutCommandeFournisseur } from "@prisma/client";

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
    email: string;
    contact: string;
    adresse: string;
    domaineActivite: string;
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

interface CommandeDetail {
    id: string;
    numero: string;
    dateCommande: string;
    statut: StatutCommandeFournisseur;
    totalHT: number;
    fournisseur: Fournisseur;
    lignes: LigneCommande[];
    createdAt: string;
}

const statutConfig: Record<StatutCommandeFournisseur, { label: string; variant: "secondary" | "success" | "brouillon" | "annuler" }> = {
    BROUILLON: { label: "Brouillon", variant: "brouillon" },
    VALIDEE: { label: "Validée", variant: "success" },
    LIVREE: { label: "Livrée", variant: "success" },
    ANNULEE: { label: "Annulée", variant: "annuler" },
};

const cleanText = (text: string) => {
    return text.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
};

const formatCurrency = (amount: number) => {
    return cleanText(new Intl.NumberFormat("fr-BJ", {
        style: "currency",
        currency: "XOF",
    }).format(amount));
};

async function generatePDF(commande: CommandeDetail, entreprise: EntrepriseConfig) {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    const colorPrimary = rgb(0.937, 0.043, 0.325); // #ef0b53
    const colorLight = rgb(1, 0.95, 0.96); // Rose très clair
    const colorGray = rgb(0.5, 0.5, 0.5);
    const colorBlack = rgb(0, 0, 0);
    const colorWhite = rgb(1, 1, 1);

    let y = height - 130;

    // ── En-tête avec infos émetteur ───────────────────────────────────────────
    page.drawRectangle({ x: 0, y, width, height: 130, color: colorPrimary });

    // Infos entreprise émettrice (droite)
    page.drawText(entreprise.nom.toUpperCase(), {
        x: width - 220,
        y: y + 90,
        size: 11,
        font: fontBold,
        color: colorWhite,
    });
    page.drawText(entreprise.adresse, {
        x: width - 220,
        y: y + 75,
        size: 8,
        font: fontRegular,
        color: colorWhite,
        opacity: 0.85,
    });
    page.drawText(`IFU : ${entreprise.ifu}`, {
        x: width - 220,
        y: y + 63,
        size: 8,
        font: fontRegular,
        color: colorWhite,
        opacity: 0.85,
    });
    page.drawText(`Tél : ${entreprise.telephone}`, {
        x: width - 220,
        y: y + 51,
        size: 8,
        font: fontRegular,
        color: colorWhite,
        opacity: 0.85,
    });
    page.drawText(`Email : ${entreprise.emailFinance}`, {
        x: width - 220,
        y: y + 39,
        size: 8,
        font: fontRegular,
        color: colorWhite,
        opacity: 0.85,
    });

    page.drawText("BON DE COMMANDE", {
        x: 40,
        y: y + 85,
        size: 18,
        font: fontBold,
        color: colorWhite,
    });
    page.drawText("FOURNISSEUR", {
        x: 40,
        y: y + 65,
        size: 14,
        font: fontBold,
        color: colorWhite,
        opacity: 0.9,
    });

    const dateStr = cleanText(format(new Date(commande.dateCommande), "dd MMMM yyyy", { locale: fr }));
    page.drawText(`N° ${commande.numero} | Date : ${dateStr}`, {
        x: 40,
        y: y + 40,
        size: 9,
        font: fontRegular,
        color: colorWhite,
        opacity: 0.85,
    });

    y -= 65;

    // ── Informations Fournisseur ───────────────────────────────────────────────
    page.drawRectangle({ x: 40, y: y - 80, width: width - 80, height: 95, color: colorLight });
    page.drawRectangle({ x: 40, y: y + 10, width: width - 80, height: 18, color: colorPrimary });

    page.drawText("FOURNISSEUR", {
        x: 50,
        y: y + 14,
        size: 9,
        font: fontBold,
        color: colorWhite,
    });

    y -= 5;

    page.drawText(commande.fournisseur.entreprise, {
        x: 50,
        y: y,
        size: 12,
        font: fontBold,
        color: colorBlack,
    });
    y -= 16;

    if (commande.fournisseur.nom || commande.fournisseur.prenom) {
        page.drawText(`${commande.fournisseur.prenom ?? ""} ${commande.fournisseur.nom ?? ""}`.trim(), {
            x: 50, y, size: 10, font: fontRegular, color: colorGray,
        });
        y -= 14;
    }

    page.drawText(commande.fournisseur.adresse, {
        x: 50, y, size: 10, font: fontRegular, color: colorGray,
    });
    y -= 14;
    page.drawText(commande.fournisseur.email, {
        x: 50, y, size: 10, font: fontRegular, color: colorGray,
    });
    y -= 14;
    page.drawText(`Tél : ${commande.fournisseur.contact}`, {
        x: 50, y, size: 10, font: fontRegular, color: colorGray,
    });

    y -= 80;

    // ── Tableau ────────────────────────────────────────────────────────────────
    const colX = [40, 210, 290, 350, 420, 490];
    const colHeaders = ["Désignation", "Dim. (L×H)", "Surface", "Qté", "PU", "Total"];
    const colWidths = [170, 80, 60, 60, 70, 65];

    // Header tableau
    page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 22, color: colorPrimary });
    colHeaders.forEach((h, i) => {
        page.drawText(h, {
            x: colX[i] + 4,
            y: y,
            size: 9,
            font: fontBold,
            color: colorWhite,
        });
    });

    y -= 25;

    // Lignes du tableau
    commande.lignes.forEach((ligne, idx) => {
        const rowBg = idx % 2 === 0 ? colorWhite : colorLight;
        page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 20, color: rowBg });

        const cells = [
            ligne.designation,
            ligne.largeur && ligne.hauteur ? `${ligne.largeur} × ${ligne.hauteur}` : "-",
            ligne.surface ? `${Number(ligne.surface).toFixed(2)} m²` : "-",
            ligne.quantite.toString(),
            formatCurrency(Number(ligne.prixUnitaire)),
            formatCurrency(Number(ligne.prixTotal)),
        ];

        cells.forEach((cell, i) => {
            page.drawText(cell, {
                x: colX[i] + 4,
                y: y,
                size: 9,
                font: fontRegular,
                color: colorBlack,
                maxWidth: colWidths[i] - 8,
            });
        });

        y -= 20;
    });

    // Ligne séparatrice
    page.drawRectangle({ x: 40, y: y + 10, width: width - 80, height: 1, color: colorPrimary });
    y -= 10;

    // Total HT
    page.drawRectangle({ x: width - 220, y: y - 6, width: 180, height: 26, color: colorPrimary });
    page.drawText("TOTAL HT :", {
        x: width - 212,
        y: y + 4,
        size: 10,
        font: fontBold,
        color: colorWhite,
    });
    page.drawText(formatCurrency(Number(commande.totalHT)), {
        x: width - 212 + fontBold.widthOfTextAtSize("TOTAL HT : ", 10),
        y: y + 4,
        size: 10,
        font: fontBold,
        color: colorWhite,
    });

    y -= 60;

    // ── Pied de page ──────────────────────────────────────────────────────────
    page.drawText(`Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, {
        x: 40,
        y: 30,
        size: 8,
        font: fontRegular,
        color: colorGray,
    });

    page.drawText(commande.numero, {
        x: width - 160,
        y: 30,
        size: 8,
        font: fontRegular,
        color: colorGray,
    });

    const pdfBytes = await doc.save();
    return pdfBytes;
}

export default function CommandeDetailPage() {
    const [commande, setCommande] = useState<CommandeDetail | null>(null);
    const [entreprise, setEntreprise] = useState<EntrepriseConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);
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
                email: "contact@reseaupub.com", 
                emailFinance: "finance@reseaupub.com",
                ifu: "0201710009974", 
                rccm: null, 
                nomDirecteur: "Directeur Général", 
                logoPath: "rplogo.png",
            };
            const pdfBytes = await generatePDF(commande, ent);
            const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
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

    const statut = statutConfig[commande.statut];

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
                <Button
                    onClick={handleDownloadPDF}
                    disabled={generatingPdf}
                    className="gap-2 bg-[#ef0b53] hover:bg-[#d10a48] text-white"
                >
                    <Download className="h-4 w-4" />
                    {generatingPdf ? "Génération..." : "Télécharger PDF"}
                </Button>
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
                            <Badge
                                variant={statut.variant}
                                className="text-sm px-3 py-1 mb-2 bg-white/20 text-white hover:bg-white/30 border-0"
                            >
                                {statut.label}
                            </Badge>
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

            {/* Informations Fournisseur */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-[#ef0b53]">
                            <Building2 className="h-4 w-4" />
                            Informations Fournisseur
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
                                    <span>{commande.fournisseur.email}</span>
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
                                                    ? `${ligne.largeur} × ${ligne.hauteur} m`
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
                        <div className="bg-[#ef0b53] text-white rounded-lg px-6 py-3 text-right min-w-[220px]">
                            <p className="text-rose-100 text-xs uppercase tracking-wider mb-1">Total HT</p>
                            <p className="text-2xl font-bold">
                                {formatCurrency(Number(commande.totalHT))}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
