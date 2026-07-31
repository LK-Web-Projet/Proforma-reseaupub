import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, StatutFactureFournisseur } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

    if (year) {
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
    const formData = await req.formData();

    const file = formData.get("pieceJointe") as File | null;
    const reference = formData.get("reference") as string | null;
    const montant = formData.get("montant") as string | null;
    const date = formData.get("date") as string | null;
    const fournisseurId = formData.get("fournisseurId") as string | null;
    const statusValue = formData.get("status");

    const status =
      typeof statusValue === "string"
        ? (Object.values(StatutFactureFournisseur).find(
            (s) => s === statusValue,
          ) ?? StatutFactureFournisseur.EN_ATTENTE)
        : StatutFactureFournisseur.EN_ATTENTE;

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

    let pieceJointeUrl: string | null = null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "Upload",
        "FactureFournisseur",
      );

      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);

      pieceJointeUrl = `/Upload/FactureFournisseur/${filename}`;
    }

    const newFacture = await prisma.factureFournisseur.create({
      data: {
        reference,
        montant: montantNumber,
        date: dateValue,
        fournisseurId,
        status,
        pieceJointe: pieceJointeUrl,
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

    return NextResponse.json(
      { message: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
