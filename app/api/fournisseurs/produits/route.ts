import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Assuming prisma client is exported from here
import { z } from "zod";
import { saveProduitFournisseurPhotos, describeFsError } from "@/lib/uploadProduitFournisseur";
import { ALLOWED_IMAGE_EXTENSIONS, assertAllowedUpload } from "@/lib/uploadSecurity";

const productSchema = z.object({
    designation: z.string().min(1, "La désignation est requise"),
    description: z.string().optional(),
    prixUnitaire: z.coerce.number().min(0, "Le prix ne peut pas être négatif"),
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
            include: {
                photos: { orderBy: { createdAt: 'asc' } },
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
        const formData = await request.formData();

        const validatedData = productSchema.parse({
            designation: formData.get("designation"),
            description: formData.get("description") || undefined,
            prixUnitaire: formData.get("prixUnitaire"),
            typeUnite: formData.get("typeUnite"),
            fournisseurId: formData.get("fournisseurId"),
        });

        // Photos vérifiées AVANT la création : une photo refusée ne doit pas laisser un produit sans photo.
        const photosAVerifier = (formData.getAll("photos") as File[]).filter((f) => f && f.size > 0);
        try {
            photosAVerifier.forEach((f) => assertAllowedUpload(f, ALLOWED_IMAGE_EXTENSIONS));
        } catch (e) {
            return NextResponse.json({ error: e instanceof Error ? e.message : "Photo refusée." }, { status: 400 });
        }

        const product = await prisma.produitFournisseur.create({
            data: validatedData,
        });

        const photoFiles = formData.getAll("photos") as File[];
        if (photoFiles.length > 0) {
            const savedPhotos = await saveProduitFournisseurPhotos(product.id, photoFiles);
            await prisma.produitFournisseurPhoto.createMany({
                data: savedPhotos.map((p) => ({ ...p, produitFournisseurId: product.id })),
            });
        }

        const productWithPhotos = await prisma.produitFournisseur.findUnique({
            where: { id: product.id },
            include: { photos: { orderBy: { createdAt: 'asc' } } },
        });

        return NextResponse.json(productWithPhotos, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        const fsMessage = describeFsError(error);
        const errorMessage = fsMessage || (error instanceof Error ? error.message : "Unknown error");
        console.error("Error creating supplier product:", error);
        return NextResponse.json(
            { error: "Error creating product", details: errorMessage },
            { status: 500 }
        );
    }
}
