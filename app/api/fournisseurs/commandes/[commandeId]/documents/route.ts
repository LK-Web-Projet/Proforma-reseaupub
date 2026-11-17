import { NextRequest, NextResponse } from "next/server";
import { TypeDocumentCommande } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePage } from "@/lib/authz";
import { getBudgetCapabilities } from "@/lib/budgetAuth";
import { saveCommandeFiles } from "@/lib/uploadCommandeFournisseur";
import { describeFsError, UploadRejectedError } from "@/lib/uploadDemandeBudget";

/**
 * POST /api/fournisseurs/commandes/[commandeId]/documents — FormData { kind, fichiers[] } : ajoute
 * des pièces à la liasse du bon (BC signé, bordereau, attestation de service fait, facture,
 * rapport). Section « Prestataires », ou comptable / direction (qui classent les pièces).
 * Les pièces ne sont jamais supprimées (trace).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ commandeId: string }> }) {
  const { commandeId } = await params;
  const caps = await getBudgetCapabilities();
  if (!caps) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!caps.canPay && !caps.canValidateMensuel) {
    const refusPage = await requirePage("fournisseurs");
    if (refusPage) return refusPage;
  }

  try {
    const commande = await prisma.commandeFournisseur.findUnique({ where: { id: commandeId }, select: { id: true, statut: true } });
    if (!commande) return NextResponse.json({ error: "Bon de commande introuvable." }, { status: 404 });
    if (commande.statut === "ANNULEE") {
      return NextResponse.json({ error: "Ce bon de commande est annulé." }, { status: 400 });
    }

    const formData = await request.formData();
    const kind = formData.get("kind") as string;
    if (!Object.values(TypeDocumentCommande).includes(kind as TypeDocumentCommande)) {
      return NextResponse.json({ error: "Type de pièce invalide." }, { status: 400 });
    }
    const fichiers = (formData.getAll("fichiers") as File[]).filter((f) => f && f.size > 0);
    if (fichiers.length === 0) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

    const saved = await saveCommandeFiles(commandeId, fichiers, kind);
    await prisma.commandeFournisseurDocument.createMany({
      data: saved.map((f) => ({ commandeId, kind: kind as TypeDocumentCommande, createdByEmail: caps.email, ...f })),
    });
    return NextResponse.json({ success: true, count: saved.length }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de l'ajout de pièces au bon de commande ${commandeId}:`, error);
    const message = describeFsError(error) || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
