import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reponseMigrationManquante, requirePermission } from "@/lib/authz";
import { refusHorsPortee } from "@/lib/proformaPortee";
import { getEntrepriseConfig } from "@/lib/entreprise";
import { descriptionDocument, validerChampsDocument } from "@/lib/documentProformaServeur";
import { journaliserProforma } from "@/lib/proformaHistoriqueServeur";
import type { TypeDocumentProformaValue } from "@/lib/proformaPieces";

type Params = { params: Promise<{ id: string; documentId: string }> };

async function charger(invoiceId: string, documentId: string) {
  const doc = await prisma.documentProforma.findUnique({ where: { id: documentId } });
  return doc && doc.invoiceId === invoiceId ? doc : null;
}

/**
 * PATCH /api/factures/[id]/documents/[documentId] — compléter ou corriger une pièce (JSON) : précision
 * et, pour une facture normalisée, numéro, montant, dates d'émission et d'envoi, délai de relance.
 * Nouvelle date d'envoi ou nouveau délai : la relance sera recalculée (et renotifiée s'il y a lieu).
 */
export async function PATCH(request: Request, { params }: Params) {
  const droits = await requirePermission("proforma.pieces");
  if (droits instanceof NextResponse) return droits;
  const { id, documentId } = await params;
  const horsPortee = await refusHorsPortee(droits, id);
  if (horsPortee) return horsPortee;

  try {
    const doc = await charger(id, documentId);
    if (!doc) return NextResponse.json({ error: "Pièce introuvable." }, { status: 404 });
    const config = await getEntrepriseConfig();
    const champs = validerChampsDocument(doc.type as TypeDocumentProformaValue, await request.json(), config.delaiRelanceFactureClient);
    if ("erreur" in champs) return NextResponse.json({ error: champs.erreur }, { status: 400 });
    const auteur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });
    const relanceChange =
      (champs.dateEnvoiClient?.getTime() ?? null) !== (doc.dateEnvoiClient?.getTime() ?? null) || champs.delaiRelanceJours !== doc.delaiRelanceJours;

    const misAJour = await prisma.$transaction(async (tx) => {
      const d = await tx.documentProforma.update({
        where: { id: documentId },
        data: { ...champs, ...(relanceChange ? { relanceNotifieeAt: null } : {}) },
      });
      await journaliserProforma(
        tx,
        id,
        "PIECE_MODIFIEE",
        `${descriptionDocument(d.type, d)} (modifiée)`,
        { email: droits.email, nom: auteur?.nom },
        { documentId, avant: { dateEmission: doc.dateEmission, dateEnvoiClient: doc.dateEnvoiClient, delaiRelanceJours: doc.delaiRelanceJours } }
      );
      return d;
    });
    return NextResponse.json({ ...misAJour, montant: misAJour.montant === null ? null : Number(misAJour.montant) });
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la modification d'une pièce de la proforma :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/factures/[id]/documents/[documentId] — retirer une pièce. Le fichier reste sur le
 * disque (trace) et le retrait est noté dans l'historique de la proforma.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const droits = await requirePermission("proforma.pieces");
  if (droits instanceof NextResponse) return droits;
  const { id, documentId } = await params;
  const horsPortee = await refusHorsPortee(droits, id);
  if (horsPortee) return horsPortee;

  try {
    const doc = await charger(id, documentId);
    if (!doc) return NextResponse.json({ error: "Pièce introuvable." }, { status: 404 });
    const auteur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });
    await prisma.$transaction(async (tx) => {
      await tx.documentProforma.delete({ where: { id: documentId } });
      await journaliserProforma(tx, id, "PIECE_RETIREE", `${descriptionDocument(doc.type, doc)} retirée`, { email: droits.email, nom: auteur?.nom }, { documentId, type: doc.type, url: doc.url });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors du retrait d'une pièce de la proforma :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
