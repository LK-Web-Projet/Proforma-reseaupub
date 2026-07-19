export type CamptrackCampagne = {
  id: string;
  nom: string;
  statut: string;
  dateDebut: string;
  dateFin: string;
};

/**
 * Récupère les campagnes camptrack liées à une proforma, en appelant l'API
 * d'intégration de camptrack (GET /api/integration/campagnes?id_proforma=).
 * Ne lève jamais d'exception : retourne un tableau vide si camptrack est
 * injoignable, mal configuré, ou répond en erreur (pour ne jamais faire
 * planter une page/API de cette app à cause d'un souci côté camptrack).
 */
export async function getCampagnesForProforma(
  proformaId: string
): Promise<CamptrackCampagne[]> {
  const baseUrl = process.env.CAMPTRACK_API_URL;
  const apiKey = process.env.CAMPTRACK_INTEGRATION_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error(
      "CAMPTRACK_API_URL ou CAMPTRACK_INTEGRATION_API_KEY non configurée."
    );
    return [];
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/integration/campagnes?id_proforma=${encodeURIComponent(
      proformaId
    )}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `Erreur camptrack (${res.status}) lors de la récupération des campagnes pour la proforma ${proformaId}`
      );
      return [];
    }

    return (await res.json()) as CamptrackCampagne[];
  } catch (error) {
    console.error("Erreur réseau lors de l'appel à camptrack:", error);
    return [];
  }
}
