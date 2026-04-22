import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";

// ✅ Schéma de validation
const paiementSchema = z.object({
  montant: z.number().positive("Le montant doit être un nombre positif."),
  methode: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  datePaiement: z.preprocess(
    (arg) =>
      typeof arg === "string" || arg instanceof Date
        ? new Date(arg)
        : undefined,
    z.date().optional(),
  ),
  cashRegisterId: z.number().optional(),
  type: z.enum(["PAIEMENT", "DEPENSE"]).default("PAIEMENT"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: invoiceId } = await params;
    const formData = await request.formData();

    const paymentDataString = formData.get("paymentData") as string;
    if (!paymentDataString) {
      return NextResponse.json(
        { error: "Payment data is missing" },
        { status: 400 },
      );
    }

    const paymentData = JSON.parse(paymentDataString);
    const files = formData.getAll("files") as File[];

    const validation = paiementSchema.safeParse(paymentData);
    if (!validation.success) {
      // ✅ Correction : remplacer formErrors par format()
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.format() },
        { status: 400 },
      );
    }

    const { montant, methode, cashRegisterId, type, ...rest } = validation.data;
    const montantDecimal = parseFloat(montant.toFixed(2));

    const finalCashRegisterId =
      methode === "Espèces" && type === "PAIEMENT" ? 1 : cashRegisterId;
    if (!finalCashRegisterId) {
      return NextResponse.json(
        { error: "L'ID de la caisse est requis pour cette opération." },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        resteAPayer: true,
        numero: true,
        objet: true,
        client: { select: { nom: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée." },
        { status: 404 },
      );
    }

    if (
      type === "PAIEMENT" &&
      montantDecimal > parseFloat(invoice.resteAPayer.toString())
    ) {
      return NextResponse.json(
        {
          error:
            "Le montant du paiement ne peut pas dépasser le reste à payer.",
        },
        { status: 400 },
      );
    }

    if (type === "DEPENSE") {
      const lastCashJournalEntry = await prisma.cashJournal.findFirst({
        where: { cashRegisterId: finalCashRegisterId },
        orderBy: { id: "desc" },
      });
      const currentBalance = lastCashJournalEntry
        ? lastCashJournalEntry.solde
        : 0;

      if (montantDecimal > currentBalance) {
        const cashRegister = await prisma.cashRegister.findUnique({
          where: { id: finalCashRegisterId },
        });
        return NextResponse.json(
          {
            error: `Solde insuffisant dans la caisse "${cashRegister?.name}". Solde actuel: ${currentBalance.toLocaleString("fr-FR")} FCFA.`,
          },
          { status: 400 },
        );
      }
    }

    const libelle = `${rest.reference || (type === "PAIEMENT" ? "Paiement" : "Dépense")} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`;
    const dateOperation = rest.datePaiement
      ? new Date(rest.datePaiement)
      : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const lastCashJournalEntry = await tx.cashJournal.findFirst({
        where: { cashRegisterId: finalCashRegisterId },
        orderBy: { id: "desc" },
      });
      const lastBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;
      const newBalance =
        type === "PAIEMENT"
          ? lastBalance + montantDecimal
          : lastBalance - montantDecimal;

      const newCashJournalEntry = await tx.cashJournal.create({
        data: {
          date_operation: dateOperation,
          libelle,
          type: type === "PAIEMENT" ? "RECETTE" : "DEPENSE",
          montant: montantDecimal,
          solde: newBalance,
          isApportDeCaisse: false,
          cashRegisterId: finalCashRegisterId,
        },
      });

      await tx.cashRegister.update({
        where: { id: finalCashRegisterId },
        data: { balance: newBalance },
      });

      await tx.paiement.create({
        data: {
          invoiceId,
          montant: montantDecimal,
          methode,
          type,
          ...rest,
          cashJournalEntryId: newCashJournalEntry.id,
        },
      });

      let updatedInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (type === "PAIEMENT") {
        const currentReste = parseFloat(updatedInvoice!.resteAPayer.toString());
        // ✅ Calcul avec arrondi pour éviter les résidus de virgule flottante
        let newResteAPayer = Math.round((currentReste - montantDecimal) * 100) / 100;
        
        // ✅ Pour le XOF (et par sécurité), si le reste est inférieur à 1, on considère que c'est soldé
        if (newResteAPayer < 1) {
          newResteAPayer = 0;
        }
        
        updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            resteAPayer: newResteAPayer,
            statut: newResteAPayer <= 0 ? "Solde" : "Payer",
          },
        });
      }

      return { updatedInvoice, newCashJournalEntryId: newCashJournalEntry.id };
    });

    if (files.length > 0) {
      const uploadDir = join(
        process.cwd(),
        "public",
        "Upload",
        "CashJournal",
        String(result.newCashJournalEntryId),
      );
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const path = join(uploadDir, file.name);
        await writeFile(path, buffer);

        const fileUrl = join(
          "/",
          "Upload",
          "CashJournal",
          String(result.newCashJournalEntryId),
          file.name,
        ).replace(/\\/g, "/");

        await prisma.cashJournalAttachment.create({
          data: {
            cashJournalId: result.newCashJournalEntryId,
            url: fileUrl,
            fileName: file.name,
            fileType: file.type,
          },
        });
      }
    }

    return NextResponse.json(result.updatedInvoice, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de l'ajout du paiement:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur interne est survenue.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
