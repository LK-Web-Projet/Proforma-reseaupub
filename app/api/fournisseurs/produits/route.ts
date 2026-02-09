import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Assuming prisma client is exported from here
import { z } from "zod";

const productSchema = z.object({
    designation: z.string().min(1, "La désignation est requise"),
    description: z.string().optional(),
    prixUnitaire: z.number().min(0, "Le prix ne peut pas être négatif"),
    typeUnite: z.enum(["METRE_CARRE", "UNITE", "ROULEAU", "METRE_LINEAIRE", "FORFAIT"]),
    fournisseurId: z.string().min(1, "L'ID fournisseur est requis"),
});

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fournisseurId = searchParams.get("fournisseurId");

    console.log(`[API] Fetching products for fournisseurId: ${fournisseurId}`);

    if (!fournisseurId) {
        console.error("[API] Error: fournisseurId is missing");
        return NextResponse.json(
            { error: "fournisseurId is required" },
            { status: 400 }
        );
    }

    try {
        const products = await prisma.produitFournisseur.findMany({
            where: {
                fournisseurId: fournisseurId,
            },
            orderBy: {
                designation: 'asc',
            },
        });

        console.log(`[API] Successfully fetched ${products.length} products`);
        return NextResponse.json(products);
    } catch (error) {
        console.error("[API] Critical error fetching supplier products:", error);

        // Log the full error structure if it's an object
        if (typeof error === 'object' && error !== null) {
            console.error("[API] Full error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Error fetching products", details: errorMessage },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validatedData = productSchema.parse(body);

        const product = await prisma.produitFournisseur.create({
            data: validatedData,
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error creating supplier product:", error);
        return NextResponse.json(
            { error: "Error creating product", details: errorMessage },
            { status: 500 }
        );
    }
}
