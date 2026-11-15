import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, StatutFactureFournisseur } from "@prisma/client";
import { saveFactureFournisseurPieceJointe, describeFsError } from "@/lib/uploadFactureFournisseur";

/**
 * Procédure de paiement (Lot C) : une facture fournisseur passe PAYEE uniquement quand une dépense
 * de budget (solde du bon de commande) la règle — jamais à la main ; on ne l'annule pas tant
 * qu'un paiement actif la règle. Renvoie le motif du refus, ou null.
 */
async function refusChangementStatut(id: string, actuel: StatutFactureFournisseur, nouveau: StatutFactureFournisseur): Promise<string | null> {
  if (nouveau === actuel) return null;
  if (nouveau === StatutFactureFournisseur.PAYEE) {
    return "Une facture fournisseur passe « payée » par le paiement de son solde (dépense de budget sur le bon de commande), pas à la main.";
  }
  if (nouveau === StatutFactureFournisseur.ANNULEE) {
    const paiements = await prisma.budgetDepense.count({ where: { factureFournisseurId: id, annuleeAt: null } });
    if (paiements > 0) return "Cette facture a été réglée par une dépense : annulez d'abord la dépense.";
  }
  return null;
}

// PATCH /api/factures-fournisseurs/[id]
// - Corps JSON { status } : changement rapide du statut (utilisé par le sélecteur inline des listes).
// - Corps FormData : édition complète (référence, montant, date, fournisseur, statut, pièce jointe).
// Règle métier : une facture au statut "PAYEE" ou "ANNULEE" est verrouillée. La seule action
// encore possible est d'ajouter une pièce jointe si elle est absente.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const existing = await prisma.factureFournisseur.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Facture non trouvée" },
        { status: 404 },
      );
    }

    const isLocked =
      existing.status === StatutFactureFournisseur.PAYEE ||
      existing.status === StatutFactureFournisseur.ANNULEE;
    const lockedStatusLabel =
      existing.status === StatutFactureFournisseur.ANNULEE ? "annulée" : "payée";
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      // Changement de statut rapide (JSON)
      const { status } = await req.json();

      if (!status) {
        return NextResponse.json(
          { message: "Le statut est requis." },
          { status: 400 },
        );
      }

      if (isLocked) {
        return NextResponse.json(
          {
            message: `Cette facture est ${lockedStatusLabel} et ne peut plus être modifiée.`,
          },
          { status: 403 },
        );
      }
      const refusStatut = await refusChangementStatut(id, existing.status, status);
      if (refusStatut) {
        return NextResponse.json({ message: refusStatut }, { status: 400 });
      }

      const updatedFacture = await prisma.factureFournisseur.update({
        where: { id },
        data: { status },
      });

      return NextResponse.json(updatedFacture);
    }

    // Édition complète (FormData)
    const formData = await req.formData();
    const file = formData.get("pieceJointe") as File | null;

    if (isLocked) {
      if (existing.pieceJointe) {
        return NextResponse.json(
          {
            message: `Cette facture est ${lockedStatusLabel} et possède déjà une pièce jointe : plus aucune modification n'est possible.`,
          },
          { status: 403 },
        );
      }

      if (!file) {
        return NextResponse.json(
          {
            message: `Cette facture est ${lockedStatusLabel} : seul l'ajout de la pièce jointe manquante est autorisé.`,
          },
          { status: 403 },
        );
      }

      const pieceJointeUrl = await saveFactureFournisseurPieceJointe(file);
      const updatedFacture = await prisma.factureFournisseur.update({
        where: { id },
        data: { pieceJointe: pieceJointeUrl },
      });

      return NextResponse.json(updatedFacture);
    }

    const reference = formData.get("reference") as string | null;
    const montant = formData.get("montant") as string | null;
    const date = formData.get("date") as string | null;
    const fournisseurId = formData.get("fournisseurId") as string | null;
    const statusValue = formData.get("status") as string | null;

    if (!reference || !montant || !date || !fournisseurId) {
      return NextResponse.json(
        {
          message:
            "Les champs référence, montant, date et fournisseur sont requis.",
        },
        { status: 400 },
      );
    }

    const montantNumber = parseFloat(montant);
    if (Number.isNaN(montantNumber)) {
      return NextResponse.json(
        { message: "Le montant saisi est invalide." },
        { status: 400 },
      );
    }

    const dateValue = new Date(date);
    if (Number.isNaN(dateValue.getTime())) {
      return NextResponse.json(
        { message: "La date saisie est invalide." },
        { status: 400 },
      );
    }

    const status =
      statusValue &&
      Object.values(StatutFactureFournisseur).find((s) => s === statusValue)
        ? (statusValue as StatutFactureFournisseur)
        : existing.status;
    const refusStatut = await refusChangementStatut(id, existing.status, status);
    if (refusStatut) {
      return NextResponse.json({ message: refusStatut }, { status: 400 });
    }

    if (reference !== existing.reference) {
      const duplicate = await prisma.factureFournisseur.findUnique({
        where: { reference },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            message: `Une facture avec la référence "${reference}" existe déjà.`,
          },
          { status: 409 },
        );
      }
    }

    const pieceJointeUrl = file
      ? await saveFactureFournisseurPieceJointe(file)
      : existing.pieceJointe;

    const updatedFacture = await prisma.factureFournisseur.update({
      where: { id },
      data: {
        reference,
        montant: montantNumber,
        date: dateValue,
        fournisseurId,
        status,
        pieceJointe: pieceJointeUrl,
      },
    });

    return NextResponse.json(updatedFacture);
  } catch (error: unknown) {
    console.error(`Erreur lors de la mise à jour de la facture ${id}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: "Une facture avec cette référence existe déjà." },
          { status: 409 },
        );
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { message: "Le fournisseur sélectionné est introuvable." },
          { status: 400 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Facture non trouvée" },
          { status: 404 },
        );
      }
    }

    const fsMessage = describeFsError(error);
    if (fsMessage) {
      return NextResponse.json({ message: fsMessage }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
