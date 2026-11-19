import { prisma } from "@/lib/prisma";
import { EntrepriseConfig, Prisma, TypeBudget } from "@prisma/client";

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
    plafondValidationDeleguee: new Prisma.Decimal(500000),
    typesBudgetSigneRequis: [TypeBudget.CAMPAGNE, TypeBudget.MENSUEL],
    plafondPetiteDepense: new Prisma.Decimal(50000),
    liasseExigeePourSolde: true,
    delaiPaiementFournisseur: 30,
    delaiPaiementInterne: 7,
    delaiPaiementExterne: 3,
};

/**
 * Récupère la configuration de l'entreprise (server-side uniquement).
 * Si elle n'existe pas encore en base, crée l'entrée par défaut.
 */
export async function getEntrepriseConfig(): Promise<EntrepriseConfig> {
    // Lecture d'abord : la création (avec les valeurs par défaut) n'a lieu qu'une fois.
    const existante = await prisma.entrepriseConfig.findUnique({ where: { id: "singleton" } });
    if (existante) return existante;
    return prisma.entrepriseConfig.upsert({
        where: { id: "singleton" },
        update: {},
        create: DEFAULT_ENTREPRISE,
    });
}
