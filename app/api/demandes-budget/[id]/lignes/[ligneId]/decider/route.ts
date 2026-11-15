import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, StatutDemandeBudget, StatutLigneBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, refusValidation } from "@/lib/budgetAuth";
import { BUDGET_EPSILON, logBudget, majStatutApresDecision, refusBudgetSigneManquant } from "@/lib/budgetSuivi";
import { sendDemandeValideeNotification, sendLigneACorrigerNotification } from "@/lib/email/demandeBudget";

class DecisionError extends Error {}

const schema = z
  .object({
    decision: z.enum(["ACCORDER", "CORRIGER"]),
    montantAccorde: z.number().positive("Le montant accordé doit être supérieur à 0.").optional(),
    motif: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision !== "CORRIGER" || !!d.motif, { message: "Expliquez au demandeur ce qu'il doit corriger." });

/**
 * POST /api/demandes-budget/[id]/lignes/[ligneId]/decider — validation d'UNE ligne d'un budget
 * soumis (ou en validation partielle) par un valideur habilité (même matrice que la validation
 * globale, `refusValidation`) :
 *  - ACCORDER : au montant demandé, ou à un montant inférieur (`montantAccorde`, motif obligatoire) —
 *    jamais au-dessus : au-delà, c'est un dépassement ;
 *  - CORRIGER : la ligne revient au demandeur avec un motif (ouvre aussi un fil de commentaire sur
 *    la ligne), qui la modifiera ou la retirera (PATCH /lignes/[ligneId]).
 * Une ligne accordée est dépensable immédiatement (statut VALIDATION_PARTIELLE) ; le budget passe
 * VALIDEE quand plus aucune ligne n'est en attente ni à corriger.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ligneId: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id, ligneId } = await params;

  try {
    const validation = schema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { decision, montantAccorde, motif } = validation.data;

    const { resultat, demande, ligne } = await prisma.$transaction(async (tx) => {
      const demande = await tx.demandeBudget.findUnique({ where: { id }, include: { lignes: true } });
      if (!demande) throw new DecisionError("Demande introuvable.");
      if (demande.statut !== StatutDemandeBudget.SOUMISE && demande.statut !== StatutDemandeBudget.VALIDATION_PARTIELLE) {
        throw new DecisionError("Les lignes ne peuvent être décidées que sur un budget soumis ou en validation partielle.");
      }
      const refus = refusValidation(caps, demande);
      if (refus) throw new DecisionError(refus);
      // Accorder engage la dépense : le budget de campagne doit d'abord être signé par la DG.
      // (Demander une correction reste possible sans le scan.)
      if (decision === "ACCORDER") {
        const refusSigne = await refusBudgetSigneManquant(tx, demande);
        if (refusSigne) throw new DecisionError(refusSigne);
      }

      const ligne = demande.lignes.find((l) => l.id === ligneId);
      if (!ligne) throw new DecisionError("Cette ligne n'appartient pas à ce budget.");
      // Verrou : deux valideurs ne peuvent pas décider la même ligne en même temps.
      await tx.$queryRaw`SELECT id FROM "DemandeBudgetLigne" WHERE id = ${ligne.id} FOR UPDATE`;
      const actuelle = await tx.demandeBudgetLigne.findUnique({ where: { id: ligne.id } });
      if (actuelle?.statutValidation !== StatutLigneBudget.EN_ATTENTE) {
        throw new DecisionError("Cette ligne a déjà été décidée.");
      }

      const demandeNum = Number(ligne.montant);
      if (decision === "ACCORDER") {
        const accorde = montantAccorde ?? demandeNum;
        if (accorde > demandeNum + BUDGET_EPSILON) {
          throw new DecisionError("On ne peut pas accorder plus que le montant demandé : au-delà, passez par un dépassement.");
        }
        const reduit = accorde < demandeNum - BUDGET_EPSILON;
        if (reduit && !motif) throw new DecisionError("Indiquez le motif de la réduction du montant.");
        await tx.demandeBudgetLigne.update({
          where: { id: ligne.id },
          data: {
            statutValidation: StatutLigneBudget.ACCORDEE,
            montantAccorde: reduit ? accorde : null,
            decideParEmail: caps.email,
            decideAt: new Date(),
            motifDecision: reduit ? motif : null,
          },
        });
        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.LIGNE_ACCORDEE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: accorde,
          details: reduit
            ? `${ligne.designation} — accordée ${accorde.toLocaleString("fr-FR")} sur ${demandeNum.toLocaleString("fr-FR")} FCFA demandés : ${motif}`
            : `${ligne.designation} — accordée au montant demandé`,
        });
      } else {
        await tx.demandeBudgetLigne.update({
          where: { id: ligne.id },
          data: {
            statutValidation: StatutLigneBudget.A_CORRIGER,
            montantAccorde: null,
            decideParEmail: caps.email,
            decideAt: new Date(),
            motifDecision: motif,
          },
        });
        // Le motif ouvre (ou complète) le fil de commentaires de la ligne : le demandeur peut y répondre.
        await tx.budgetCommentaire.create({
          data: { demandeBudgetId: id, ligneId: ligne.id, auteurEmail: caps.email, auteurNom: caps.name, contenu: `Correction demandée : ${motif}` },
        });
        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.LIGNE_A_CORRIGER,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: demandeNum,
          details: `${ligne.designation} — ${motif}`,
        });
      }

      const resultat = await majStatutApresDecision(tx, id, caps);
      const demandeAJour = await tx.demandeBudget.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
      return { resultat, demande: demandeAJour, ligne };
    });

    if (decision === "CORRIGER") {
      sendLigneACorrigerNotification(demande, { designation: ligne.designation, motif: motif!, auteur: caps.name || caps.email }).catch((err) =>
        console.error("Erreur lors de l'envoi de la demande de correction:", err)
      );
    }
    if (resultat?.devenuValide) {
      sendDemandeValideeNotification(demande).catch((err) => console.error("Erreur lors de l'envoi de la notification de validation:", err));
    }

    return NextResponse.json({ success: true, statut: resultat?.statut });
  } catch (error) {
    if (error instanceof DecisionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de la décision sur la ligne ${ligneId}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
