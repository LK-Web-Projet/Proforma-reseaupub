import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, PaiementType, SourceDepense } from "@prisma/client";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import { erreurMoyensPaiement } from "@/lib/moyensPaiementServeur";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { logBudget, recalculerStatutBudget } from "@/lib/budgetSuivi";
import { controlerLigneBudget, DepenseError } from "@/lib/depenses/enregistrerDepense";

const schema = z.object({
  paiementId: z.string().min(1),
  ligneId: z.string().min(1, "Choisissez la ligne de budget."),
  modePaiement: codeMoyenSchema.default("MOBILE_MONEY"),
  nomReceveur: z.string().trim().optional(),
});

/**
 * POST /api/demandes-budget/[id]/rattacher — le comptable rattache à une ligne de ce budget une
 * dépense d'une proforma du budget qui n'est sur aucun budget : reçue de Camptrack par l'ancien appel
 * (sans ligne), ou saisie sur la proforma avant que le budget n'existe.
 * Crée la dépense de budget à partir de l'écriture de caisse EXISTANTE (aucun nouveau mouvement de
 * caisse), avec les contrôles habituels (ligne accordée, plafond, séparation des tâches).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canPay) {
    return NextResponse.json({ error: "Réservé au comptable habilité à enregistrer les dépenses." }, { status: 403 });
  }
  const { id } = await params;
  const validation = schema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const data = validation.data;

  try {
    const depense = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "paiements" WHERE id = ${data.paiementId} FOR UPDATE`;
      const paiement = await tx.paiement.findUnique({
        where: { id: data.paiementId },
        include: { cashJournalEntry: { select: { id: true, cashRegisterId: true, libelle: true, budgetDepense: { select: { id: true } }, _count: { select: { attachments: true } } } } },
      });
      if (!paiement || paiement.type !== PaiementType.DEPENSE || !paiement.cashJournalEntry) {
        throw new DepenseError("Dépense introuvable.");
      }
      if (paiement.cashJournalEntry.budgetDepense || Number(paiement.montant) <= 0) {
        throw new DepenseError("Cette dépense est déjà rattachée à un budget.");
      }
      const camptrack = paiement.aRattacherBudget;
      // Moyen choisi : existant et actif (pas de caisse à choisir, l'écriture existe déjà).
      const erreurMoyen = await erreurMoyensPaiement(tx, [data.modePaiement]);
      if (erreurMoyen) throw new DepenseError(erreurMoyen);

      const { ligne, demande } = await controlerLigneBudget(tx, {
        ligneBudgetId: data.ligneId,
        demandeBudgetId: id,
        auteurEmail: caps.email,
        montant: Number(paiement.montant),
        dateDepense: paiement.datePaiement,
      });
      if (!demande.proformas.some((p) => p.invoiceId === paiement.invoiceId)) {
        throw new DepenseError("Cette dépense concerne une proforma qui n'est pas liée à ce budget.");
      }

      const created = await tx.budgetDepense.create({
        data: {
          demandeBudgetId: demande.id,
          ligneId: ligne.id,
          montant: paiement.montant,
          dateDepense: paiement.datePaiement,
          nomReceveur: data.nomReceveur || (camptrack ? "Prestataires (Camptrack)" : paiement.reference || "Dépense de la proforma"),
          modePaiement: data.modePaiement,
          notes: paiement.cashJournalEntry.libelle,
          cashRegisterId: paiement.cashJournalEntry.cashRegisterId,
          cashJournalEntryId: paiement.cashJournalEntry.id,
          invoiceId: paiement.invoiceId,
          source: camptrack ? SourceDepense.CAMPTRACK : SourceDepense.PROFORMA,
          referenceExterne: camptrack ? paiement.reference : null,
          // Camptrack : états signés et historique des transferts tenus dans Camptrack. Dépense de la
          // proforma : son justificatif éventuel est déjà sur l'écriture de caisse.
          sansJustificatif: !camptrack && paiement.cashJournalEntry._count.attachments === 0,
          motifSansJustificatif:
            !camptrack && paiement.cashJournalEntry._count.attachments === 0 ? "Dépense saisie sur la proforma avant le budget, sans justificatif." : null,
          createdByEmail: caps.email,
        },
      });
      await tx.paiement.update({ where: { id: paiement.id }, data: { aRattacherBudget: false } });
      // Lot CampTrack reçu sans ligne de budget : il est désormais lié à cette dépense de budget.
      await tx.lotPaiement.updateMany({
        where: { cashJournalEntryId: paiement.cashJournalEntry.id, budgetDepenseId: null },
        data: { budgetDepenseId: created.id },
      });
      await logBudget(tx, {
        demandeBudgetId: demande.id,
        action: ActionBudget.DEPENSE,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        montant: Number(paiement.montant),
        details: `${ligne.designation} — dépense ${camptrack ? "Camptrack" : "de la proforma (antérieure au budget)"} rattachée (écriture n° ${paiement.cashJournalEntry.id})`,
      });
      await recalculerStatutBudget(tx, demande.id);
      return created;
    }, { timeout: 20000 });
    return NextResponse.json(depense, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(`Erreur lors du rattachement d'une dépense au budget ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
