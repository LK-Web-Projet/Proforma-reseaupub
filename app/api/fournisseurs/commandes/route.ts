import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendCommandeFournisseurCreeeNotification } from "@/lib/email/commandeFournisseur";

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
    appliquerTva: z.boolean().optional().default(false),
    appliquerAib: z.boolean().optional().default(false),
    proformaIds: z.array(z.string()).optional().default([]),
});

const TAUX_TVA = 0.18;
const TAUX_AIB = 0.03;

// Une proforma ne peut être associée à un bon de commande que si elle est confirmée
// côté client (validée, payée ou soldée) — pas un brouillon, une proforma envoyée,
// annulée ou archivée.
const STATUTS_PROFORMA_ASSOCIABLES = ["Valider", "Payer", "Solde"];

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

        // On récupère les infos produits pour être sûr (ou on fait confiance au front, ici on va vérifier/enrichir)
        // Pour simplifier, on suppose que le front envoie le prix, mais on pourrait le revérifier en base.
        // LE PLUS IMPORTANT : Le calcul de surface.

        const lignesToCreate = validatedData.lignes.map((ligne) => {
            let surface: number | null = null;
            let prixTotalLigne = 0;

            // Si largeur et hauteur sont fournies, on suppose que c'est un produit en m².
            // Les dimensions sont saisies en CENTIMÈTRES (usage métier imprimerie/bâche),
            // conversion géométrique standard en m² : (L×H)/10000 (1 m² = 100cm × 100cm).
            // Confirmé explicitement par l'utilisateur malgré un bon de commande papier réel
            // qui utilisait /1000 — ce document papier contenait une erreur de calcul.
            if (ligne.largeur && ligne.hauteur) {
                surface = (Number(ligne.largeur) * Number(ligne.hauteur)) / 10000;
                // Prix = Surface (m²) * Quantité (nb pièces) * PU (prix au m²)
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

        // 3bis. Calcul TVA (18%) et AIB (3%), chacun activable indépendamment.
        // Confirmé sur un bon de commande papier réel : le Total TTC = HT + TVA (l'AIB n'y entre PAS).
        // L'AIB se calcule sur le HT et se DÉDUIT du TTC pour obtenir le Montant Net,
        // qui est le montant réellement versé au fournisseur (l'AIB étant reversée aux impôts).
        const tva = validatedData.appliquerTva ? totalHT * TAUX_TVA : 0;
        const totalTTC = totalHT + tva;
        const montantAib = validatedData.appliquerAib ? totalHT * TAUX_AIB : 0;
        const montantNet = totalTTC - montantAib;

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
