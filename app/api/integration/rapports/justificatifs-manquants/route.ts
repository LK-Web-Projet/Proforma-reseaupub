import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { echeanceJustificatif, etatJustificatif } from "@/lib/justificatifs";
import { sendJustificatifsManquantsNotification, JustificatifManquant } from "@/lib/email/demandeBudget";

/**
 * POST /api/integration/rapports/justificatifs-manquants — état du soir (procédure de paiement,
 * section 7) : envoie à la DG (comptables en copie) la liste des dépenses de budget sans
 * justificatif, celles en retard (24 h ouvrées dépassées) en tête. Aucun email s'il n'en manque
 * aucun. À appeler chaque soir par la tâche planifiée du serveur (cron), avec
 * `Authorization: Bearer <INTEGRATION_API_KEY>` — même principe que la clôture mensuelle.
 * `?dryRun=1` renvoie la liste sans envoyer d'email (contrôle).
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const maintenant = new Date();
    const depenses = await prisma.budgetDepense.findMany({
      where: { annuleeAt: null, attachments: { none: {} } },
      orderBy: { createdAt: "asc" },
      include: {
        demandeBudget: { select: { id: true, numero: true } },
        ligne: { select: { designation: true } },
        cashRegister: { select: { name: true } },
      },
    });

    const items: JustificatifManquant[] = depenses
      .map((d) => ({
        demandeId: d.demandeBudget.id,
        numero: d.demandeBudget.numero,
        designation: d.ligne.designation,
        nomReceveur: d.nomReceveur,
        montant: Number(d.montant),
        dateDepense: d.dateDepense,
        echeance: echeanceJustificatif(d.createdAt),
        enRetard: etatJustificatif({ createdAt: d.createdAt, nbJustificatifs: 0 }, maintenant) === "EN_RETARD",
        caisse: d.cashRegister.name,
        enregistrePar: d.createdByEmail,
        motifSansJustificatif: d.motifSansJustificatif,
      }))
      // En retard d'abord, puis par échéance.
      .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || a.echeance.getTime() - b.echeance.getTime());

    const envoi = dryRun ? { envoye: false, destinataires: 0 } : await sendJustificatifsManquantsNotification(items);

    return NextResponse.json({
      nombre: items.length,
      enRetard: items.filter((i) => i.enRetard).length,
      ...envoi,
      ...(dryRun ? { items } : {}),
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'état des justificatifs manquants:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
