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
    (arg) => (typeof arg === "string" || arg instanceof Date ? new Date(arg) : undefined),
    z.date().optional()
  ),
  cashRegisterId: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: invoiceId } = context.params;
    const formData = await request.formData();

    const paymentDataString = formData.get('paymentData') as string;
    if (!paymentDataString) {
      return NextResponse.json({ error: "Payment data is missing" }, { status: 400 });
    }
    const paymentData = JSON.parse(paymentDataString);
    const files = formData.getAll('files') as File[];

    // Validation with Zod
    const validation = paiementSchema.safeParse(paymentData);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.formErrors },
        { status: 400 }
      );
    }

    const { montant, methode, cashRegisterId, ...rest } = validation.data;
    const montantDecimal = parseFloat(montant.toFixed(2));

    const finalCashRegisterId = methode === 'Espèces' ? 1 : cashRegisterId;
    if (!finalCashRegisterId) {
      return NextResponse.json({ error: "Cash register ID is required for this payment method." }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { resteAPayer: true, numero: true, objet: true, client: { select: { nom: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvée." }, { status: 404 });
    }

    if (montantDecimal > parseFloat(invoice.resteAPayer.toString())) {
      return NextResponse.json(
        { error: "Le montant du paiement ne peut pas dépasser le reste à payer." },
        { status: 400 }
      );
    }

    const libelle = `${rest.reference || "Paiement"} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`;
    const dateOperation = rest.datePaiement ? new Date(rest.datePaiement) : new Date();

    // Transaction to ensure data integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current balance and create CashJournal entry
      const lastCashJournalEntry = await tx.cashJournal.findFirst({
        where: { cashRegisterId: finalCashRegisterId },
        orderBy: { id: "desc" },
      });
      const lastBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;
      const newBalance = lastBalance + montantDecimal;

      const newCashJournalEntry = await tx.cashJournal.create({
        data: {
          date_operation: dateOperation,
          libelle,
          type: "RECETTE",
          montant: montantDecimal,
          solde: newBalance,
          isApportDeCaisse: false,
          cashRegisterId: finalCashRegisterId,
        },
      });

      // 2. Update cash register balance
      await tx.cashRegister.update({
        where: { id: finalCashRegisterId },
        data: { balance: newBalance },
      });

      // 3. Create Paiement entry and link it to the cash journal entry
      await tx.paiement.create({
        data: {
          invoiceId,
          montant: montantDecimal,
          methode,
          ...rest,
          cashJournalEntryId: newCashJournalEntry.id,
        },
      });

      // 4. Update invoice
      const newResteAPayer = parseFloat(invoice.resteAPayer.toString()) - montantDecimal;
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          resteAPayer: newResteAPayer,
          statut: newResteAPayer <= 0 ? "Solde" : "Payer",
        },
      });

      return { updatedInvoice, newCashJournalEntryId: newCashJournalEntry.id };
    });

    // 5. Handle file uploads after the transaction is successful
    if (files.length > 0) {
      const uploadDir = join(process.cwd(), "public", "Upload", "CashJournal", String(result.newCashJournalEntryId));
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const path = join(uploadDir, file.name);
        await writeFile(path, buffer);

        const fileUrl = join("/", "Upload", "CashJournal", String(result.newCashJournalEntryId), file.name).replace(/\\/g, "/");

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
      error instanceof Error ? error.message : "Une erreur interne est survenue.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
