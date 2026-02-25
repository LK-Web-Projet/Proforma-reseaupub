import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
            include: {
                fournisseur: true,
                lignes: {
                    include: {
                        produitFournisseur: true,
                    },
                },
            },
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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ commandeId: string }> }
) {
    const { commandeId } = await params;

    try {
        const body = await request.json();
        const { statut } = body;

        const updatedCommande = await prisma.commandeFournisseur.update({
            where: { id: commandeId },
            data: { statut },
            include: {
                fournisseur: true,
                lignes: {
                    include: {
                        produitFournisseur: true,
                    },
                },
            },
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
