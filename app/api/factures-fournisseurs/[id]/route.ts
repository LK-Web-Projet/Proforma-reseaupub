import { getDroits, peut, refusDroit } from "@/lib/authz";
import { isStatutFacture } from "@/lib/factureStatut";
import { appliquerStatutFacture, controlerStatutFacture, StatutFactureError } from "@/lib/factureStatutServeur";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, StatutFactureFournisseur } from "@prisma/client";
import { saveFactureFournisseurPieceJointe, describeFsError } from "@/lib/uploadFactureFournisseur";
import { refusMontantFactureCommande } from "@/lib/commandeFournisseurSuivi";

// PATCH /api/factures-fournisseurs/[id]
// - Corps JSON { status } : changement de statut sans pièce (mêmes règles et même historique que
//   POST /api/factures-fournisseurs/[id]/statut, qui est utilisé par l'écran ; « payée » sans paiement
//   exige une preuve et passe donc par cette route-là).
// - Corps FormData : édition complète (référence, montant, date, fournisseur, pièce jointe) ; le statut
//   ne s'y change plus (menu de statut, avec historique).
// Règle métier : une facture au statut "PAYEE" ou "ANNULEE" est verrouillée. La seule action
// encore possible est d'ajouter une pièce jointe si elle est absente.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("fournisseurs")) return refusDroit("fournisseurs.factureModifier");
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

      if (!isStatutFacture(status)) {
        return NextResponse.json({ message: "Statut inconnu." }, { status: 400 });
      }
      const utilisateur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });
      const auteur = { email: droits.email, nom: utilisateur?.nom ?? null, peut: (cle: string) => peut(droits, cle) };
      try {
        const updatedFacture = await prisma.$transaction(async (tx) => {
          const controle = await controlerStatutFacture(tx, id, { cible: status }, auteur);
          return appliquerStatutFacture(tx, controle, { cible: status }, auteur, null);
        });
        return NextResponse.json(updatedFacture);
      } catch (e) {
        if (e instanceof StatutFactureError) return NextResponse.json({ message: e.message }, { status: e.status });
        throw e;
      }
    }

    // Édition complète (FormData) : « Modifier une facture » (ajout de la pièce manquante compris).
    if (!peut(droits, "fournisseurs.factureModifier")) return refusDroit("fournisseurs.factureModifier");
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
    // Facture d'un bon de commande : son montant reste celui du bon.
    if (existing.commandeId && Math.abs(montantNumber - Number(existing.montant)) > 0.005) {
      const refusMontant = await refusMontantFactureCommande(prisma, { commandeId: existing.commandeId, montant: montantNumber, factureIdExclu: existing.id });
      if (refusMontant) return NextResponse.json({ message: refusMontant }, { status: 400 });
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
    // Le statut ne se change plus ici : menu de statut (droits, preuve du paiement, historique).
    if (status !== existing.status) {
      return NextResponse.json(
        { message: "Le statut se change depuis le menu de statut de la facture (il garde l'historique)." },
        { status: 400 },
      );
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
        // Nouvelle date ou autre prestataire : l'échéance change, le retard sera réévalué (et
        // renotifié s'il y a lieu) par la tâche du matin.
        ...(dateValue.getTime() !== existing.date.getTime() || fournisseurId !== existing.fournisseurId
          ? { retardNotifieAt: null }
          : {}),
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
