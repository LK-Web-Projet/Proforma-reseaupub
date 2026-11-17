import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getBudgetCapabilities } from "@/lib/budgetAuth";
import { requirePage } from "@/lib/authz";
import { computeLigne, computeTotaux, STATUTS_PROFORMA_ASSOCIABLES } from "@/lib/commandeFournisseurCalc";
import { StatutCommandeFournisseur } from "@prisma/client";
import { refusLigneBudgetCommande, TRANSITIONS_COMMANDE, validationAutomatiqueCommande } from "@/lib/commandeFournisseurSuivi";
import { etatLiasse } from "@/lib/commandeFournisseurLiasse";
import {
    sendCommandeEmiseNotification,
    sendCommandeFournisseurValideeNotification,
    sendCommandeScanAJoindreNotification,
} from "@/lib/email/commandeFournisseur";

const ligneCommandeSchema = z.object({
    produitFournisseurId: z.string().min(1),
    quantite: z.number().positive(),
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
    ligneBudgetId: z.string().nullable().optional(),
});

const commandeInclude = {
    fournisseur: true,
    lignes: {
        include: {
            produitFournisseur: true,
        },
    },
    proformas: { include: { invoice: { include: { client: true } } } },
    // Lot C : ligne de budget qui finance le bon, liasse, factures, avances et solde.
    ligneBudget: {
        select: {
            id: true,
            designation: true,
            demandeBudget: { select: { id: true, numero: true, type: true, statut: true } },
        },
    },
    documents: { orderBy: { createdAt: "asc" as const } },
    factures: { orderBy: { date: "asc" as const } },
    // Imputations des paiements (budget, proforma ou Camptrack) : payé par ligne de produit.
    imputations: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        ligneCommandeId: true,
        montant: true,
        nature: true,
        annuleeAt: true,
        cashJournalEntryId: true,
        factureFournisseurId: true,
        cashJournalEntry: { select: { date_operation: true, libelle: true, budgetDepense: { select: { demandeBudgetId: true } }, paiement: { select: { invoiceId: true } } } },
      },
    },
    depenses: {
        orderBy: { createdAt: "asc" as const },
        select: {
            id: true,
            montant: true,
            nature: true,
            dateDepense: true,
            nomReceveur: true,
            modePaiement: true,
            annuleeAt: true,
            demandeBudgetId: true,
            factureFournisseurId: true,
            cashJournalEntryId: true,
        },
    },
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

const patchSchema = z.object({
    statut: z.nativeEnum(StatutCommandeFournisseur).optional(),
    ligneBudgetId: z.string().nullable().optional(),
});

// PATCH /api/fournisseurs/commandes/[commandeId] — statut et/ou ligne de budget, section
// « Prestataires » requise. Statut : BROUILLON → VALIDEE → LIVREE, ANNULEE depuis BROUILLON ou
// VALIDEE (sans paiement), jamais de retour en arrière. Un brouillon rattaché à une ligne de budget
// ACCORDÉE est validé d'office (validationAutomatiqueCommande) ; sinon, VALIDEE = signé par la DG :
// réservé au droit « Valider les budgets mensuels » et seulement une fois le scan du BC signé joint.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ commandeId: string }> }
) {
    const { commandeId } = await params;
    const refusPage = await requirePage("fournisseurs");
    if (refusPage) return refusPage;
    const caps = await getBudgetCapabilities();
    if (!caps) {
        return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    try {
        const validation = patchSchema.safeParse(await request.json());
        if (!validation.success) {
            return NextResponse.json({ error: "Statut ou ligne de budget invalide." }, { status: 400 });
        }
        const { statut: nouveauStatut, ligneBudgetId } = validation.data;

        const actuelle = await prisma.commandeFournisseur.findUnique({
            where: { id: commandeId },
            // Paiements actifs = imputations non annulées (budget, proforma ou Camptrack).
            include: { documents: { select: { kind: true } }, imputations: { where: { annuleeAt: null }, select: { id: true } } },
        });
        if (!actuelle) {
            return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
        }

        const data: { statut?: StatutCommandeFournisseur; ligneBudgetId?: string | null } = {};
        let emisSurBudget = false;

        if (ligneBudgetId !== undefined && ligneBudgetId !== actuelle.ligneBudgetId) {
            if (actuelle.imputations.length > 0) {
                return NextResponse.json({ error: "Des paiements ont déjà été faits sur ce bon : sa ligne de budget ne peut plus changer." }, { status: 400 });
            }
            const refusLigne = await refusLigneBudgetCommande(prisma, ligneBudgetId);
            if (refusLigne) return NextResponse.json({ error: refusLigne }, { status: 400 });
            data.ligneBudgetId = ligneBudgetId;
            // Ligne accordée : contrôle de l'engagement, et un brouillon est validé d'office.
            const auto = await validationAutomatiqueCommande(prisma, { ligneBudgetId, montantNet: Number(actuelle.montantNet), commandeIdExclu: actuelle.id });
            if (auto.refus) return NextResponse.json({ error: auto.refus }, { status: 400 });
            if (auto.valider && actuelle.statut === StatutCommandeFournisseur.BROUILLON && !nouveauStatut) {
                data.statut = StatutCommandeFournisseur.VALIDEE;
                emisSurBudget = true;
            }
        }

        if (nouveauStatut && nouveauStatut !== actuelle.statut) {
            if (!TRANSITIONS_COMMANDE[actuelle.statut].includes(nouveauStatut)) {
                return NextResponse.json(
                    { error: `Passage de « ${actuelle.statut} » à « ${nouveauStatut} » non autorisé.` },
                    { status: 400 }
                );
            }
            if (nouveauStatut === StatutCommandeFournisseur.VALIDEE) {
                if (!caps.canValidateMensuel) {
                    return NextResponse.json({ error: "Seule la direction (signataire des bons de commande) peut valider un bon de commande." }, { status: 403 });
                }
                if (!etatLiasse(actuelle.documents).bcSigne) {
                    return NextResponse.json({ error: "Joignez d'abord le scan du bon de commande signé par la DG." }, { status: 400 });
                }
            }
            if (nouveauStatut === StatutCommandeFournisseur.ANNULEE && actuelle.imputations.length > 0) {
                return NextResponse.json({ error: "Ce bon a déjà des paiements : annulez d'abord les dépenses concernées." }, { status: 400 });
            }
            data.statut = nouveauStatut;
        }

        const updatedCommande = await prisma.commandeFournisseur.update({
            where: { id: commandeId },
            data,
            include: commandeInclude,
        });

        if (emisSurBudget) {
            sendCommandeEmiseNotification(updatedCommande).catch((err) =>
                console.error("Erreur lors de la notification de bon de commande émis:", err)
            );
            if (!etatLiasse(actuelle.documents).bcSigne) {
                sendCommandeScanAJoindreNotification(updatedCommande).catch((err) =>
                    console.error("Erreur lors du rappel de scan du bon de commande:", err)
                );
            }
        } else if (data.statut === StatutCommandeFournisseur.VALIDEE) {
            sendCommandeFournisseurValideeNotification(updatedCommande).catch((err) =>
                console.error("Erreur lors de la notification de bon de commande validé:", err)
            );
        }

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
    const refusPage = await requirePage("fournisseurs");
    if (refusPage) return refusPage;

    try {
        const commandeActuelle = await prisma.commandeFournisseur.findUnique({
            where: { id: commandeId },
            select: { statut: true, ligneBudgetId: true, documents: { select: { kind: true } } },
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
        const refusLigne = await refusLigneBudgetCommande(prisma, validatedData.ligneBudgetId);
        if (refusLigne) {
            return NextResponse.json({ error: refusLigne }, { status: 400 });
        }

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

        // Ligne de budget accordée : contrôle de l'engagement, et le brouillon est validé d'office.
        const ligneVisee = validatedData.ligneBudgetId !== undefined ? validatedData.ligneBudgetId : commandeActuelle.ligneBudgetId;
        const auto = await validationAutomatiqueCommande(prisma, { ligneBudgetId: ligneVisee, montantNet, commandeIdExclu: commandeId });
        if (auto.refus) {
            return NextResponse.json({ error: auto.refus }, { status: 400 });
        }

        const updatedCommande = await prisma.$transaction(async (tx) => {
            await tx.ligneCommandeFournisseur.deleteMany({ where: { commandeId } });
            await tx.commandeFournisseurProforma.deleteMany({ where: { commandeId } });

            return tx.commandeFournisseur.update({
                where: { id: commandeId },
                data: {
                    dateCommande: validatedData.dateCommande || undefined,
                    ...(validatedData.ligneBudgetId !== undefined ? { ligneBudgetId: validatedData.ligneBudgetId } : {}),
                    ...(auto.valider ? { statut: StatutCommandeFournisseur.VALIDEE } : {}),
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

        if (auto.valider) {
            sendCommandeEmiseNotification(updatedCommande).catch((err) =>
                console.error("Erreur lors de la notification de bon de commande émis:", err)
            );
            if (!etatLiasse(commandeActuelle.documents).bcSigne) {
                sendCommandeScanAJoindreNotification(updatedCommande).catch((err) =>
                    console.error("Erreur lors du rappel de scan du bon de commande:", err)
                );
            }
        }

        return NextResponse.json(updatedCommande);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error editing commande:", error);
        return NextResponse.json({ error: "Erreur lors de la modification du bon de commande" }, { status: 500 });
    }
}
