import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveProduitFournisseurPhotos, describeFsError } from "@/lib/uploadProduitFournisseur";

// POST /api/fournisseurs/produits/[id]/photos - Ajouter une ou plusieurs photos à un produit existant
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const produit = await prisma.produitFournisseur.findUnique({ where: { id } });
        if (!produit) {
            return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
        }

        const formData = await request.formData();
        const photoFiles = formData.getAll("photos") as File[];
        if (photoFiles.length === 0) {
            return NextResponse.json({ error: "Aucune photo fournie" }, { status: 400 });
        }

        const savedPhotos = await saveProduitFournisseurPhotos(id, photoFiles);
        await prisma.produitFournisseurPhoto.createMany({
            data: savedPhotos.map((p) => ({ ...p, produitFournisseurId: id })),
        });

        const photos = await prisma.produitFournisseurPhoto.findMany({
            where: { produitFournisseurId: id },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(photos, { status: 201 });
    } catch (error) {
        const fsMessage = describeFsError(error);
        const errorMessage = fsMessage || (error instanceof Error ? error.message : "Unknown error");
        console.error("Error adding product photos:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'ajout des photos", details: errorMessage },
            { status: 500 }
        );
    }
}

// DELETE /api/fournisseurs/produits/[id]/photos?photoId=... - Supprimer une photo d'un produit
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");

    if (!photoId) {
        return NextResponse.json({ error: "photoId est requis" }, { status: 400 });
    }

    try {
        const photo = await prisma.produitFournisseurPhoto.findUnique({ where: { id: photoId } });
        if (!photo || photo.produitFournisseurId !== id) {
            return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
        }

        await prisma.produitFournisseurPhoto.delete({ where: { id: photoId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("Error deleting product photo:", error);
        return NextResponse.json({ error: "Erreur lors de la suppression de la photo" }, { status: 500 });
    }
}
