import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { recordCashMovement } from "@/lib/cashJournal";
import { OperationType } from "@prisma/client";
import { z } from "zod";

const depenseSchema = z.object({
  cashRegisterId: z.number().int(),
  montant: z.number().positive(),
  libelle: z.string().min(1, "Le libellé est requis."),
  date_operation: z.string().datetime().optional(),
});

// POST /api/integration/cash-journal/depenses
// Enregistre une DEPENSE dans la caisse choisie par l'utilisateur côté app appelante
// (campagnes). Le type est volontairement fixé à DEPENSE côté serveur : cet endpoint
// ne permet ni RECETTE ni TRANSFERT.
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

  const { cashRegisterId, montant, libelle, date_operation } = validation.data;

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

    const entry = await prisma.$transaction((tx) =>
      recordCashMovement(tx, {
        cashRegisterId,
        type: OperationType.DEPENSE,
        montant,
        libelle,
        date_operation: date_operation ? new Date(date_operation) : new Date(),
      })
    );

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Erreur API intégration - création dépense caisse:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
