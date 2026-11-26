import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { requirePage } from "@/lib/authz";
import { actionSchema, appliquerActionPreparation, BudgetCollectifError, membresDepartements, preparateurs } from "@/lib/budgetCollectifServeur";
import {
  sendBudgetCollectifCorrection,
  sendBudgetCollectifInvitation,
  sendBudgetCollectifPret,
  sendDemandeSoumiseNotification,
} from "@/lib/email/demandeBudget";

/**
 * POST /api/demandes-budget/[id]/preparation — action sur un budget collectif (JSON { action, … }) :
 * lignes des départements, invitations, date limite, responsable, « prêt », correction / retrait par le
 * comptable, soumission à la direction, réouverture. Les droits sont contrôlés par
 * appliquerActionPreparation (lib/budgetCollectifServeur.ts) ; les notifications partent ensuite.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const refusPage = await requirePage("budget");
  if (refusPage) return refusPage;
  const { id } = await params;
  try {
    const v = actionSchema.safeParse(await request.json());
    if (!v.success) return NextResponse.json({ error: v.error.issues[0]?.message ?? "Action invalide." }, { status: 400 });
    const { suite, message } = await prisma.$transaction((tx) => appliquerActionPreparation(tx, caps, id, v.data), { timeout: 30000 });

    if (suite) {
      const demande = await prisma.demandeBudget.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
      const auteur = caps.name || caps.email;
      const envoyer = async () => {
        if (suite.type === "invitation") {
          const to = await membresDepartements(prisma, suite.departementIds, [caps.email]);
          await sendBudgetCollectifInvitation(demande, { to, departements: suite.noms, auteur });
        } else if (suite.type === "correction") {
          const ligne = demande.lignes.find((l) => l.id === suite.ligneId);
          if (!ligne) return;
          const membres = ligne.departementId ? await membresDepartements(prisma, [ligne.departementId], [caps.email]) : [];
          const to = [...new Set([...membres, ...(ligne.ajouteeParEmail && ligne.ajouteeParEmail.toLowerCase() !== caps.email ? [ligne.ajouteeParEmail.toLowerCase()] : [])])];
          await sendBudgetCollectifCorrection(demande, { to, ligne, retiree: suite.retiree, motif: suite.motif, auteur });
        } else if (suite.type === "pret") {
          await sendBudgetCollectifPret(demande, { to: (await preparateurs(prisma)).filter((e) => e !== caps.email), auteur });
        } else if (suite.type === "soumise") {
          await sendDemandeSoumiseNotification(demande, caps.plafond);
        }
      };
      envoyer().catch((err) => console.error("Erreur lors d'une notification du budget collectif :", err));
    }
    return NextResponse.json({ success: true, message });
  } catch (error) {
    if (error instanceof BudgetCollectifError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`Erreur lors d'une action de préparation du budget ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
