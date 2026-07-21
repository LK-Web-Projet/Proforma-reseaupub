import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCampagnesForProforma } from "@/lib/camptrackClient";

// GET /api/factures/:id/campagnes
// Récupère, côté camptrack, les campagnes liées à cette proforma.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const facture = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!facture) {
    return NextResponse.json(
      { error: "Facture non trouvée" },
      { status: 404 }
    );
  }

  const campagnes = await getCampagnesForProforma(id);

  return NextResponse.json(campagnes);
}
