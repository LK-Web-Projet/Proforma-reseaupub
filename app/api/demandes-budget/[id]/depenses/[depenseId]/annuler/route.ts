import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, OperationType, PaiementType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { recordCashMovement } from "@/lib/cashJournal";
import { safeCreatedById } from "@/lib/authz";
import { logBudget, recalculerStatutBudget } from "@/lib/budgetSuivi";
import { sendDepenseAnnuleeNotification } from "@/lib/email/demandeBudget";

class AnnulationError extends Error {}

const schema = z.object({
  motif: z.string().trim().min(3, "Indiquez le motif de l'annulation."),
});

/**
 * POST /api/demandes-budget/[id]/depenses/[depenseId]/annuler — annule une dépense de budget.
 * Réservé à l'admin (canValidateMensuel). La dépense n'est JAMAIS supprimée :
 *   - une contre-écriture RECETTE du même montant est passée dans la même caisse (le solde
 *     revient à son niveau, l'écriture d'origine reste visible au journal) ;
 *   - si la dépense était imputée à une proforma, un Paiement DEPENSE négatif (sans écriture
 *     de caisse, pour ne pas être compté comme recette) neutralise son effet sur la marge ;
 *   - la dépense est marquée annulée (qui, quand, pourquoi) et sort du consommé de la ligne.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depenseId: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canValidateMensuel) {
    return NextResponse.json({ error: "Seul l'administrateur peut annuler une dépense de budget." }, { status: 403 });
  }

  const { id, depenseId } = await params;

  try {
    const validation = schema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { motif } = validation.data;

    const { demande, depense, designation } = await prisma.$transaction(
      async (tx) => {
        const depense = await tx.budgetDepense.findFirst({
          where: { id: depenseId, demandeBudgetId: id },
          include: { ligne: true, demandeBudget: { include: { lignes: true } } },
        });
        if (!depense) throw new AnnulationError("Dépense introuvable sur ce budget.");
        if (depense.annuleeAt) throw new AnnulationError("Cette dépense est déjà annulée.");

        // Verrou : deux annulations simultanées ne peuvent pas créer deux contre-écritures.
        await tx.$queryRaw`SELECT id FROM "BudgetDepense" WHERE id = ${depense.id} FOR UPDATE`;

        const montant = Number(depense.montant);
        const libelle = `Annulation dépense budget ${depense.demandeBudget.numero} — ${depense.ligne.designation} (écriture n° ${depense.cashJournalEntryId})`;
        const now = new Date();

        const contreEcriture = await recordCashMovement(tx, {
          cashRegisterId: depense.cashRegisterId,
          type: OperationType.RECETTE,
          montant,
          libelle,
          date_operation: now,
          createdById: caps.userId,
        });

        if (depense.invoiceId) {
          await tx.paiement.create({
            data: {
              invoiceId: depense.invoiceId,
              montant: -montant,
              type: PaiementType.DEPENSE,
              datePaiement: now,
              methode: depense.modePaiement,
              reference: depense.demandeBudget.numero,
              notes: `${libelle} — ${motif}`,
              createdById: await safeCreatedById(tx, caps.userId),
            },
          });
        }

        await tx.budgetDepense.update({
          where: { id: depense.id },
          data: { annuleeAt: now, annuleeParEmail: caps.email, motifAnnulation: motif, contreEcritureId: contreEcriture.id },
        });

        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.ANNULATION_DEPENSE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant,
          details: `${depense.ligne.designation} — ${motif} — contre-écriture n° ${contreEcriture.id}`,
        });

        await recalculerStatutBudget(tx, id);

        return { demande: depense.demandeBudget, depense, designation: depense.ligne.designation };
      },
      { timeout: 20000 }
    );

    sendDepenseAnnuleeNotification(demande, {
      designation,
      montant: Number(depense.montant),
      motif,
      auteur: caps.name || caps.email,
    }).catch((err) => console.error("Erreur lors de l'envoi de la notification d'annulation:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AnnulationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de l'annulation de la dépense ${depenseId}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
