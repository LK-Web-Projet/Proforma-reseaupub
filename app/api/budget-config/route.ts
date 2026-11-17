import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireCanManageUsers } from "@/lib/authz";
import { getEntrepriseConfig } from "@/lib/entreprise";

// Paramètres du circuit budget, réservés aux administrateurs (même garde que la page Rôles, où
// ils sont affichés) :
// - plafond de validation déléguée ;
// - types de budget dont le scan signé est exigé (sans lui, la validation n'est pas complète et
//   les lignes accordées ne sont pas dépensables — lib/budgetSuivi.ts) ;
// - maximum d'une petite dépense (droit « accueil ») ;
// - liasse complète exigée pour payer le solde d'un bon de commande.
const reponse = (config: {
  plafondValidationDeleguee: unknown;
  typesBudgetSigneRequis: TypeBudget[];
  plafondPetiteDepense: unknown;
  liasseExigeePourSolde: boolean;
}) => ({
  plafondValidationDeleguee: Number(config.plafondValidationDeleguee),
  typesBudgetSigneRequis: config.typesBudgetSigneRequis,
  plafondPetiteDepense: Number(config.plafondPetiteDepense),
  liasseExigeePourSolde: config.liasseExigeePourSolde,
});

export async function GET() {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  return NextResponse.json(reponse(await getEntrepriseConfig()));
}

const schema = z
  .object({
    plafondValidationDeleguee: z.number().min(0, "Le plafond ne peut pas être négatif.").optional(),
    typesBudgetSigneRequis: z.array(z.nativeEnum(TypeBudget)).optional(),
    plafondPetiteDepense: z.number().min(0, "Le maximum ne peut pas être négatif.").optional(),
    liasseExigeePourSolde: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Aucun réglage à enregistrer.",
  });

export async function PUT(request: NextRequest) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  const validation = schema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Valeur invalide." }, { status: 400 });
  }
  const { plafondValidationDeleguee, typesBudgetSigneRequis, plafondPetiteDepense, liasseExigeePourSolde } = validation.data;

  await getEntrepriseConfig(); // garantit l'existence de la ligne singleton
  const config = await prisma.entrepriseConfig.update({
    where: { id: "singleton" },
    data: {
      ...(plafondValidationDeleguee !== undefined ? { plafondValidationDeleguee } : {}),
      ...(typesBudgetSigneRequis !== undefined ? { typesBudgetSigneRequis: Array.from(new Set(typesBudgetSigneRequis)) } : {}),
      ...(plafondPetiteDepense !== undefined ? { plafondPetiteDepense } : {}),
      ...(liasseExigeePourSolde !== undefined ? { liasseExigeePourSolde } : {}),
    },
  });
  return NextResponse.json(reponse(config));
}
