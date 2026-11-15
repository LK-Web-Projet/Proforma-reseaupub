import { NextRequest, NextResponse } from "next/server";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { sendJustificatifsManquantsNotification } from "@/lib/email/demandeBudget";
import { listerJustificatifsManquants } from "@/lib/rapports/etatSoir";

/**
 * POST /api/integration/rapports/justificatifs-manquants — envoie SEULE la liste des dépenses de
 * budget sans justificatif (celles en retard d'abord) à la DG, comptables en copie. Cette liste fait
 * aussi partie de l'état du soir (`/api/integration/rapports/etat-soir`), envoyé automatiquement par
 * l'application à 19 h (lib/taches/planificateur.ts) : cette route reste pour un envoi ponctuel.
 * `Authorization: Bearer <INTEGRATION_API_KEY>` ; `?dryRun=1` renvoie la liste sans rien envoyer.
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const items = await listerJustificatifsManquants();
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
