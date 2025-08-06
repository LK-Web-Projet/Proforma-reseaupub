import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/gestionnaires/[id] - Récupérer un gestionnaire et ses factures
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { id },
      include: {
        factures: {
          include: {
            invoice: {
              include: {
                client: true, // Inclure les détails du client
              },
            },
          },
          orderBy: {
            invoice: {
              dateCreation: 'desc'
            }
          }
        },
      },
    });

    if (!gestionnaire) {
      return NextResponse.json(
        { error: "Gestionnaire non trouvé." },
        { status: 404 }
      );
    }

    return NextResponse.json(gestionnaire);
  } catch (error) {
    console.error(`Erreur lors de la récupération du gestionnaire ${params.id} :`, error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}