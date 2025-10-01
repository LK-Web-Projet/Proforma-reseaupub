
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paiementSchema = z.object({
  montant: z.number().positive("Le montant doit être un nombre positif."),
  methode: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  datePaiement: z.preprocess(
    (arg) => (typeof arg === 'string' || arg instanceof Date) ? new Date(arg) : undefined,
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

    const validation = paiementSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.formErrors },
        { status: 400 }
      );
    }

    const { montant, ...rest } = validation.data;

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Récupérer la facture pour vérifier le reste à payer actuel et son numéro
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          resteAPayer: true,
          numero: true,
          objet: true, // Added 'objet'
          client: { select: { nom: true } }, // Added client name
        },
      });

      if (!invoice) {
        throw new Error("Facture non trouvée.");
      }
      
      const montantDecimal = parseFloat(montant.toFixed(2));

      if (montantDecimal > parseFloat(invoice.resteAPayer.toString())) {
        throw new Error("Le montant du paiement ne peut pas dépasser le reste à payer.");
      }

      // 2. Créer le paiement
      await tx.paiement.create({
        data: {
          invoiceId: invoiceId,
          montant: montantDecimal,
          ...rest,
        },
      });

      // 3. Mettre à jour le reste à payer de la facture
      const newResteAPayer = parseFloat(invoice.resteAPayer.toString()) - montantDecimal;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          resteAPayer: newResteAPayer,
          // Optionnel: Mettre à jour le statut si le paiement est complet
          statut: newResteAPayer === 0 ? "Solde" : undefined, // Set to "Solde" if fully paid
        },
      });

      // 4. Si la méthode de paiement est "Espèces", ajouter une entrée au CashJournal
      if (rest.methode === "Espèces") {
        const libelle = `${rest.reference || "Paiement"} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`; // <--- Updated libelle
        // Get current date for date_operation
        const dateOperation = rest.datePaiement ? new Date(rest.datePaiement) : new Date();

        // Fetch the last entry for the cash register (ID 1) to get the last known balance
        const lastCashJournalEntry = await tx.cashJournal.findFirst({
          where: { cashRegisterId: 1 },
          orderBy: { id: 'desc' },
        });

        const lastBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;
        const newBalance = lastBalance + montantDecimal; // <--- Updated calculation

        await tx.cashJournal.create({
          data: {
            date_operation: dateOperation,
            libelle: libelle,
            type: "RECETTE",
            montant: montantDecimal,
            solde: newBalance, // Solde après cette opération
            isApportDeCaisse: false,
            cashRegisterId: 1, // Caisse Comptable
          },
        });

        // Update the cash register balance
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
    const errorMessage = error instanceof Error ? error.message : "Une erreur interne est survenue.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
