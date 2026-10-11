import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const productUpdateSchema = z.object({
    designation: z.string().min(1, "La désignation est requise"),
    description: z.string().optional(),
    prixUnitaire: z.coerce.number().min(0, "Le prix ne peut pas être négatif"),
    typeUnite: z.enum(["METRE_CARRE", "UNITE", "ROULEAU", "METRE_LINEAIRE", "FORFAIT"]),
});

// PUT /api/fournisseurs/produits/[id] - Modifier un produit existant
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const body = await request.json();
        const validatedData = productUpdateSchema.parse(body);

        const product = await prisma.produitFournisseur.update({
            where: { id },
            data: validatedData,
            include: { photos: { orderBy: { createdAt: "asc" } } },
        });

        return NextResponse.json(product);
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        const err = error as { code?: string };
        if (err.code === "P2025") {
            return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
        }
        console.error("Error updating supplier product:", error);
        return NextResponse.json({ error: "Erreur lors de la modification du produit" }, { status: 500 });
    }
}
