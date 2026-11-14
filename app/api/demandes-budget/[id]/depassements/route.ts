import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, StatutDemandeBudget, StatutDepassement, StatutLigneBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isSameEmail } from "@/lib/budgetAuth";
import { logBudget } from "@/lib/budgetSuivi";
import { sendDepassementDemandeNotification } from "@/lib/email/demandeBudget";

const schema = z.object({
  ligneId: z.string().min(1),
  montant: z.number().positive("Le montant du dépassement doit être supérieur à 0."),
  motif: z.string().trim().min(3, "Expliquez pourquoi ce dépassement est nécessaire."),
});

/**
 * POST /api/demandes-budget/[id]/depassements — demande d'augmentation du plafond d'une ligne
 * (ligne épuisée ou insuffisante). Peut être faite par le comptable (canPay) ou le demandeur du
 * budget ; approuvée ensuite par l'admin uniquement (voir [depassementId]/decider).
 * Une seule demande en attente par ligne, pour éviter les doublons.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const validation = schema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { ligneId, montant, motif } = validation.data;

    const demande = await prisma.demandeBudget.findUnique({
      where: { id },
      include: { lignes: true, _count: { select: { depenses: true } } },
    });
    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (!caps.canPay && !isSameEmail(demande.requesterEmail, caps.email)) {
      return NextResponse.json({ error: "Seuls le comptable et le demandeur du budget peuvent demander un dépassement." }, { status: 403 });
    }

    // Budget ouvert, ou entièrement consommé mais pas clôturé (c'est justement le cas d'usage).
    const ouvert =
      demande.statut === StatutDemandeBudget.VALIDEE ||
      demande.statut === StatutDemandeBudget.VALIDATION_PARTIELLE ||
      demande.statut === StatutDemandeBudget.EN_COURS ||
      (demande.statut === StatutDemandeBudget.PAYEE && !demande.clotureeAt && demande._count.depenses > 0);
    if (!ouvert) {
      return NextResponse.json({ error: "Un dépassement ne peut être demandé que sur un budget validé et non clôturé." }, { status: 400 });
    }

    const ligne = demande.lignes.find((l) => l.id === ligneId);
    if (!ligne) {
      return NextResponse.json({ error: "Cette ligne n'appartient pas à ce budget." }, { status: 400 });
    }
    if (ligne.statutValidation !== StatutLigneBudget.ACCORDEE) {
      return NextResponse.json({ error: "Un dépassement ne peut être demandé que sur une ligne accordée." }, { status: 400 });
    }

    const enAttente = await prisma.budgetDepassement.count({ where: { ligneId, statut: StatutDepassement.EN_ATTENTE } });
    if (enAttente > 0) {
      return NextResponse.json({ error: "Une demande de dépassement est déjà en attente sur cette ligne." }, { status: 400 });
    }

    const depassement = await prisma.$transaction(async (tx) => {
      const created = await tx.budgetDepassement.create({
        data: { demandeBudgetId: id, ligneId, montant, motif, demandeParEmail: caps.email, demandeParNom: caps.name },
      });
      await logBudget(tx, {
        demandeBudgetId: id,
        action: ActionBudget.DEPASSEMENT_DEMANDE,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        montant,
        details: `${ligne.designation} — ${motif}`,
      });
      return created;
    });

    sendDepassementDemandeNotification(demande, {
      designation: ligne.designation,
      montant,
      motif,
      auteur: caps.name || caps.email,
    }).catch((err) => console.error("Erreur lors de l'envoi de la notification de dépassement:", err));

    return NextResponse.json(depassement, { status: 201 });
  } catch (error) {
    console.error(`Erreur lors de la demande de dépassement sur ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
