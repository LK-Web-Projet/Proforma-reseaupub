import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/gestionnaires - Récupérer tous les gestionnaires
export async function GET() {
  try {
    const gestionnaires = await prisma.gestionnaire.findMany();
    return NextResponse.json(gestionnaires);
  } catch (error) {
    console.error("Erreur lors de la récupération des gestionnaires :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}

// POST /api/gestionnaires - Créer un nouveau gestionnaire
export async function POST(request: Request) {
  try {
    const { nom, prenom, email, telephone } = await request.json();

    if (!nom || !prenom || !email) {
      return NextResponse.json(
        { error: "Nom, prénom et email sont requis." },
        { status: 400 }
      );
    }

    const newGestionnaire = await prisma.gestionnaire.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
      },
    });

    return NextResponse.json(newGestionnaire, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du gestionnaire :", error);
    // Gérer le cas où l'email est déjà pris (P2002)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2002') {
        return NextResponse.json(
            { error: "Un gestionnaire avec cet email existe déjà." },
            { status: 409 } // 409 Conflict
        );
    }
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}