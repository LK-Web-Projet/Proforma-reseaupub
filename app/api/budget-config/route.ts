import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { getEntrepriseConfig } from "@/lib/entreprise";

// Paramètres du circuit budget, réservés aux administrateurs (même garde que la page Rôles, où
// ils sont affichés) :
// - plafond de validation déléguée ;
// - types de budget dont le scan signé est exigé (sans lui, la validation n'est pas complète et
//   les lignes accordées ne sont pas dépensables — lib/budgetSuivi.ts) ;
// - maximum d'une petite dépense (droit « accueil ») ;
// - liasse complète exigée pour payer le solde d'un bon de commande ;
// - délais de paiement des factures prestataires selon le type (au-delà : en retard) ;
// - délai de relance proposé pour une facture normalisée envoyée au client.
const reponse = (config: {
  plafondValidationDeleguee: unknown;
  typesBudgetSigneRequis: TypeBudget[];
  plafondPetiteDepense: unknown;
  liasseExigeePourSolde: boolean;
  delaiPaiementFournisseur: number;
  delaiPaiementInterne: number;
  delaiPaiementExterne: number;
  delaiRelanceFactureClient: number;
}) => ({
  plafondValidationDeleguee: Number(config.plafondValidationDeleguee),
  typesBudgetSigneRequis: config.typesBudgetSigneRequis,
  plafondPetiteDepense: Number(config.plafondPetiteDepense),
  liasseExigeePourSolde: config.liasseExigeePourSolde,
  delaisPaiement: { fournisseur: config.delaiPaiementFournisseur, interne: config.delaiPaiementInterne, externe: config.delaiPaiementExterne },
  delaiRelanceFactureClient: config.delaiRelanceFactureClient,
});

export async function GET() {
  const droitsAcces = await requirePermission("parametres.reglages");
  if (droitsAcces instanceof NextResponse) return droitsAcces;

  return NextResponse.json(reponse(await getEntrepriseConfig()));
}

const schema = z
  .object({
    plafondValidationDeleguee: z.number().min(0, "Le plafond ne peut pas être négatif.").optional(),
    typesBudgetSigneRequis: z.array(z.nativeEnum(TypeBudget)).optional(),
    plafondPetiteDepense: z.number().min(0, "Le maximum ne peut pas être négatif.").optional(),
    liasseExigeePourSolde: z.boolean().optional(),
    delaisPaiement: z
      .object({
        fournisseur: z.number().int("Nombre de jours entier.").min(1, "Au moins 1 jour.").max(365, "Au plus 365 jours."),
        interne: z.number().int("Nombre de jours entier.").min(1, "Au moins 1 jour.").max(365, "Au plus 365 jours."),
        externe: z.number().int("Nombre de jours entier.").min(1, "Au moins 1 jour.").max(365, "Au plus 365 jours."),
      })
      .optional(),
    delaiRelanceFactureClient: z.number().int("Nombre de jours entier.").min(1, "Au moins 1 jour.").max(365, "Au plus 365 jours.").optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Aucun réglage à enregistrer.",
  });

export async function PUT(request: NextRequest) {
  const droitsAcces = await requirePermission("parametres.reglages");
  if (droitsAcces instanceof NextResponse) return droitsAcces;

  const validation = schema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Valeur invalide." }, { status: 400 });
  }
  const { plafondValidationDeleguee, typesBudgetSigneRequis, plafondPetiteDepense, liasseExigeePourSolde, delaisPaiement, delaiRelanceFactureClient } = validation.data;

  await getEntrepriseConfig(); // garantit l'existence de la ligne singleton
  const config = await prisma.entrepriseConfig.update({
    where: { id: "singleton" },
    data: {
      ...(plafondValidationDeleguee !== undefined ? { plafondValidationDeleguee } : {}),
      ...(typesBudgetSigneRequis !== undefined ? { typesBudgetSigneRequis: Array.from(new Set(typesBudgetSigneRequis)) } : {}),
      ...(plafondPetiteDepense !== undefined ? { plafondPetiteDepense } : {}),
      ...(liasseExigeePourSolde !== undefined ? { liasseExigeePourSolde } : {}),
      ...(delaiRelanceFactureClient !== undefined ? { delaiRelanceFactureClient } : {}),
      ...(delaisPaiement
        ? {
            delaiPaiementFournisseur: delaisPaiement.fournisseur,
            delaiPaiementInterne: delaisPaiement.interne,
            delaiPaiementExterne: delaisPaiement.externe,
          }
        : {}),
    },
  });
  if (delaisPaiement) {
    // Nouveaux délais : les factures à payer seront réévaluées (et renotifiées si toujours en
    // retard) au prochain passage de la tâche du matin.
    await prisma.factureFournisseur.updateMany({
      where: { status: "EN_ATTENTE", retardNotifieAt: { not: null } },
      data: { retardNotifieAt: null },
    });
  }
  return NextResponse.json(reponse(config));
}
