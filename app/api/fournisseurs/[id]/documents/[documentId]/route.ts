import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

// DELETE /api/fournisseurs/[id]/documents/[documentId] - Supprimer un document d'un prestataire
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;

  try {
    const document = await prisma.fournisseurDocument.findUnique({ where: { id: documentId } });
    if (!document || document.fournisseurId !== id) {
      return NextResponse.json({ message: "Document introuvable" }, { status: 404 });
    }

    // Suppression best-effort du fichier physique : ne doit jamais faire échouer la requête
    // (ex. fichier déjà absent du disque).
    try {
      await unlink(path.join(process.cwd(), "public", document.url));
    } catch {
      // ignoré volontairement
    }

    await prisma.fournisseurDocument.delete({ where: { id: documentId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression du document ${documentId}:`, error);
    return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
  }
}
