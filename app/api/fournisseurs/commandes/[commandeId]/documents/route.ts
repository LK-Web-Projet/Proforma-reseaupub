import { NextRequest, NextResponse } from "next/server";
import { TypeDocumentCommande } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePage, requirePermission } from "@/lib/authz";
import { getBudgetCapabilities, type BudgetCapabilities } from "@/lib/budgetAuth";
import { saveCommandeFiles } from "@/lib/uploadCommandeFournisseur";
import { describeFsError, UploadRejectedError } from "@/lib/uploadDemandeBudget";

const LIBELLE_MAX = 120;

/** Accès à la liasse : section « Prestataires », ou comptable / direction (qui classent les pièces). */
async function accesLiasse(): Promise<BudgetCapabilities | NextResponse> {
  const caps = await getBudgetCapabilities();
  if (!caps) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!caps.canPay && !caps.canValidateMensuel) {
    const refusPage = await requirePage("fournisseurs");
    if (refusPage) return refusPage;
  }
  return caps;
}

/**
 * Proformas fournisseur (pièces « Proforma fournisseur (devis) ») jointes au(x) budget(s) du bon :
 * celui de sa ligne de budget, et ceux de sa proforma client (budget non rejeté). Elles peuvent être
 * reprises dans la liasse du bon sans renvoyer le fichier.
 */
async function proformasFournisseurDuBudget(commandeId: string) {
  const commande = await prisma.commandeFournisseur.findUnique({
    where: { id: commandeId },
    select: {
      ligneBudget: { select: { demandeBudgetId: true } },
      proformas: { select: { invoiceId: true } },
      documents: { where: { kind: "PROFORMA_FOURNISSEUR" }, select: { url: true } },
    },
  });
  if (!commande) return null;
  const invoiceIds = commande.proformas.map((p) => p.invoiceId);
  const budgets = await prisma.demandeBudget.findMany({
    where: {
      OR: [
        ...(commande.ligneBudget ? [{ id: commande.ligneBudget.demandeBudgetId }] : []),
        ...(invoiceIds.length > 0 ? [{ proformas: { some: { invoiceId: { in: invoiceIds } } }, statut: { not: "REJETEE" as const } }] : []),
      ],
    },
    select: {
      id: true,
      numero: true,
      attachments: { where: { kind: "DEVIS" }, orderBy: { createdAt: "asc" }, select: { id: true, url: true, fileName: true, fileType: true, createdAt: true } },
    },
  });
  const dejaJointes = new Set(commande.documents.map((d) => d.url));
  const proformas = budgets.flatMap((b) =>
    b.attachments.map((a) => ({ ...a, budgetId: b.id, budgetNumero: b.numero, dejaJointe: dejaJointes.has(a.url) }))
  );
  return { budgets: budgets.map((b) => ({ id: b.id, numero: b.numero })), proformas };
}

/** GET — proformas fournisseur des budgets du bon, à reprendre dans sa liasse. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ commandeId: string }> }) {
  const { commandeId } = await params;
  const caps = await accesLiasse();
  if (caps instanceof NextResponse) return caps;
  const resultat = await proformasFournisseurDuBudget(commandeId);
  if (!resultat) return NextResponse.json({ error: "Bon de commande introuvable." }, { status: 404 });
  return NextResponse.json(resultat);
}

/**
 * POST /api/fournisseurs/commandes/[commandeId]/documents — ajoute des pièces à la liasse du bon :
 * - FormData { kind, fichiers[], libelle? } : envoi de fichiers (BC signé, proforma fournisseur, BAT
 *   signé, bordereau de livraison signé, attestation de service fait, facture, autre document —
 *   `libelle` obligatoire pour « Autre », pour préciser le document) ;
 * - FormData { kind: PROFORMA_FOURNISSEUR, attachmentId } : reprise d'une proforma fournisseur déjà
 *   jointe au budget du bon (même fichier, pas de nouvel envoi).
 * Le rapport n'est plus demandé. Les pièces ne sont jamais supprimées (trace).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ commandeId: string }> }) {
  const { commandeId } = await params;
  const caps = await accesLiasse();
  if (caps instanceof NextResponse) return caps;
  // Joindre des pièces : droit « Joindre des pièces » (Prestataires) ; le comptable et la direction
  // classent les pièces de la liasse sans ce droit, comme avant.
  if (!caps.canPay && !caps.canValidateMensuel) {
    const droits = await requirePermission("fournisseurs.commandePieces");
    if (droits instanceof NextResponse) return droits;
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
    if (kind === "RAPPORT") {
      return NextResponse.json({ error: "Le rapport n'est plus demandé : joignez-le comme « Autre document » en le précisant." }, { status: 400 });
    }
    const libelle = String(formData.get("libelle") ?? "").trim().slice(0, LIBELLE_MAX) || null;
    if (kind === "AUTRE" && !libelle) {
      return NextResponse.json({ error: "Précisez le document joint (ex. « Photos de la pose », « PV de réception »)." }, { status: 400 });
    }

    // Reprise d'une proforma fournisseur du budget.
    const attachmentId = String(formData.get("attachmentId") ?? "");
    if (attachmentId) {
      if (kind !== "PROFORMA_FOURNISSEUR") {
        return NextResponse.json({ error: "Seule une proforma fournisseur peut être reprise du budget." }, { status: 400 });
      }
      const resultat = await proformasFournisseurDuBudget(commandeId);
      const proforma = resultat?.proformas.find((p) => p.id === attachmentId);
      if (!proforma) {
        return NextResponse.json({ error: "Cette proforma fournisseur n'est pas jointe au budget de ce bon." }, { status: 400 });
      }
      if (proforma.dejaJointe) {
        return NextResponse.json({ error: "Cette proforma fournisseur est déjà dans la liasse du bon." }, { status: 400 });
      }
      await prisma.commandeFournisseurDocument.create({
        data: {
          commandeId,
          kind: "PROFORMA_FOURNISSEUR",
          url: proforma.url,
          fileName: proforma.fileName,
          fileType: proforma.fileType,
          libelle: `reprise du budget ${proforma.budgetNumero}`,
          createdByEmail: caps.email,
        },
      });
      return NextResponse.json({ success: true, count: 1 }, { status: 201 });
    }

    const fichiers = (formData.getAll("fichiers") as File[]).filter((f) => f && f.size > 0);
    if (fichiers.length === 0) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

    const saved = await saveCommandeFiles(commandeId, fichiers, kind, libelle ?? undefined);
    await prisma.commandeFournisseurDocument.createMany({
      data: saved.map((f) => ({ commandeId, kind: kind as TypeDocumentCommande, libelle, createdByEmail: caps.email, ...f })),
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
