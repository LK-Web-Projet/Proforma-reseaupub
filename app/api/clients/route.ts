import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/clients
export async function GET() {
  try {
    const clients = await prisma.client.findMany();
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Erreur lors de la récupération des clients :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}

// POST /api/clients
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const nouveauClient = await prisma.client.create({ data });
    return NextResponse.json(nouveauClient, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du client :", error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
