import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { ActionBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { requirePage } from "@/lib/authz";
import { logBudget } from "@/lib/budgetSuivi";
import { refusDocumentLigne } from "@/lib/budgetPortee";
import { DOCUMENTS_LIGNE_TYPES } from "@/lib/demandeBudgetAttachmentTypes";
import { describeFsError, saveDemandeBudgetFiles, UploadRejectedError } from "@/lib/uploadDemandeBudget";

/**
 * Documents justificatifs d'une ligne d'un budget collectif (devis, facture, autre), pendant la
 * préparation : le département de la ligne les joint (POST, multipart : ligneId, kind, precision,
 * fichiers) ou les retire (DELETE ?documentId=). Mêmes droits que modifier la ligne
 * (refusDocumentLigne, lib/budgetPortee.ts). Jamais obligatoires.
 */

async function chargerBudgetEtLigne(id: string, ligneId: string) {
  const budget = await prisma.demandeBudget.findUnique({
    where: { id },
    select: { id: true, statut: true, collectif: true, requesterEmail: true, responsableEmail: true, dateLimiteSaisie: true, departementsInvites: { select: { departementId: true } } },
  });
  const ligne = budget
    ? await prisma.demandeBudgetLigne.findFirst({
        where: { id: ligneId, demandeBudgetId: id },
        select: { id: true, designation: true, montant: true, departementId: true, ajouteeParEmail: true, statutValidation: true },
      })
    : null;
  return { budget, ligne };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const refusPage = await requirePage("budget");
  if (refusPage) return refusPage;
  const { id } = await params;

  try {
    const formData = await request.formData();
    const ligneId = String(formData.get("ligneId") ?? "");
    const kind = String(formData.get("kind") ?? "");
    const precision = String(formData.get("precision") ?? "").trim();
    const fichiers = (formData.getAll("fichiers") as File[]).filter((f) => f && f.size > 0);

    if (!(DOCUMENTS_LIGNE_TYPES as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: "Choisissez le type de document." }, { status: 400 });
    }
    if (kind === "DEVIS" && !precision) {
      return NextResponse.json({ error: "Indiquez le fournisseur de cette proforma." }, { status: 400 });
    }
    if (fichiers.length === 0) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    if (fichiers.length > 10) return NextResponse.json({ error: "10 fichiers au plus à la fois." }, { status: 400 });

    const { budget, ligne } = await chargerBudgetEtLigne(id, ligneId);
    if (!budget) return NextResponse.json({ error: "Budget introuvable." }, { status: 404 });
    if (!ligne) return NextResponse.json({ error: "Cette ligne n'appartient pas à ce budget." }, { status: 404 });
    const refus = refusDocumentLigne(caps, budget, ligne);
    if (refus) return NextResponse.json({ error: refus }, { status: 403 });

    const enregistres = await saveDemandeBudgetFiles(
      id,
      fichiers,
      { date: new Date(), montant: Number(ligne.montant), kind },
      fichiers.map(() => (kind === "DEVIS" ? precision : ""))
    );
    await prisma.$transaction(async (tx) => {
      await tx.demandeBudgetAttachment.createMany({
        data: enregistres.map((f) => ({
          ...f,
          demandeBudgetId: id,
          kind: kind as (typeof DOCUMENTS_LIGNE_TYPES)[number],
          ligneId: ligne.id,
          ajouteParEmail: caps.email,
          ajouteParNom: caps.name,
        })),
      });
      await logBudget(tx, {
        demandeBudgetId: id,
        action: ActionBudget.DOCUMENTS,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        details: `Ligne « ${ligne.designation} » : ${enregistres.map((f) => f.fileName).join(", ")}`,
      });
    });
    return NextResponse.json({ success: true, message: enregistres.length === 1 ? "Document joint." : `${enregistres.length} documents joints.` });
  } catch (error) {
    if (error instanceof UploadRejectedError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(`Erreur lors de l'ajout d'un document de ligne au budget ${id} :`, error);
    const message = describeFsError(error) || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const refusPage = await requirePage("budget");
  if (refusPage) return refusPage;
  const { id } = await params;

  try {
    const documentId = request.nextUrl.searchParams.get("documentId") ?? "";
    const doc = await prisma.demandeBudgetAttachment.findFirst({ where: { id: documentId, demandeBudgetId: id } });
    if (!doc || !doc.ligneId) return NextResponse.json({ error: "Document introuvable sur les lignes de ce budget." }, { status: 404 });
    const { budget, ligne } = await chargerBudgetEtLigne(id, doc.ligneId);
    if (!budget || !ligne) return NextResponse.json({ error: "Ligne introuvable." }, { status: 404 });
    const refus = refusDocumentLigne(caps, budget, ligne);
    if (refus) return NextResponse.json({ error: refus }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      await tx.demandeBudgetAttachment.delete({ where: { id: doc.id } });
      await logBudget(tx, {
        demandeBudgetId: id,
        action: ActionBudget.DOCUMENTS,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        details: `Document retiré de la ligne « ${ligne.designation} » : ${doc.fileName}`,
      });
    });
    // Le fichier lui-même, s'il est bien dans le dossier de ce budget (sinon on le laisse).
    const prefixe = `/Upload/DemandeBudget/${id}/`;
    if (doc.url.startsWith(prefixe) && !doc.url.includes("..")) {
      await unlink(path.join(process.cwd(), "public", doc.url)).catch(() => undefined);
    }
    return NextResponse.json({ success: true, message: "Document retiré." });
  } catch (error) {
    console.error(`Erreur lors du retrait d'un document de ligne du budget ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
