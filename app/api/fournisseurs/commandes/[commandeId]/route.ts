import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCurrentUserIdentity, isBudgetAdminEmail } from "@/lib/budgetAuth";
import { computeLigne, computeTotaux, STATUTS_PROFORMA_ASSOCIABLES } from "@/lib/commandeFournisseurCalc";
import type { StatutCommandeFournisseur } from "@prisma/client";

const ligneCommandeSchema = z.object({
    produitFournisseurId: z.string().min(1),
    quantite: z.number().int().min(1),
    largeur: z.number().min(0).optional(),
    hauteur: z.number().min(0).optional(),
    prixUnitaire: z.number().min(0),
});

const commandeUpdateSchema = z.object({
    dateCommande: z.string().datetime().optional(),
    lignes: z.array(ligneCommandeSchema).min(1),
    appliquerTva: z.boolean().optional().default(false),
    appliquerAib: z.boolean().optional().default(false),
    proformaIds: z.array(z.string()).optional().default([]),
});

const commandeInclude = {
    fournisseur: true,
    lignes: {
        include: {
            produitFournisseur: true,
        },
    },
    proformas: { include: { invoice: { include: { client: true } } } },
};

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ commandeId: string }> }
) {
    const { commandeId } = await params;

    if (!commandeId) {
        return NextResponse.json(
            { error: "Commande ID is required" },
            { status: 400 }
        );
    }

    try {
        const commande = await prisma.commandeFournisseur.findUnique({
            where: { id: commandeId },
            include: commandeInclude,
        });

        if (!commande) {
            return NextResponse.json(
                { error: "Commande not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(commande);
    } catch (error) {
        console.error("Error fetching commande details:", error);
        return NextResponse.json(
            { error: "Error fetching commande details" },
            { status: 500 }
        );
    }
}

// PATCH /api/fournisseurs/commandes/[commandeId] - Changer le statut d'un bon de commande.
// - Un admin (BUDGET_ADMIN_EMAILS) peut changer le statut librement, dans n'importe quel sens.
// - Un utilisateur non-admin ne peut faire qu'une seule transition : confirmer l'envoi
//   d'un bon VALIDEE, ce qui le passe à LIVREE.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ commandeId: string }> }
) {
    const { commandeId } = await params;

    const { email } = await getCurrentUserIdentity();
    if (!email) {
        return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    try {
        const body = await request.json();
        const nouveauStatut = body.statut as StatutCommandeFournisseur;

        const commandeActuelle = await prisma.commandeFournisseur.findUnique({
            where: { id: commandeId },
            select: { statut: true },
        });
        if (!commandeActuelle) {
            return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
        }

        const admin = isBudgetAdminEmail(email);
        const estConfirmationEnvoi =
            commandeActuelle.statut === "VALIDEE" && nouveauStatut === "LIVREE";

        if (!admin && !estConfirmationEnvoi) {
            return NextResponse.json(
                { error: "Seul un administrateur peut effectuer ce changement de statut." },
                { status: 403 }
            );
        }

        const updatedCommande = await prisma.commandeFournisseur.update({
            where: { id: commandeId },
            data: { statut: nouveauStatut },
            include: commandeInclude,
        });

        return NextResponse.json(updatedCommande);
    } catch (error) {
        console.error("Error updating commande:", error);
        return NextResponse.json(
            { error: "Error updating commande" },
            { status: 500 }
        );
    }
}

// PUT /api/fournisseurs/commandes/[commandeId] - Modifier un bon de commande (lignes, TVA/AIB,
// proformas associées, date) — uniquement tant que le bon est en BROUILLON.
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ commandeId: string }> }
) {
    const { commandeId } = await params;

    try {
        const commandeActuelle = await prisma.commandeFournisseur.findUnique({
            where: { id: commandeId },
            select: { statut: true },
        });
        if (!commandeActuelle) {
            return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
        }
        if (commandeActuelle.statut !== "BROUILLON") {
            return NextResponse.json(
                { error: "Seuls les bons de commande en brouillon peuvent être modifiés." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const validatedData = commandeUpdateSchema.parse(body);

        if (validatedData.proformaIds.length > 0) {
            const proformasValides = await prisma.invoice.findMany({
                where: { id: { in: validatedData.proformaIds } },
                select: { id: true, statut: true },
            });
            const introuvables = validatedData.proformaIds.filter(
                (id) => !proformasValides.some((p) => p.id === id)
            );
            const nonAssociables = proformasValides.filter(
                (p) => !STATUTS_PROFORMA_ASSOCIABLES.includes(p.statut)
            );
            if (introuvables.length > 0 || nonAssociables.length > 0) {
                return NextResponse.json(
                    { error: "Seules les proformas validées, payées ou soldées peuvent être associées à un bon de commande." },
                    { status: 400 }
                );
            }
        }

        let totalHT = 0;
        const lignesToCreate = validatedData.lignes.map((ligne) => {
            const { surface, prixTotal } = computeLigne(ligne);
            totalHT += prixTotal;
            return {
                produitFournisseurId: ligne.produitFournisseurId,
                quantite: ligne.quantite,
                largeur: ligne.largeur,
                hauteur: ligne.hauteur,
                surface,
                prixUnitaire: ligne.prixUnitaire,
                prixTotal,
            };
        });

        const produitIds = lignesToCreate.map((l) => l.produitFournisseurId);
        const produits = await prisma.produitFournisseur.findMany({
            where: { id: { in: produitIds } },
            select: { id: true, designation: true },
        });
        const produitsMap = new Map(produits.map((p) => [p.id, p.designation]));
        const lignesFinales = lignesToCreate.map((l) => ({
            ...l,
            designation: produitsMap.get(l.produitFournisseurId) || "Produit inconnu",
        }));

        const { tva, totalTTC, montantAib, montantNet } = computeTotaux(
            totalHT,
            validatedData.appliquerTva,
            validatedData.appliquerAib
        );

        const updatedCommande = await prisma.$transaction(async (tx) => {
            await tx.ligneCommandeFournisseur.deleteMany({ where: { commandeId } });
            await tx.commandeFournisseurProforma.deleteMany({ where: { commandeId } });

            return tx.commandeFournisseur.update({
                where: { id: commandeId },
                data: {
                    dateCommande: validatedData.dateCommande || undefined,
                    totalHT,
                    appliquerTva: validatedData.appliquerTva,
                    tva,
                    appliquerAib: validatedData.appliquerAib,
                    montantAib,
                    totalTTC,
                    montantNet,
                    lignes: { create: lignesFinales },
                    proformas: {
                        create: validatedData.proformaIds.map((invoiceId) => ({ invoiceId })),
                    },
                },
                include: commandeInclude,
            });
        });

        return NextResponse.json(updatedCommande);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error editing commande:", error);
        return NextResponse.json({ error: "Erreur lors de la modification du bon de commande" }, { status: 500 });
    }
}
