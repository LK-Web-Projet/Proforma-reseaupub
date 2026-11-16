import { NextResponse } from "next/server";
import { ActionBudget, StatutDemandeBudget, StatutLigneBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logBudget, majStatutApresDecision } from "@/lib/budgetSuivi";
import { requireBudgetUser, refusValidation } from "@/lib/budgetAuth";
import { sendBudgetSigneDemandeNotification, sendDemandeValideeNotification } from "@/lib/email/demandeBudget";

class ValidationError extends Error {}

/**
 * POST /api/demandes-budget/[id]/valider — « Tout valider » : accorde au montant demandé toutes
 * les lignes encore EN_ATTENTE (les décisions déjà prises ligne par ligne sont conservées, y compris
 * les montants réduits). Le budget passe VALIDEE si le scan signé est joint (ou non exigé pour ce
 * type) ; sinon il reste en VALIDATION_PARTIELLE et le demandeur est invité à joindre le budget
 * signé. Refusé tant qu'une ligne attend une correction du demandeur. Ligne par ligne :
 * /lignes/[ligneId]/decider.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const existing = await prisma.demandeBudget.findUnique({ where: { id }, include: { lignes: true } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== StatutDemandeBudget.SOUMISE && existing.statut !== StatutDemandeBudget.VALIDATION_PARTIELLE) {
      return NextResponse.json({ error: "Seule une demande soumise ou en validation partielle peut être validée." }, { status: 400 });
    }

    const refus = refusValidation(caps, existing);
    if (refus) {
      return NextResponse.json({ error: refus }, { status: 403 });
    }

    const { demande, resultat } = await prisma.$transaction(async (tx) => {
      // Relu sous verrou : une décision de ligne concurrente ne peut pas être écrasée.
      await tx.$queryRaw`SELECT id FROM "DemandeBudgetLigne" WHERE "demandeBudgetId" = ${id} FOR UPDATE`;
      const lignes = await tx.demandeBudgetLigne.findMany({ where: { demandeBudgetId: id } });
      const aCorriger = lignes.filter((l) => l.statutValidation === StatutLigneBudget.A_CORRIGER).length;
      if (aCorriger > 0) {
        throw new ValidationError(
          `${aCorriger} ligne(s) attendent une correction du demandeur : elles doivent être modifiées ou retirées avant de tout valider.`
        );
      }
      const enAttente = lignes.filter((l) => l.statutValidation === StatutLigneBudget.EN_ATTENTE);
      // Une seule requête pour toutes les lignes : la boucle ligne par ligne dépassait le délai de
      // la transaction avec la base distante (erreur P2028 sur les budgets à nombreuses lignes).
      if (enAttente.length > 0) {
        await tx.demandeBudgetLigne.updateMany({
          where: { id: { in: enAttente.map((l) => l.id) }, statutValidation: StatutLigneBudget.EN_ATTENTE },
          data: { statutValidation: StatutLigneBudget.ACCORDEE, montantAccorde: null, decideParEmail: caps.email, decideAt: new Date(), motifDecision: null },
        });
      }
      if (enAttente.length > 0) {
        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.LIGNE_ACCORDEE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: enAttente.reduce((s, l) => s + Number(l.montant), 0),
          details: `Tout valider : ${enAttente.length} ligne(s) accordée(s) au montant demandé`,
        });
      }

      const resultat = await majStatutApresDecision(tx, id, caps);
      const demande = await tx.demandeBudget.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
      return { demande, resultat };
    }, { maxWait: 10_000, timeout: 30_000 });

    if (resultat?.devenuValide) {
      sendDemandeValideeNotification(demande).catch((err) =>
        console.error("Erreur lors de l'envoi de la notification de validation:", err)
      );
    }
    if (resultat?.signatureDemandee) {
      sendBudgetSigneDemandeNotification(demande, resultat.signatureDemandee).catch((err) =>
        console.error("Erreur lors de la demande du budget signé:", err)
      );
    }

    return NextResponse.json(demande);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de la validation de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
