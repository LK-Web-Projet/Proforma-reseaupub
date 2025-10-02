import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await request.json();

    // ✅ Validation avec Zod
    const validation = paiementSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.formErrors },
        { status: 400 }
      );
    }

    const { montant, ...rest } = validation.data;
    const montantDecimal = parseFloat(montant.toFixed(2));

    // ✅ Récupérer la facture avant transaction
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
      return NextResponse.json({ error: "Facture non trouvée." }, { status: 404 });
    }

    if (montantDecimal > parseFloat(invoice.resteAPayer.toString())) {
      return NextResponse.json(
        { error: "Le montant du paiement ne peut pas dépasser le reste à payer." },
        { status: 400 }
      );
    }

    // ✅ Préparer libellé et date avant transaction
    const libelle =
      rest.methode === "Espèces"
        ? `${rest.reference || "Paiement"} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`
        : undefined;

    const dateOperation = rest.datePaiement ? new Date(rest.datePaiement) : new Date();

    // ✅ Pré-calcul du nouveau solde caisse hors transaction
    let newBalance: number | undefined;
    if (rest.methode === "Espèces") {
      const lastCashJournalEntry = await prisma.cashJournal.findFirst({
        where: { cashRegisterId: 1 },
        orderBy: { id: "desc" },
      });
      const lastBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;
      newBalance = lastBalance + montantDecimal;
    }

    // ✅ Transaction allégée
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Créer le paiement
      await tx.paiement.create({
        data: {
          invoiceId,
          montant: montantDecimal,
          ...rest,
        },
      });

      // 2. Mettre à jour la facture
      const newResteAPayer = parseFloat(invoice.resteAPayer.toString()) - montantDecimal;
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          resteAPayer: newResteAPayer,
          statut: newResteAPayer === 0 ? "Solde" : "Payer",
        },
      });

      // 3. Journal + mise à jour caisse (si espèces)
      if (rest.methode === "Espèces" && newBalance !== undefined && libelle) {
        await tx.cashJournal.create({
          data: {
            date_operation: dateOperation,
            libelle,
            type: "RECETTE",
            montant: montantDecimal,
            solde: newBalance,
            isApportDeCaisse: false,
            cashRegisterId: 1,
          },
        });

        await tx.cashRegister.update({
          where: { id: 1 },
          data: { balance: newBalance },
        });
      }

      return updated;
    });

    return NextResponse.json(updatedInvoice, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de l'ajout du paiement:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Une erreur interne est survenue.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
