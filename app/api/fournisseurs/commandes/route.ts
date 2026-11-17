import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
    sendCommandeEmiseNotification,
    sendCommandeFournisseurCreeeNotification,
    sendCommandeScanAJoindreNotification,
} from "@/lib/email/commandeFournisseur";
import { computeLigne, computeTotaux, STATUTS_PROFORMA_ASSOCIABLES } from "@/lib/commandeFournisseurCalc";
import { requirePage } from "@/lib/authz";
import { Prisma } from "@prisma/client";
import { prochainNumeroCommande, refusCoherenceLigneProforma, refusLigneBudgetCommande, validationAutomatiqueCommande } from "@/lib/commandeFournisseurSuivi";

const UNE_SEULE_PROFORMA = "Un bon de commande n'est associé qu'à une seule proforma.";

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
    // Une seule proforma par bon (tableau conservé pour la compatibilité : 0 ou 1 élément).
    proformaIds: z.array(z.string()).optional().default([]),
    // Ligne de budget qui finance le bon (procédure : « les bons de commande sont émis à partir du budget »).
    ligneBudgetId: z.string().optional(),
});

// GET reste ouvert à tout utilisateur connecté : le formulaire de demande de budget liste les bons.
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
                // Pastille « scan signé manquant » dans la liste.
                documents: { where: { kind: "BC_SIGNE" }, select: { id: true } },
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

// POST — créer un bon de commande : réservé aux rôles ayant la section « Prestataires ».
export async function POST(request: Request) {
    const refusPage = await requirePage("fournisseurs");
    if (refusPage) return refusPage;
    try {
        const body = await request.json();
        const validatedData = commandeSchema.parse(body);

        if (validatedData.proformaIds.length > 1) {
            return NextResponse.json({ error: UNE_SEULE_PROFORMA }, { status: 400 });
        }
        const refusLigne =
            (await refusLigneBudgetCommande(prisma, validatedData.ligneBudgetId)) ??
            // Ligne facultative, mais d'un budget cohérent avec la proforma du bon.
            (await refusCoherenceLigneProforma(prisma, { ligneBudgetId: validatedData.ligneBudgetId, proformaId: validatedData.proformaIds[0] }));
        if (refusLigne) {
            return NextResponse.json({ error: refusLigne }, { status: 400 });
        }

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

        // 1. Le numéro (par année) est attribué au moment de la création, dans la transaction.

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

        // 3ter. Rattaché à une ligne de budget accordée : validé d'office (la ligne accordée vaut
        // accord de dépense), s'il tient dans ce qui reste à engager sur la ligne.
        const auto = await validationAutomatiqueCommande(prisma, { ligneBudgetId: validatedData.ligneBudgetId, montantNet });
        if (auto.refus) {
            return NextResponse.json({ error: auto.refus }, { status: 400 });
        }

        // 4. Création — numéro attribué dans la transaction ; un doublon simultané (contrainte
        // d'unicité) relance l'attribution.
        const creer = () => prisma.$transaction(async (tx) => tx.commandeFournisseur.create({
            data: {
                numero: await prochainNumeroCommande(tx),
                ligneBudgetId: validatedData.ligneBudgetId || null,
                dateCommande: validatedData.dateCommande || new Date(),
                fournisseurId: validatedData.fournisseurId,
                statut: auto.valider ? "VALIDEE" : "BROUILLON",
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
        }));
        let commande: Awaited<ReturnType<typeof creer>> | null = null;
        for (let essai = 0; essai < 3 && !commande; essai++) {
            try {
                commande = await creer();
            } catch (e) {
                const doublon = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
                if (!doublon || essai === 2) throw e;
            }
        }
        if (!commande) throw new Error("Impossible d'attribuer un numéro au bon de commande.");

        if (auto.valider) {
            // Émis pour exécution ; le scan signé reste à joindre (pas de paiement sans lui).
            sendCommandeEmiseNotification(commande).catch((err) =>
                console.error("Erreur lors de l'envoi de la notification de bon de commande émis:", err)
            );
            sendCommandeScanAJoindreNotification(commande).catch((err) =>
                console.error("Erreur lors de l'envoi du rappel de scan du bon de commande:", err)
            );
        } else {
            sendCommandeFournisseurCreeeNotification(commande).catch((err) =>
                console.error("Erreur lors de l'envoi de la notification de bon de commande créé:", err)
            );
        }

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
