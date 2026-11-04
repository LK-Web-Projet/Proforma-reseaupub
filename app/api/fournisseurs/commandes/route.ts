import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendCommandeFournisseurCreeeNotification } from "@/lib/email/commandeFournisseur";
import { computeLigne, computeTotaux, STATUTS_PROFORMA_ASSOCIABLES } from "@/lib/commandeFournisseurCalc";

const ligneCommandeSchema = z.object({
    produitFournisseurId: z.string().min(1),
    quantite: z.number().positive(),
    largeur: z.number().min(0).optional(),
    hauteur: z.number().min(0).optional(),
    prixUnitaire: z.number().min(0),
    // designation est recupéré du produit, mais on peut le passer si on veut l'override (optionnel ici)
});

const commandeSchema = z.object({
    fournisseurId: z.string().min(1),
    dateCommande: z.string().datetime().optional(), // ISO string from frontend
    lignes: z.array(ligneCommandeSchema).min(1),
    appliquerTva: z.boolean().optional().default(false),
    appliquerAib: z.boolean().optional().default(false),
    proformaIds: z.array(z.string()).optional().default([]),
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fournisseurId = searchParams.get("fournisseurId");
    const statut = searchParams.get("statut");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: { [key: string]: any } = {};
    if (fournisseurId) where.fournisseurId = fournisseurId;
    if (statut) where.statut = statut;

    try {
        const commandes = await prisma.commandeFournisseur.findMany({
            where,
            include: {
                fournisseur: true,
                lignes: true,
                proformas: { include: { invoice: { include: { client: true } } } },
            },
            orderBy: {
                dateCommande: "desc",
            },
        });

        return NextResponse.json(commandes);
    } catch (error) {
        console.error("Error fetching supplier orders:", error);
        return NextResponse.json(
            { error: "Error fetching orders" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = commandeSchema.parse(body);

        // 0. Vérification des proformas associées : doivent exister et être dans un
        // statut confirmé côté client (validée, payée ou soldée).
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

        // 1. Génération du numéro de commande (implémentation simple pour l'instant)
        const count = await prisma.commandeFournisseur.count();
        const year = new Date().getFullYear();
        const numero = `BCF-${year}-${String(count + 1).padStart(4, "0")}`;

        // 2. Calcul du total et préparation des lignes
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
                // On devra récupérer la désignation, on le fera dans la transaction ou juste avant
            };
        });

        // 3. Récupération des désignations produits (pour figer l'historique)
        // On fait une requête pour mapper les IDs aux noms
        const produitIds = lignesToCreate.map(l => l.produitFournisseurId);
        const produits = await prisma.produitFournisseur.findMany({
            where: { id: { in: produitIds } },
            select: { id: true, designation: true }
        });

        const produitsMap = new Map(produits.map(p => [p.id, p.designation]));

        const lignesFinales = lignesToCreate.map(l => ({
            ...l,
            designation: produitsMap.get(l.produitFournisseurId) || "Produit inconnu"
        }));

        // 3bis. Calcul TVA (18%) et AIB (3%), chacun activable indépendamment.
        const { tva, totalTTC, montantAib, montantNet } = computeTotaux(
            totalHT,
            validatedData.appliquerTva,
            validatedData.appliquerAib
        );

        // 4. Transaction Prisma
        const commande = await prisma.commandeFournisseur.create({
            data: {
                numero,
                dateCommande: validatedData.dateCommande || new Date(),
                fournisseurId: validatedData.fournisseurId,
                statut: "BROUILLON",
                totalHT: totalHT,
                appliquerTva: validatedData.appliquerTva,
                tva,
                appliquerAib: validatedData.appliquerAib,
                montantAib,
                totalTTC,
                montantNet,
                lignes: {
                    create: lignesFinales
                },
                proformas: {
                    create: validatedData.proformaIds.map((invoiceId) => ({ invoiceId })),
                },
            },
            include: {
                lignes: true,
                proformas: { include: { invoice: { include: { client: true } } } },
                fournisseur: true,
            }
        });

        sendCommandeFournisseurCreeeNotification(commande).catch((err) =>
            console.error("Erreur lors de l'envoi de la notification de bon de commande créé:", err)
        );

        return NextResponse.json(commande, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues}, { status: 400 });
        }
        console.error("Error creating supplier order:", error);
        return NextResponse.json(
            { error: "Error creating order" },
            { status: 500 }
        );
    }
}
