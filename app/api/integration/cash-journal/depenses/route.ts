import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { recordCashMovement } from "@/lib/cashJournal";
import { recordDepensePaiement } from "@/lib/paiements";
import { OperationType } from "@prisma/client";
import { z } from "zod";

const depenseSchema = z.object({
  cashRegisterId: z.number().int(),
  montant: z.number().positive(),
  libelle: z.string().min(1, "Le libellé est requis."),
  date_operation: z.string().datetime().optional(),
  // Id de la proforma (Invoice) liée, si la dépense provient d'une campagne elle-même
  // rattachée à une proforma côté app appelante (Campagne.id_proforma). Optionnel.
  proformaId: z.string().optional(),
});

// POST /api/integration/cash-journal/depenses
// Enregistre une DEPENSE dans la caisse choisie par l'utilisateur côté app appelante
// (campagnes). Le type est volontairement fixé à DEPENSE côté serveur : cet endpoint
// ne permet ni RECETTE ni TRANSFERT.
//
// Si `proformaId` est fourni et correspond à une proforma existante, la dépense est
// enregistrée comme un Paiement (type DEPENSE) rattaché à cette facture, avec UNE SEULE
// écriture dans le journal de caisse (voir lib/paiements.ts). Si `proformaId` est absent,
// ou ne correspond à aucune facture, la dépense reste une simple écriture de caisse
// (repli silencieux, aucune erreur renvoyée à l'app appelante dans ce cas).
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const validation = depenseSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 }
    );
  }

  const { cashRegisterId, montant, libelle, date_operation, proformaId } = validation.data;
  const dateOperation = date_operation ? new Date(date_operation) : new Date();

  try {
    const cashRegister = await prisma.cashRegister.findUnique({
      where: { id: cashRegisterId },
    });

    if (!cashRegister || !cashRegister.view) {
      return NextResponse.json(
        { error: "Caisse introuvable ou indisponible." },
        { status: 404 }
      );
    }

    const invoice = proformaId
      ? await prisma.invoice.findUnique({
          where: { id: proformaId },
          select: { numero: true, objet: true, client: { select: { nom: true } } },
        })
      : null;

    if (invoice) {
      const enrichedLibelle = `${libelle} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`;

      const { paiement, cashJournalEntry } = await prisma.$transaction((tx) =>
        recordDepensePaiement(tx, {
          invoiceId: proformaId!,
          cashRegisterId,
          montant,
          libelle: enrichedLibelle,
          date_operation: dateOperation,
        })
      );

      return NextResponse.json({ paiement, cashJournalEntry }, { status: 201 });
    }

    const cashJournalEntry = await prisma.$transaction((tx) =>
      recordCashMovement(tx, {
        cashRegisterId,
        type: OperationType.DEPENSE,
        montant,
        libelle,
        date_operation: dateOperation,
      })
    );

    return NextResponse.json({ cashJournalEntry }, { status: 201 });
  } catch (error) {
    console.error("Erreur API intégration - création dépense caisse:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur interne du serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
