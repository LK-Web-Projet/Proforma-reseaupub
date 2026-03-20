import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ligneCommandeSchema = z.object({
    produitFournisseurId: z.string().min(1),
    quantite: z.number().int().min(1),
    largeur: z.number().min(0).optional(),
    hauteur: z.number().min(0).optional(),
    prixUnitaire: z.number().min(0),
    // designation est recupéré du produit, mais on peut le passer si on veut l'override (optionnel ici)
});

const commandeSchema = z.object({
    fournisseurId: z.string().min(1),
    dateCommande: z.string().datetime().optional(), // ISO string from frontend
    lignes: z.array(ligneCommandeSchema).min(1),
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fournisseurId = searchParams.get("fournisseurId");

    if (!fournisseurId) {
        return NextResponse.json(
            { error: "Fournisseur ID is required" },
            { status: 400 }
        );
    }

    try {
        const commandes = await prisma.commandeFournisseur.findMany({
            where: {
                fournisseurId: fournisseurId,
            },
            include: {
                lignes: true,
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

        // 1. Génération du numéro de commande (implémentation simple pour l'instant)
        const count = await prisma.commandeFournisseur.count();
        const year = new Date().getFullYear();
        const numero = `BCF-${year}-${String(count + 1).padStart(4, "0")}`;

        // 2. Calcul du total et préparation des lignes
        let totalHT = 0;

        // On récupère les infos produits pour être sûr (ou on fait confiance au front, ici on va vérifier/enrichir)
        // Pour simplifier, on suppose que le front envoie le prix, mais on pourrait le revérifier en base.
        // LE PLUS IMPORTANT : Le calcul de surface.

        const lignesToCreate = validatedData.lignes.map((ligne) => {
            let surface: number | null = null;
            let prixTotalLigne = 0;

            // Si largeur et hauteur sont fournies, on suppose que c'est un produit en m²
            // On pourrait vérifier le typeUnite du produit en base pour être plus robuste.
            if (ligne.largeur && ligne.hauteur) {
                surface = Number(ligne.largeur) * Number(ligne.hauteur);
                // Prix = Surface * Qté * PU (si le PU est au m²)
                // ATTENTION: La logique métier imprimerie peut varier.
                // Option A: PU est au m². Prix Total = Surface (m²) * Quantité (nb pièces) * PU
                // Option B: PU est à l'unité (pièce). Prix Total = Quantité * PU.

                // D'après le plan : "Si le produit est en m², calculer la surface... puis le prix (Surface * Quantité * PU)"
                // Donc on part sur l'hypothèse que le Prix Unitaire envoyé est le PRIX AU M².
                prixTotalLigne = surface * ligne.quantite * ligne.prixUnitaire;
            } else {
                // Produit standard (Unité, Rouleau, Forfait...)
                // Prix Total = Quantité * PU
                prixTotalLigne = ligne.quantite * ligne.prixUnitaire;
            }

            totalHT += prixTotalLigne;

            return {
                produitFournisseurId: ligne.produitFournisseurId,
                quantite: ligne.quantite,
                largeur: ligne.largeur,
                hauteur: ligne.hauteur,
                surface: surface,
                prixUnitaire: ligne.prixUnitaire,
                prixTotal: prixTotalLigne,
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


        // 4. Transaction Prisma
        const commande = await prisma.commandeFournisseur.create({
            data: {
                numero,
                dateCommande: validatedData.dateCommande || new Date(),
                fournisseurId: validatedData.fournisseurId,
                statut: "BROUILLON",
                totalHT: totalHT,
                lignes: {
                    create: lignesFinales
                }
            },
            include: {
                lignes: true
            }
        });

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
