import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture } from '@prisma/client';

// GET /api/clients
export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: {
            factures: true,
          }
        },
        factures: {
          select: {
            statut: true,
          }
        }
      },
      orderBy: {
        nom: 'asc'
      }
    });

    // Transformer les données pour avoir des compteurs par statut
    const clientsWithStats = clients.map(client => {
      const stats = {
        total: client._count.factures,
        validees: client.factures.filter(f => f.statut === StatusFacture.Valider).length,
        payees: client.factures.filter(f => f.statut === StatusFacture.Payer).length,
        soldees: client.factures.filter(f => f.statut === StatusFacture.Solde).length,
      };
      
      return {
        id: client.id,
        nom: client.nom,
        email: client.email,
        telephone: client.telephone,
        adresse: client.adresse,
        stats
      };
    });

    return NextResponse.json(clientsWithStats);
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
