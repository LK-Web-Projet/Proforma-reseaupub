import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { z } from "zod";

const clientSchema = z.object({
  nom: z.string().min(1, "Le nom du client est requis."),
  email: z.string().email("Email invalide.").optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
});

// POST /api/integration/clients/find-or-create
// L'app campagnes envoie les infos client dont elle dispose ; on retourne le client
// existant (matché sur `nom`, unique en base) ou on en crée un nouveau. Le `id` retourné
// est la référence canonique à stocker côté app campagnes.
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const validation = clientSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 }
    );
  }

  const { nom, email, telephone, adresse } = validation.data;

  try {
    const client = await prisma.client.upsert({
      where: { nom },
      update: {
        ...(email !== undefined ? { email } : {}),
        ...(telephone !== undefined ? { telephone } : {}),
        ...(adresse !== undefined ? { adresse } : {}),
      },
      create: { nom, email, telephone, adresse },
    });

    return NextResponse.json(client, { status: 200 });
  } catch (error) {
    console.error("Erreur API intégration - find-or-create client:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
