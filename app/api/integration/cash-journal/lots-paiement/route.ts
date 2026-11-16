import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ModePaiementDemande, Prisma, SourceDepense } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { budgetsDeLaProforma, DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";

const lotSchema = z.object({
  reference: z.string().trim().min(1, "La référence du lot est requise."),
  referenceOperateur: z.string().trim().optional(),
  proformaId: z.string().min(1, "La proforma de la campagne est requise."),
  cashRegisterId: z.number().int().positive("La caisse est requise."),
  ligneBudgetId: z.string().optional(),
  comptableEmail: z.string().email("L'email du comptable est requis."),
  modePaiement: z.nativeEnum(ModePaiementDemande).default(ModePaiementDemande.MOBILE_MONEY),
  datePaiement: z.string().optional(),
  montantTotal: z.number().positive("Le montant total doit être supérieur à 0."),
  lignes: z
    .array(
      z.object({
        reference: z.string().optional(),
        beneficiaire: z.string().trim().min(1, "Chaque ligne doit nommer son bénéficiaire."),
        numero: z.string().optional(),
        montant: z.number().positive("Chaque ligne doit avoir un montant positif."),
        libelle: z.string().optional(),
      })
    )
    .min(1, "Le lot doit contenir au moins une ligne."),
});

/**
 * POST /api/integration/cash-journal/lots-paiement — Camptrack envoie le RÉSUMÉ d'un lot de
 * paiement des prestataires d'une campagne (un lot = une proforma) : UNE sortie de caisse pour le
 * total, UNE dépense de budget (si la campagne a un budget : `ligneBudgetId` obligatoire, plafond
 * contrôlé), la dépense imputée à la proforma, et le détail des bénéficiaires conservé (LotPaiement).
 * Idempotent : la même `reference` renvoie le lot déjà enregistré (200), jamais un second paiement.
 * Le lot est considéré comme justifié dans Camptrack (états signés, historique des transferts).
 * Authentification : `Authorization: Bearer <INTEGRATION_API_KEY>`. Voir docs/integration/camptrack-paiements-lots.md.
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const validation = lotSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const lot = validation.data;
  const somme = Math.round(lot.lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100;
  if (Math.abs(somme - lot.montantTotal) > 0.01) {
    return NextResponse.json(
      { error: `Le total du lot (${lot.montantTotal}) ne correspond pas à la somme des lignes (${somme}).` },
      { status: 400 }
    );
  }

  const existant = await prisma.lotPaiement.findUnique({ where: { reference: lot.reference } });
  if (existant) return NextResponse.json({ deja: true, lot: existant }, { status: 200 });

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: lot.proformaId }, select: { numero: true, objet: true, client: { select: { nom: true } } } });
    if (!invoice) return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });

    const n = lot.lignes.length;
    const resultat = await prisma.$transaction(
      async (tx) => {
        if (!lot.ligneBudgetId && (await budgetsDeLaProforma(tx, lot.proformaId)).length > 0) {
          throw new DepenseError("Cette campagne a un budget : choisissez la ligne de budget sur laquelle imputer le lot (ligneBudgetId).");
        }
        const depense = await enregistrerDepense(tx, {
          source: SourceDepense.CAMPTRACK,
          auteur: { userId: null, email: lot.comptableEmail.toLowerCase(), name: null },
          montant: lot.montantTotal,
          dateDepense: lot.datePaiement ? new Date(lot.datePaiement) : new Date(),
          cashRegisterId: lot.cashRegisterId,
          nomReceveur: `Lot ${lot.reference} — ${n} bénéficiaire(s)`,
          modePaiement: lot.modePaiement,
          notes: lot.referenceOperateur ? `Référence opérateur : ${lot.referenceOperateur}` : null,
          ligneBudgetId: lot.ligneBudgetId ?? null,
          invoiceId: lot.proformaId,
          justifieAilleurs: true,
          referenceExterne: lot.reference,
          libelle: `Paiement prestataires — lot ${lot.reference} (${n} bénéficiaire(s)) — Proforma ${invoice.numero} de ${invoice.client.nom}`,
          methode: lot.modePaiement,
          reference: lot.referenceOperateur ?? lot.reference,
        });
        const enregistre = await tx.lotPaiement.create({
          data: {
            reference: lot.reference,
            referenceOperateur: lot.referenceOperateur ?? null,
            proformaId: lot.proformaId,
            nbBeneficiaires: n,
            montant: lot.montantTotal,
            modePaiement: lot.modePaiement,
            detail: lot.lignes as Prisma.InputJsonValue,
            comptableEmail: lot.comptableEmail.toLowerCase(),
            cashJournalEntryId: depense.cashJournalEntry.id,
            budgetDepenseId: depense.budgetDepense?.id ?? null,
          },
        });
        return { lot: enregistre, depense };
      },
      { timeout: 20000 }
    );

    return NextResponse.json(
      {
        lot: resultat.lot,
        cashJournalEntryId: resultat.depense.cashJournalEntry.id,
        budgetDepenseId: resultat.depense.budgetDepense?.id ?? null,
        paiementId: resultat.depense.paiement?.id ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    // Lot envoyé deux fois en même temps : la contrainte d'unicité a joué → renvoyer le lot existant.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const deja = await prisma.lotPaiement.findUnique({ where: { reference: lot.reference } });
      if (deja) return NextResponse.json({ deja: true, lot: deja }, { status: 200 });
    }
    if (error instanceof DepenseError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error("Erreur API intégration - lot de paiement:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
