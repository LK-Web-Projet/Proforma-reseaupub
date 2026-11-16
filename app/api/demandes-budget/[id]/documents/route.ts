import { NextRequest, NextResponse } from "next/server";
import { ActionBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logBudget, majStatutApresDecision } from "@/lib/budgetSuivi";
import { requireBudgetUser, isImpliqueBudget, isSameEmail } from "@/lib/budgetAuth";
import { sendDemandeValideeNotification } from "@/lib/email/demandeBudget";
import { saveTypedDemandeBudgetAttachments, saveDemandeBudgetFiles, describeFsError, UploadRejectedError } from "@/lib/uploadDemandeBudget";

// POST /api/demandes-budget/[id]/documents
// - Sans `depenseId` : ajoute des documents complémentaires à une demande en validation, validée
//   ou en cours (auteur de la demande ou rôle du circuit budget) — notamment le scan du budget
//   signé par la DG : joint pendant la validation, il la complète (statut recalculé).
// - Avec `depenseId` : ajoute après coup le justificatif d'une dépense enregistrée « sans
//   justificatif » (comptable uniquement) — la dépense repasse alors en « justifiée ».
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const demande = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    const formData = await request.formData();
    const depenseId = (formData.get("depenseId") as string) || null;

    if (depenseId) {
      if (!caps.canPay) {
        return NextResponse.json({ error: "Réservé au comptable." }, { status: 403 });
      }
      const depense = await prisma.budgetDepense.findFirst({ where: { id: depenseId, demandeBudgetId: id } });
      if (!depense) {
        return NextResponse.json({ error: "Dépense introuvable sur ce budget." }, { status: 404 });
      }
      const preuves = (formData.getAll("preuves") as File[]).filter((f) => f && f.size > 0);
      if (preuves.length === 0) {
        return NextResponse.json({ error: "Aucun justificatif fourni." }, { status: 400 });
      }
      const saved = await saveDemandeBudgetFiles(id, preuves, {
        date: depense.dateDepense,
        montant: Number(depense.montant),
        kind: "PREUVE_PAIEMENT",
      });
      await prisma.$transaction([
        prisma.demandeBudgetAttachment.createMany({
          data: saved.map((f) => ({ demandeBudgetId: id, depenseId, kind: "PREUVE_PAIEMENT" as const, ...f })),
        }),
        // Le motif initial est conservé pour l'historique ; seul le drapeau change.
        prisma.budgetDepense.update({ where: { id: depenseId }, data: { sansJustificatif: false } }),
        logBudget(prisma, {
          demandeBudgetId: id,
          action: ActionBudget.JUSTIFICATIF,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: Number(depense.montant),
          details: `Justificatif ajouté après coup : ${saved.map((f) => f.fileName).join(", ")}`,
        }),
      ]);
      return NextResponse.json({ success: true, count: saved.length });
    }

    const isAutorise = isSameEmail(demande.requesterEmail, caps.email) || isImpliqueBudget(caps);
    if (!isAutorise) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier cette demande." }, { status: 403 });
    }
    const statutsOuverts: string[] = ["SOUMISE", "VALIDATION_PARTIELLE", "VALIDEE", "EN_COURS"];
    if (!statutsOuverts.includes(demande.statut)) {
      return NextResponse.json({ error: "Des documents ne peuvent être ajoutés que sur une demande en validation, validée ou en cours." }, { status: 400 });
    }

    const attachmentRows = await saveTypedDemandeBudgetAttachments(id, formData, {
      date: new Date(),
      montant: Number(demande.montantTotal),
    });
    if (attachmentRows.length === 0) {
      return NextResponse.json({ error: "Aucun document fourni." }, { status: 400 });
    }

    const resultat = await prisma.$transaction(async (tx) => {
      await tx.demandeBudgetAttachment.createMany({ data: attachmentRows });
      await logBudget(tx, {
        demandeBudgetId: id,
        action: ActionBudget.DOCUMENTS,
        auteurEmail: caps.email,
        auteurNom: caps.name,
        details: attachmentRows.map((f) => f.fileName).join(", "),
      });
      // Budget signé joint pendant la validation : c'est ce qui la complète si toutes les lignes
      // sont décidées (sinon le budget reste en validation partielle, mais devient dépensable).
      const enValidation = demande.statut === "SOUMISE" || demande.statut === "VALIDATION_PARTIELLE";
      if (enValidation && attachmentRows.some((r) => r.kind === "BUDGET_SIGNE")) {
        return majStatutApresDecision(tx, id, caps, { declencheur: "SIGNATURE" });
      }
      return null;
    }, { maxWait: 10_000, timeout: 30_000 });

    if (resultat?.devenuValide) {
      const demandeAJour = await prisma.demandeBudget.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
      sendDemandeValideeNotification(demandeAJour).catch((err) => console.error("Erreur lors de l'envoi de la notification de validation:", err));
    }

    return NextResponse.json({ success: true, count: attachmentRows.length, statut: resultat?.statut ?? demande.statut });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de l'ajout de documents à la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    const message = fsMessage || (error instanceof Error ? error.message : "Erreur interne du serveur");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
