import { NextRequest, NextResponse } from "next/server";
import { ActionBudget, TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logBudget } from "@/lib/budgetSuivi";
import { requireBudgetUser, isSameEmail } from "@/lib/budgetAuth";
import { parseDemandeBudgetFormData, toPeriodeMois, firstZodMessage } from "@/lib/budgetSchema";
import { saveTypedDemandeBudgetAttachments, describeFsError } from "@/lib/uploadDemandeBudget";
import { sendDemandeSoumiseNotification } from "@/lib/email/demandeBudget";

// POST /api/demandes-budget/[id]/resoumettre - Modifier une demande rejetée et la resoumettre
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== "REJETEE") {
      return NextResponse.json({ error: "Seule une demande rejetée peut être modifiée et resoumise." }, { status: 400 });
    }

    // Seul l'auteur de la demande ou le comptable peuvent la corriger et la resoumettre.
    const isAutorise = isSameEmail(existing.requesterEmail, caps.email) || caps.canPay;
    if (!isAutorise) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier cette demande." }, { status: 403 });
    }

    const formData = await request.formData();
    const validation = parseDemandeBudgetFormData(formData);
    if (!validation.success) {
      return NextResponse.json({ error: firstZodMessage(validation.error) }, { status: 400 });
    }
    const data = validation.data;
    const montantTotal = data.lignes.reduce((sum, l) => sum + l.montant, 0);

    // Une demande rejetée n'a jamais eu de dépense ni de dépassement (ils n'existent qu'à partir
    // de VALIDEE). Ses lignes peuvent en revanche porter des commentaires, supprimés avec elles :
    // on les recopie dans le journal d'audit pour n'en perdre aucune trace.
    const anciensCommentaires = await prisma.budgetCommentaire.findMany({
      where: { demandeBudgetId: id },
      orderBy: { createdAt: "asc" },
      include: { ligne: { select: { designation: true } } },
    });

    const demande = await prisma.$transaction(async (tx) => {
      await tx.demandeBudgetLigne.deleteMany({ where: { demandeBudgetId: id } });
      await tx.demandeBudgetProforma.deleteMany({ where: { demandeBudgetId: id } });

      return tx.demandeBudget.update({
        where: { id },
        data: {
          statut: "SOUMISE",
          rejectionReason: null,
          validatedByEmail: null,
          validatedAt: null,
          type: data.type,
          periodeMois: data.type === TypeBudget.MENSUEL ? toPeriodeMois(data.periodeMois) : null,
          departement: data.departement,
          contexteMotivation: data.contexteMotivation,
          montantTotal,
          modePaiement: data.modePaiement,
          typeDepense: data.typeDepense,
          pourLeCompteDe: data.pourLeCompteDe,
          dateLimiteSouhaitee: data.dateLimiteSouhaitee ? new Date(data.dateLimiteSouhaitee) : null,
          bonCommandeId: data.bonCommandeId || null,
          lignes: { create: data.lignes },
          proformas: { create: data.proformaIds.map((invoiceId) => ({ invoiceId })) },
        },
        include: { lignes: true },
      });
    });

    const attachmentRows = await saveTypedDemandeBudgetAttachments(id, formData);
    if (attachmentRows.length > 0) {
      await prisma.demandeBudgetAttachment.createMany({ data: attachmentRows });
    }

    await logBudget(prisma, {
      demandeBudgetId: id,
      action: ActionBudget.RESOUMISSION,
      auteurEmail: caps.email,
      auteurNom: caps.name,
      montant: montantTotal,
      details: [
        `Ancien montant : ${Number(existing.montantTotal).toLocaleString("fr-FR")} FCFA`,
        ...anciensCommentaires.map(
          (c) => `Commentaire « ${c.ligne.designation} » (${c.auteurNom || c.auteurEmail}) : ${c.contenu}`
        ),
      ].join("\n"),
    });

    sendDemandeSoumiseNotification(demande, caps.plafond).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de re-soumission:", err)
    );

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la re-soumission de la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    const message = fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
