import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCanManageUsers } from "@/lib/authz";
import { getEntrepriseConfig } from "@/lib/entreprise";

// Paramètres du circuit budget (plafond de validation déléguée). Lecture et modification
// réservées aux administrateurs (même garde que la page Rôles, où ce réglage est affiché).
export async function GET() {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  const config = await getEntrepriseConfig();
  return NextResponse.json({ plafondValidationDeleguee: Number(config.plafondValidationDeleguee) });
}

const schema = z.object({
  plafondValidationDeleguee: z.number().min(0, "Le plafond ne peut pas être négatif."),
});

export async function PUT(request: NextRequest) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  const validation = schema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Valeur invalide." }, { status: 400 });
  }

  await getEntrepriseConfig(); // garantit l'existence de la ligne singleton
  const config = await prisma.entrepriseConfig.update({
    where: { id: "singleton" },
    data: { plafondValidationDeleguee: validation.data.plafondValidationDeleguee },
  });
  return NextResponse.json({ plafondValidationDeleguee: Number(config.plafondValidationDeleguee) });
}
