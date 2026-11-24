import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionBudget, CategorieDepense, ModePaiementDemande, StatutDemandeBudget, StatutLigneBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isSameEmail } from "@/lib/budgetAuth";
import { logBudget, majStatutApresDecision } from "@/lib/budgetSuivi";
import { toDateJour } from "@/lib/budgetSchema";
import { erreurDepartementsLignes } from "@/lib/departementsServeur";
import { sendDemandeValideeNotification, sendLigneCorrigeeNotification, sendDemandeRejeteeNotification } from "@/lib/email/demandeBudget";

class CorrectionError extends Error {}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("MODIFIER"),
    designation: z.string().trim().min(1, "La désignation est requise."),
    categorie: z.nativeEnum(CategorieDepense, { message: "Choisissez une catégorie." }),
    montant: z.number().positive("Le montant doit être supérieur à 0."),
    modePaiement: z.nativeEnum(ModePaiementDemande).optional(),
    departementId: z.string().min(1).optional(),
    // Absents = inchangés ; chaîne vide = effacés.
    detail: z.string().trim().max(2000, "Le détail est limité à 2000 caractères.").optional(),
    dateLimite: z
      .string()
      .optional()
      .refine((v) => !v || toDateJour(v) !== null, "Le délai n'est pas une date valide."),
    reponse: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("RETIRER"), reponse: z.string().trim().max(1000).optional() }),
]);

/**
 * PATCH /api/demandes-budget/[id]/lignes/[ligneId] — le demandeur (ou le comptable, même règle que
 * la re-soumission) traite une ligne renvoyée en correction (A_CORRIGER) :
 *  - MODIFIER : nouvelle désignation / catégorie / montant → la ligne repart en validation
 *    (EN_ATTENTE) et les valideurs compétents sont prévenus ;
 *  - RETIRER : la ligne sort du budget (conservée, barrée, hors totaux) — le budget peut alors
 *    passer entièrement validé.
 * Une réponse facultative est ajoutée au fil de commentaires de la ligne.
 */
export async function PATCH(
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
    const data = validation.data;

    const { resultat, demande, designation } = await prisma.$transaction(async (tx) => {
      const demande = await tx.demandeBudget.findUnique({ where: { id }, include: { lignes: true } });
      if (!demande) throw new CorrectionError("Demande introuvable.");
      if (!isSameEmail(demande.requesterEmail, caps.email) && !caps.canPay) {
        throw new CorrectionError("Seul le demandeur (ou le comptable) peut corriger les lignes de ce budget.");
      }
      if (demande.statut !== StatutDemandeBudget.SOUMISE && demande.statut !== StatutDemandeBudget.VALIDATION_PARTIELLE) {
        throw new CorrectionError("Ce budget n'est plus en cours de validation.");
      }
      const ligne = demande.lignes.find((l) => l.id === ligneId);
      if (!ligne) throw new CorrectionError("Cette ligne n'appartient pas à ce budget.");
      await tx.$queryRaw`SELECT id FROM "DemandeBudgetLigne" WHERE id = ${ligne.id} FOR UPDATE`;
      const actuelle = await tx.demandeBudgetLigne.findUnique({ where: { id: ligne.id } });
      if (actuelle?.statutValidation !== StatutLigneBudget.A_CORRIGER) {
        throw new CorrectionError("Seule une ligne renvoyée en correction peut être modifiée ou retirée.");
      }

      if (data.action === "MODIFIER") {
        if (data.departementId && data.departementId !== actuelle.departementId) {
          const erreur = await erreurDepartementsLignes(tx, [data.departementId]);
          if (erreur) throw new CorrectionError(erreur);
        }
        await tx.demandeBudgetLigne.update({
          where: { id: ligne.id },
          data: {
            designation: data.designation,
            categorie: data.categorie,
            montant: data.montant,
            ...(data.modePaiement ? { modePaiement: data.modePaiement } : {}),
            ...(data.departementId ? { departementId: data.departementId } : {}),
            ...(data.detail !== undefined ? { detail: data.detail || null } : {}),
            ...(data.dateLimite !== undefined ? { dateLimite: toDateJour(data.dateLimite) } : {}),
            statutValidation: StatutLigneBudget.EN_ATTENTE,
            montantAccorde: null,
          },
        });
        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.LIGNE_CORRIGEE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: data.montant,
          details: `${ligne.designation} (${Number(ligne.montant).toLocaleString("fr-FR")} FCFA) → ${data.designation} (${data.montant.toLocaleString("fr-FR")} FCFA)`,
        });
      } else {
        await tx.demandeBudgetLigne.update({
          where: { id: ligne.id },
          data: { statutValidation: StatutLigneBudget.RETIREE, montantAccorde: null },
        });
        await logBudget(tx, {
          demandeBudgetId: id,
          action: ActionBudget.LIGNE_RETIREE,
          auteurEmail: caps.email,
          auteurNom: caps.name,
          montant: Number(ligne.montant),
          details: `${ligne.designation} — retirée du budget par le demandeur`,
        });
      }

      if (data.reponse) {
        await tx.budgetCommentaire.create({
          data: { demandeBudgetId: id, ligneId: ligne.id, auteurEmail: caps.email, auteurNom: caps.name, contenu: data.reponse },
        });
      }

      const resultat = await majStatutApresDecision(tx, id, caps);
      const demandeAJour = await tx.demandeBudget.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
      return { resultat, demande: demandeAJour, designation: data.action === "MODIFIER" ? data.designation : ligne.designation };
    });

    if (data.action === "MODIFIER") {
      sendLigneCorrigeeNotification(demande, { designation, auteur: caps.name || caps.email }).catch((err) =>
        console.error("Erreur lors de l'envoi de la notification de ligne corrigée:", err)
      );
    }
    if (resultat?.devenuValide) {
      sendDemandeValideeNotification(demande).catch((err) => console.error("Erreur lors de l'envoi de la notification de validation:", err));
    }
    if (resultat?.devenuRejete) {
      sendDemandeRejeteeNotification(demande).catch((err) => console.error("Erreur lors de l'envoi de la notification de rejet:", err));
    }

    return NextResponse.json({ success: true, statut: resultat?.statut });
  } catch (error) {
    if (error instanceof CorrectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`Erreur lors de la correction de la ligne ${ligneId}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
