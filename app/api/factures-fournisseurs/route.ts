import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, StatutFactureFournisseur } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { saveFactureFournisseurPieceJointe, describeFsError } from "@/lib/uploadFactureFournisseur";
import { safeCreatedById } from "@/lib/authz";
import { exigeBonDeCommande } from "@/lib/typeFournisseur";
import { refusLigneBudgetCommande, refusMontantFactureCommande } from "@/lib/commandeFournisseurSuivi";

// GET /api/factures-fournisseurs - Récupérer toutes les factures fournisseurs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const fournisseurId = searchParams.get("fournisseurId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const year = searchParams.get("year");

    const where: Prisma.FactureFournisseurWhereInput = {};

    if (fournisseurId) {
      where.fournisseurId = fournisseurId;
    }

    if (status) {
      const parsedStatus = Object.values(StatutFactureFournisseur).find(
        (s) => s === status,
      );

      if (parsedStatus) {
        where.status = parsedStatus;
      }
    }

    if (year === "ALL") {
      // Aucun filtre de date : toutes les périodes.
    } else if (year) {
      const parsedYear = parseInt(year, 10);

      if (!Number.isNaN(parsedYear)) {
        where.date = {
          gte: new Date(parsedYear, 0, 1),
          lt: new Date(parsedYear + 1, 0, 1),
        };
      }
    } else if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};

      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }

      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }

      where.date = dateFilter;
    } else {
      const currentYear = new Date().getFullYear();

      where.date = {
        gte: new Date(currentYear, 0, 1),
        lt: new Date(currentYear + 1, 0, 1),
      };
    }

    const factures = await prisma.factureFournisseur.findMany({
      where,
      include: {
        fournisseur: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return NextResponse.json(factures, { status: 200 });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des factures fournisseurs:",
      error,
    );
    return NextResponse.json(
      { message: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

// POST /api/factures-fournisseurs - Créer une nouvelle facture fournisseur avec pièce jointe
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const formData = await req.formData();

    const file = formData.get("pieceJointe") as File | null;
    const reference = formData.get("reference") as string | null;
    const montant = formData.get("montant") as string | null;
    const date = formData.get("date") as string | null;
    const fournisseurId = formData.get("fournisseurId") as string | null;
    const statusValue = formData.get("status");
    // Bon de commande réglé par cette facture (facultatif) : il doit être du même prestataire.
    const commandeId = (formData.get("commandeId") as string | null) || null;
    // Prestataire interne / externe : rattachement direct (facultatif) à une ligne de budget.
    const ligneBudgetId = (formData.get("ligneBudgetId") as string | null) || null;

    const status =
      typeof statusValue === "string"
        ? (Object.values(StatutFactureFournisseur).find(
            (s) => s === statusValue,
          ) ?? StatutFactureFournisseur.EN_ATTENTE)
        : StatutFactureFournisseur.EN_ATTENTE;

    // Procédure de paiement : une facture ne naît jamais « payée » ; elle le devient quand une
    // dépense de budget (solde du bon de commande) la règle.
    if (status === StatutFactureFournisseur.PAYEE) {
      return NextResponse.json(
        { message: "Une facture fournisseur passe « payée » par le paiement de son solde (dépense de budget), pas à la saisie." },
        { status: 400 },
      );
    }

    // Facture d'un « Fournisseur » : bon de commande obligatoire (le solde du bon la passera
    // « payée »). Prestataire interne / externe : bon facultatif, rattachement possible à une ligne de
    // budget (ex. budget mensuel de la comptabilité pour la paie), réglée par des dépenses sur cette ligne.
    const prestataire = fournisseurId
      ? await prisma.fournisseur.findUnique({ where: { id: fournisseurId }, select: { typeFournisseur: true } })
      : null;
    if (exigeBonDeCommande(prestataire?.typeFournisseur) && !commandeId) {
      return NextResponse.json(
        { message: "Ce prestataire est un fournisseur : choisissez le bon de commande auquel répond cette facture." },
        { status: 400 },
      );
    }
    if (commandeId && ligneBudgetId) {
      return NextResponse.json(
        { message: "Une facture est rattachée soit à un bon de commande, soit à une ligne de budget, pas aux deux." },
        { status: 400 },
      );
    }
    if (ligneBudgetId) {
      const refusLigne = await refusLigneBudgetCommande(prisma, ligneBudgetId);
      if (refusLigne) return NextResponse.json({ message: refusLigne }, { status: 400 });
    }
    if (commandeId && fournisseurId) {
      const commande = await prisma.commandeFournisseur.findUnique({ where: { id: commandeId }, select: { fournisseurId: true, statut: true } });
      if (!commande || commande.fournisseurId !== fournisseurId) {
        return NextResponse.json({ message: "Ce bon de commande n'appartient pas à ce prestataire." }, { status: 400 });
      }
      if (commande.statut === "ANNULEE") {
        return NextResponse.json({ message: "Ce bon de commande est annulé." }, { status: 400 });
      }
    }

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

    // Facture d'un bon de commande : même montant que le bon, une seule facture active par bon.
    if (commandeId) {
      const refusMontant = await refusMontantFactureCommande(prisma, { commandeId, montant: montantNumber });
      if (refusMontant) return NextResponse.json({ message: refusMontant }, { status: 400 });
    }

    const existing = await prisma.factureFournisseur.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          message: `Une facture avec la référence "${reference}" existe déjà. Merci d'utiliser une référence unique.`,
        },
        { status: 409 },
      );
    }

    const pieceJointeUrl = file
      ? await saveFactureFournisseurPieceJointe(file)
      : null;
    const createdById = await safeCreatedById(prisma, userId);

    const newFacture = await prisma.factureFournisseur.create({
      data: {
        reference,
        montant: montantNumber,
        date: dateValue,
        fournisseurId,
        status,
        pieceJointe: pieceJointeUrl,
        createdById,
        commandeId,
        ligneBudgetId,
      },
    });

    return NextResponse.json(newFacture, { status: 201 });
  } catch (error) {
    console.error(
      "Erreur lors de la création de la facture fournisseur:",
      error,
    );

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
