import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { safeCreatedById } from "@/lib/authz";
import { saveFournisseurDocuments, describeFsError } from "@/lib/uploadFournisseurDocument";

// GET /api/fournisseurs/[id]/documents - Liste des documents d'un prestataire
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const documents = await prisma.fournisseurDocument.findMany({
      where: { fournisseurId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { nom: true } } },
    });
    return NextResponse.json(documents);
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération des documents du prestataire ${id}:`, error);
    return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
  }
}

// POST /api/fournisseurs/[id]/documents - Ajouter un ou plusieurs documents (même type)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { userId } = await auth();
    const formData = await req.formData();
    const type = (formData.get("type") as string | null)?.trim();
    const files = formData.getAll("files") as File[];

    if (!type) {
      return NextResponse.json({ message: "Le type de document est requis." }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ message: "Aucun fichier fourni." }, { status: 400 });
    }

    const fournisseur = await prisma.fournisseur.findUnique({ where: { id }, select: { id: true } });
    if (!fournisseur) {
      return NextResponse.json({ message: "Prestataire non trouvé" }, { status: 404 });
    }

    const saved = await saveFournisseurDocuments(id, files);
    const createdById = await safeCreatedById(prisma, userId);
    await prisma.fournisseurDocument.createMany({
      data: saved.map((f) => ({ ...f, fournisseurId: id, type, createdById })),
    });

    const documents = await prisma.fournisseurDocument.findMany({
      where: { fournisseurId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { nom: true } } },
    });
    return NextResponse.json(documents, { status: 201 });
  } catch (error) {
    console.error(`[API] Erreur lors de l'ajout d'un document pour le prestataire ${id}:`, error);
    const fsMessage = describeFsError(error);
    return NextResponse.json(
      { message: fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur") },
      { status: 500 },
    );
  }
}
