import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { DepenseError } from "@/lib/depenses/enregistrerDepense";
import { enregistrerLotPaiement } from "@/lib/depenses/enregistrerLotPaiement";

/**
 * POST /api/integration/cash-journal/lots-paiement — contrat utilisé par CampTrack (branche
 * feature/paiements_groupes : lib/integrations/proformaClient.ts `enregistrerLotPaiement`, document
 * CampTrack docs/INTEGRATION_FINANCE_PAIEMENTS_GROUPES.md). Un lot = une campagne = une proforma :
 * un seul appel avec le résumé du lot, une ligne par prestataire et la ligne de budget choisie.
 *
 * Réponses attendues par CampTrack :
 * - 201 { lot, cashJournalEntryId, budgetDepenseId, paiementId, aRattacher } : lot enregistré ;
 * - 200 { deja: true, lot, … } : cette `reference` est déjà enregistrée — aucun second paiement
 *   (nouvel essai après une coupure réseau) ;
 * - 400 / 404 { error } : message affiché tel quel dans CampTrack, rien n'est enregistré.
 * Le traitement est celui de `depenses-groupees` (enregistrerLotPaiement) : budget, transition « à
 * rattacher », campagne sans budget, solde de caisse, séparation des tâches, budget signé.
 */
const ligneSchema = z.object({
  reference: z.string().trim().min(1, "Chaque ligne doit avoir une référence."),
  beneficiaire: z.string().trim().min(1, "Chaque ligne doit nommer son bénéficiaire."),
  /** Numéro Mobile Money du bénéficiaire. */
  numero: z.string().trim().optional().default(""),
  montant: z.number().positive("Chaque ligne doit avoir un montant supérieur à 0."),
  libelle: z.string().optional().default(""),
});

const lotSchema = z.object({
  reference: z.string().trim().min(1, "La référence du lot est requise."),
  referenceOperateur: z.string().trim().optional(),
  proformaId: z.string().trim().min(1).optional(),
  cashRegisterId: z.number().int().positive("La caisse est requise."),
  ligneBudgetId: z.string().trim().min(1).optional(),
  comptableEmail: z.string().email("comptableEmail invalide."),
  modePaiement: codeMoyenSchema.default("MOBILE_MONEY"),
  datePaiement: z.string().optional(),
  montantTotal: z.number().positive("Le montant total doit être supérieur à 0."),
  lignes: z.array(ligneSchema).min(1, "Le lot doit contenir au moins une ligne.").max(1000, "1 000 lignes au maximum par lot."),
});

/** Réponse « déjà enregistré » : mêmes identifiants qu'à la première réception. */
async function reponseDeja(reference: string) {
  const lot = await prisma.lotPaiement.findUnique({
    where: { reference },
    include: { cashJournalEntry: { select: { paiement: { select: { id: true } } } } },
  });
  if (!lot) return null;
  const paiementId = lot.cashJournalEntry.paiement?.id ?? null;
  return NextResponse.json(
    {
      deja: true,
      lot: { id: lot.id, reference: lot.reference, cashJournalEntryId: lot.cashJournalEntryId, budgetDepenseId: lot.budgetDepenseId, paiementId },
      cashJournalEntryId: lot.cashJournalEntryId,
      budgetDepenseId: lot.budgetDepenseId,
      paiementId,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const validation = lotSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const lot = validation.data;

  try {
    // Nouvel essai d'un lot déjà reçu : on le reconnaît avant tout autre contrôle.
    const deja = await reponseDeja(lot.reference);
    if (deja) return deja;

    const somme = Math.round(lot.lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100;
    if (Math.abs(somme - lot.montantTotal) > 0.01) {
      return NextResponse.json(
        { error: `Le montant total du lot (${lot.montantTotal}) ne correspond pas à la somme des lignes (${somme}).` },
        { status: 400 }
      );
    }
    const dateDepense = lot.datePaiement ? new Date(lot.datePaiement) : new Date();
    if (Number.isNaN(dateDepense.getTime())) {
      return NextResponse.json({ error: "datePaiement invalide." }, { status: 400 });
    }
    const caisse = await prisma.cashRegister.findUnique({ where: { id: lot.cashRegisterId }, select: { id: true } });
    if (!caisse) return NextResponse.json({ error: "Caisse introuvable." }, { status: 404 });
    const proforma = lot.proformaId
      ? await prisma.invoice.findUnique({ where: { id: lot.proformaId }, select: { id: true, numero: true } })
      : null;
    if (lot.proformaId && !proforma) return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });

    const n = lot.lignes.length;
    const resultat = await prisma.$transaction(
      (tx) =>
        enregistrerLotPaiement(tx, {
          reference: lot.reference,
          referenceOperateur: lot.referenceOperateur,
          proformaId: lot.proformaId,
          libelle: `Paiement groupé CampTrack ${lot.reference} — ${n} prestataire(s)${proforma ? ` (proforma ${proforma.numero})` : ""}`,
          cashRegisterId: lot.cashRegisterId,
          montant: lot.montantTotal,
          modePaiement: lot.modePaiement,
          dateDepense,
          ligneBudgetId: lot.ligneBudgetId,
          comptableEmail: lot.comptableEmail,
          // Détail conservé au format affiché par Finance (numéro de ligne + numéro Mobile Money).
          lignes: lot.lignes.map((l, i) => ({
            numero: i + 1,
            reference: l.reference,
            beneficiaire: l.beneficiaire,
            numeroMomo: l.numero || undefined,
            montant: l.montant,
            libelle: l.libelle || undefined,
          })),
        }),
      { timeout: 30000 }
    );

    return NextResponse.json(
      {
        lot: {
          id: resultat.lot.id,
          reference: resultat.lot.reference,
          cashJournalEntryId: resultat.cashJournalEntry.id,
          budgetDepenseId: resultat.budgetDepenseId,
          paiementId: resultat.paiementId,
        },
        cashJournalEntryId: resultat.cashJournalEntry.id,
        budgetDepenseId: resultat.budgetDepenseId,
        paiementId: resultat.paiementId,
        aRattacher: resultat.aRattacher,
      },
      { status: 201 }
    );
  } catch (error) {
    // Même lot envoyé deux fois en même temps : la contrainte d'unicité a joué → « déjà enregistré ».
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const deja = await reponseDeja(lot.reference);
      if (deja) return deja;
    }
    if (error instanceof DepenseError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error("Erreur API intégration - lot de paiement CampTrack:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
