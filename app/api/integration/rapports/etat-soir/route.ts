import { NextRequest, NextResponse } from "next/server";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { construireEtatSoir, envoyerEtatSoir } from "@/lib/rapports/etatSoir";

/**
 * POST /api/integration/rapports/etat-soir — état du soir (campagnes : prévu, payé par moyen, reste ;
 * justificatifs manquants ; avances non justifiées) vers la DG, comptables en copie. Envoyé
 * automatiquement à 19 h les jours ouvrés par l'application (lib/taches/planificateur.ts, si
 * SCHEDULER_ENABLED=true) ; cette route sert à un envoi manuel ou de secours.
 * `Authorization: Bearer <INTEGRATION_API_KEY>` ; `?dryRun=1` renvoie l'état sans rien envoyer.
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const etat = await construireEtatSoir();
    const envoi = dryRun ? { envoye: false, destinataires: 0 } : await envoyerEtatSoir(etat);
    return NextResponse.json({ ...envoi, ...(dryRun ? { etat } : { campagnes: etat.campagnes.length, justificatifs: etat.justificatifs.length, avancesNonJustifiees: etat.avancesNonJustifiees.length }) });
  } catch (error) {
    console.error("Erreur lors de l'état du soir:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
