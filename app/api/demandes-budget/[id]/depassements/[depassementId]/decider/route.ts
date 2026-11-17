import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, StatutDepassement } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isSameEmail } from "@/lib/budgetAuth";
import { logBudget, recalculerStatutBudget } from "@/lib/budgetSuivi";
import { sendDepassementDecisionNotification } from "@/lib/email/demandeBudget";

class DecisionError extends Error {}

const schema = z
  .object({
    decision: z.enum(["APPROUVE", "REJETE"]),
    motifRejet: z.string().trim().optional(),
  })
  .refine((d) => d.decision === "APPROUVE" || !!d.motifRejet, { message: "Indiquez le motif du refus." });

/**
 * POST /api/demandes-budget/[id]/depassements/[depassementId]/decider — l'admin
 * (canValidateMensuel) approuve ou refuse un dépassement. Il ne peut pas décider d'un dépassement
 * qu'il a lui-même demandé. Approuvé, le plafond de la ligne augmente du montant (calculé, jamais
 * stocké) et un budget entièrement consommé repasse EN_COURS.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depassementId: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canValidateMensuel) {
    return NextResponse.json({ error: "Seul l'administrateur peut approuver un dépassement." }, { status: 403 });
  }

  const { id, depassementId } = await params;

  try {
    const validation = schema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { decision, motifRejet } = validation.data;
    const approuve = decision === "APPROUVE";

    const { depassement, demande } = await prisma.$transaction(async (tx) => {
      const depassement = await tx.budgetDepassement.findFirst({
        where: { id: depassementId, demandeBudgetId: id },
        include: { ligne: true, demandeBudget: { include: { lignes: true } } },
      });
      if (!depassement) throw new DecisionError("Dépassement introuvable.");
      if (depassement.statut !== StatutDepassement.EN_ATTENTE) throw new DecisionError("Ce dépassement a déjà été traité.");
      if (isSameEmail(depassement.demandeParEmail, caps.email)) {
        throw new DecisionError("Vous ne pouvez pas décider d'un dépassement que vous avez demandé.");
      }
      // Séparation des tâches : un admin qui est lui-même le demandeur du budget ne peut pas
      // augmenter son propre plafond, même si le dépassement a été demandé par le comptable.
      if (isSameEmail(depassement.demandeBudget.requesterEmail, caps.email)) {
        throw new DecisionError("Vous êtes le demandeur de ce budget : un autre administrateur doit décider de ses dépassements.");
      }
      if (depassement.demandeBudget.clotureeAt) throw new DecisionError("Ce budget est clôturé.");

      const updated = await tx.budgetDepassement.update({
        where: { id: depassementId },
        data: {
          statut: approuve ? StatutDepassement.APPROUVE : StatutDepassement.REJETE,
          decideParEmail: caps.email,
          decideAt: new Date(),
          motifRejet: approuve ? null : motifRejet,
        },
      });

      await logBudget(tx, {
        demandeBudgetId: id,
        action: approuve ? ActionBudget.DEPASSEMENT_APPROUVE : ActionBudget.DEPASSEMENT_REJETE,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        montant: Number(depassement.montant),
        details: `${depassement.ligne.designation}${approuve ? "" : ` — ${motifRejet}`}`,
      });

      if (approuve) await recalculerStatutBudget(tx, id);

      return { depassement: { ...depassement, ...updated }, demande: depassement.demandeBudget };
    });

    sendDepassementDecisionNotification(demande, {
      designation: depassement.ligne.designation,
      montant: Number(depassement.montant),
      approuve,
      motifRejet,
      demandeParEmail: depassement.demandeParEmail,
    }).catch((err) => console.error("Erreur lors de l'envoi de la décision de dépassement:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DecisionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de la décision sur le dépassement ${depassementId}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
