import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ModePaiementDemande } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserIdentity, isBudgetComptableEmail } from "@/lib/budgetAuth";
import { saveTypedDemandeBudgetAttachments, describeFsError } from "@/lib/uploadDemandeBudget";
import { sendDemandeSoumiseNotification } from "@/lib/email/demandeBudget";

const ligneSchema = z.object({
  designation: z.string().min(1),
  montant: z.number().min(0),
});

const resoumettreSchema = z.object({
  departement: z.string().optional(),
  contexteMotivation: z.string().min(1, "Le contexte et la motivation sont requis."),
  modePaiement: z.nativeEnum(ModePaiementDemande),
  typeDepense: z.string().min(1, "Le type de dépense est requis."),
  pourLeCompteDe: z.string().optional(),
  dateLimiteSouhaitee: z.string().optional(),
  bonCommandeId: z.string().optional(),
  proformaIds: z.array(z.string()).default([]),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne de dépense."),
});

// POST /api/demandes-budget/[id]/resoumettre - Modifier une demande rejetée et la resoumettre
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { email } = await getCurrentUserIdentity();
    if (!email) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const existing = await prisma.demandeBudget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (existing.statut !== "REJETEE") {
      return NextResponse.json({ error: "Seule une demande rejetée peut être modifiée et resoumise." }, { status: 400 });
    }

    // Seul l'auteur de la demande ou le comptable peuvent la corriger et la resoumettre.
    const isAutorise = existing.requesterEmail === email || isBudgetComptableEmail(email);
    if (!isAutorise) {
      return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier cette demande." }, { status: 403 });
    }

    const formData = await request.formData();
    const rawLignes = formData.get("lignes");
    const rawProformaIds = formData.get("proformaIds");

    const parsedBody = {
      departement: (formData.get("departement") as string) || undefined,
      contexteMotivation: (formData.get("contexteMotivation") as string) || "",
      modePaiement: formData.get("modePaiement") as string,
      typeDepense: (formData.get("typeDepense") as string) || "",
      pourLeCompteDe: (formData.get("pourLeCompteDe") as string) || undefined,
      dateLimiteSouhaitee: (formData.get("dateLimiteSouhaitee") as string) || undefined,
      bonCommandeId: (formData.get("bonCommandeId") as string) || undefined,
      proformaIds: rawProformaIds ? JSON.parse(rawProformaIds as string) : [],
      lignes: rawLignes ? JSON.parse(rawLignes as string) : [],
    };

    const validation = resoumettreSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }
    const data = validation.data;
    const montantTotal = data.lignes.reduce((sum, l) => sum + l.montant, 0);

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

    sendDemandeSoumiseNotification(demande).catch((err) =>
      console.error("Erreur lors de l'envoi de la notification de re-soumission:", err)
    );

    return NextResponse.json(demande);
  } catch (error) {
    console.error(`Erreur lors de la re-soumission de la demande ${id}:`, error);
    const fsMessage = describeFsError(error);
    if (fsMessage) {
      return NextResponse.json({ error: fsMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
