import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";

// GET /api/integration/clients?search=xxx
// Recherche de clients existants côté app proforma/finance, pour l'app campagnes.
export async function GET(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  try {
    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { nom: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { nom: "asc" },
      take: 50,
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Erreur API intégration - recherche clients:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
