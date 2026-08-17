import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";

// GET /api/integration/cash-journal/registers
// Liste les caisses visibles, pour que l'app appelante (campagnes) puisse laisser
// son utilisateur choisir dans quelle caisse imputer une dépense.
export async function GET(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  try {
    const registers = await prisma.cashRegister.findMany({
      where: { view: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(registers);
  } catch (error) {
    console.error("Erreur API intégration - liste des caisses:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
