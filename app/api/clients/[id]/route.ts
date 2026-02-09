import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/clients/[id]
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // <-- attendre la résolution
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
  try {
    const { id } = await params;
    await prisma.client.delete({ where: { id: id } });
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error) {
    console.error("Erreur lors de la suppression du client :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
