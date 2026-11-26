import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget, isSameEmail } from "@/lib/budgetAuth";
import { sendCommentaireLigneNotification } from "@/lib/email/demandeBudget";

const commentaireSchema = z.object({
  ligneId: z.string().min(1),
  contenu: z.string().trim().min(1, "Le commentaire est vide.").max(2000, "Commentaire trop long (2000 caractères max)."),
});

/**
 * POST /api/demandes-budget/[id]/commentaires — commentaire sur une ligne du budget.
 * - Ouvrir un fil (1er commentaire de la ligne) : admin (canValidateMensuel) ou comptable (canPay).
 * - Répondre (fil déjà ouvert) : ces deux rôles, l'Assistant-Direction et le demandeur.
 * Les commentaires ne sont ni modifiables ni supprimables (trace).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const validation = commentaireSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { ligneId, contenu } = validation.data;

    const demande = await prisma.demandeBudget.findUnique({ where: { id }, include: { lignes: true } });
    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    const ligne = demande.lignes.find((l) => l.id === ligneId);
    if (!ligne) {
      return NextResponse.json({ error: "Cette ligne n'appartient pas à ce budget." }, { status: 400 });
    }

    const estDemandeur = isSameEmail(demande.requesterEmail, caps.email);
    // Budget collectif : le département de la ligne (ou qui l'a saisie) répond sur sa ligne.
    const sonDepartement =
      demande.collectif && ((!!ligne.departementId && caps.departementIds.includes(ligne.departementId)) || isSameEmail(ligne.ajouteeParEmail ?? "", caps.email));
    if (!estDemandeur && !isImpliqueBudget(caps) && !sonDepartement) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }

    const filOuvert = (await prisma.budgetCommentaire.count({ where: { ligneId } })) > 0;
    const peutOuvrir = caps.canValidateMensuel || caps.canPay;
    if (!filOuvert && !peutOuvrir) {
      return NextResponse.json(
        { error: "Seuls l'administrateur et le comptable peuvent ouvrir un commentaire sur une ligne." },
        { status: 403 }
      );
    }

    const commentaire = await prisma.budgetCommentaire.create({
      data: { demandeBudgetId: id, ligneId, auteurEmail: caps.email, auteurNom: caps.name, contenu },
    });

    if (!filOuvert && !estDemandeur) {
      sendCommentaireLigneNotification(demande, {
        designation: ligne.designation,
        auteur: caps.name || caps.email,
        contenu,
      }).catch((err) => console.error("Erreur lors de l'envoi de la notification de commentaire:", err));
    }

    return NextResponse.json(commentaire, { status: 201 });
  } catch (error) {
    console.error(`Erreur lors de l'ajout d'un commentaire sur la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
