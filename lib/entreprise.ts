import { prisma } from "@/lib/prisma";
import { EntrepriseConfig } from "@prisma/client";

export const DEFAULT_ENTREPRISE: Omit<EntrepriseConfig, "updatedAt"> = {
    id: "singleton",
    nom: "Reseaupub",
    slogan: null,
    adresse: "Etoile Rouge, Cotonou, Bénin",
    telephone: "+229 01 69 81 30 30",
    email: "info@reseaupub.com",
    emailFinance: "finance@reseaupub.com",
    siteWeb: null,
    ifu: "0201710009974",
    rccm: null,
    nomDirecteur: "Directeur Général",
    logoPath: "rplogo.png",
};

/**
 * Récupère la configuration de l'entreprise (server-side uniquement).
 * Si elle n'existe pas encore en base, crée l'entrée par défaut.
 */
export async function getEntrepriseConfig(): Promise<EntrepriseConfig> {
    const config = await prisma.entrepriseConfig.upsert({
        where: { id: "singleton" },
        update: {},
        create: DEFAULT_ENTREPRISE,
    });
    return config;
}
