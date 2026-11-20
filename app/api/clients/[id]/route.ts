import { requireAnyPage, requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/clients/[id]
export async function GET(
  request: Request,
  {params}: { params: Promise<{ id: string }> }
) {
  const refusAcces = await requireAnyPage(["client"]);
  if (refusAcces) return refusAcces;
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
    });
    if (!client) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch (error) {
    console.error("Erreur lors de la récupération du client :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const droitsAcces = await requirePermission("client.modifier");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  try {
    const data = await request.json();
    const { id } = await params;
    const clientMisAJour = await prisma.client.update({
      where: { id: id },
      data,
    });
    return NextResponse.json(clientMisAJour);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du client :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const droitsAcces = await requirePermission("client.supprimer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  try {
    const { id } = await params;
    // Un client qui a déjà des proformas garde son historique : suppression refusée.
    const nbProformas = await prisma.invoice.count({ where: { clientId: id } });
    if (nbProformas > 0) {
      return NextResponse.json(
        { error: `Ce client a ${nbProformas} proforma(s) : il ne peut pas être supprimé.` },
        { status: 409 }
      );
    }
    await prisma.client.delete({ where: { id: id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression du client :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
