import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDroits, reponseMigrationManquante, requirePermission } from "@/lib/authz";
import { proformaDansPortee, refusHorsPortee } from "@/lib/proformaPortee";
import { getEntrepriseConfig } from "@/lib/entreprise";
import { isTypeDocumentProforma } from "@/lib/proformaPieces";
import { descriptionDocument, validerChampsDocument } from "@/lib/documentProformaServeur";
import { journaliserProforma } from "@/lib/proformaHistoriqueServeur";
import { saveDocumentProforma } from "@/lib/uploadDocumentProforma";
import { UploadRejectedError } from "@/lib/uploadSecurity";

/** Réponse commune : les pièces (plus récentes d'abord) et le délai de relance proposé. */
async function pieces(invoiceId: string) {
  const [documents, config] = await Promise.all([
    prisma.documentProforma.findMany({ where: { invoiceId }, orderBy: { createdAt: "desc" } }),
    getEntrepriseConfig(),
  ]);
  return {
    documents: documents.map((d) => ({ ...d, montant: d.montant === null ? null : Number(d.montant) })),
    delaiRelanceDefaut: config.delaiRelanceFactureClient,
  };
}

/** GET /api/factures/[id]/documents — pièces de la proforma (page Proforma, dans sa portée). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("proforma")) return NextResponse.json({ error: "La page Proforma n'est pas ouverte à votre rôle." }, { status: 403 });
  const { id } = await params;
  if (!(await proformaDansPortee(prisma, droits, id))) {
    return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
  }
  try {
    return NextResponse.json(await pieces(id));
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la lecture des pièces de la proforma :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * POST /api/factures/[id]/documents — ajouter une pièce (FormData : `type`, `file`, `precision` ;
 * pour une facture normalisée : `numeroFacture`, `montant`, `dateEmission`, `dateEnvoiClient`,
 * `delaiRelanceJours`). Droit « Joindre ou retirer des pièces ». Ne change jamais le statut de la
 * proforma (seuls l'argent reçu et les décisions des utilisateurs le font avancer).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("proforma.pieces");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;
  const horsPortee = await refusHorsPortee(droits, id);
  if (horsPortee) return horsPortee;

  try {
    const form = await request.formData();
    const type = form.get("type");
    if (!isTypeDocumentProforma(type)) return NextResponse.json({ error: "Sorte de pièce inconnue." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choisissez le fichier à joindre." }, { status: 400 });

    const config = await getEntrepriseConfig();
    const champs = validerChampsDocument(type, Object.fromEntries(form.entries()), config.delaiRelanceFactureClient);
    if ("erreur" in champs) return NextResponse.json({ error: champs.erreur }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({ where: { id }, select: { numero: true } });
    if (!invoice) return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });
    const auteur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });

    const fichier = await saveDocumentProforma(file, type, invoice.numero);
    await prisma.$transaction(async (tx) => {
      const doc = await tx.documentProforma.create({
        data: { invoiceId: id, type, ...fichier, ...champs, ajouteParEmail: droits.email, ajouteParNom: auteur?.nom ?? null },
      });
      await journaliserProforma(tx, id, "PIECE_AJOUTEE", `${descriptionDocument(type, doc)} ajoutée`, { email: droits.email, nom: auteur?.nom }, { documentId: doc.id, type, url: doc.url });
    });
    return NextResponse.json(await pieces(id), { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejectedError) return NextResponse.json({ error: error.message }, { status: 400 });
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de l'ajout d'une pièce à la proforma :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
