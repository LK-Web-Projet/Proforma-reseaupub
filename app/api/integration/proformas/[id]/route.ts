import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";

// GET /api/integration/proformas/:id
// Détail d'une proforma précise, pour l'app campagnes (ex: après association à une campagne).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const proforma = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        produits: true,
        gestionnaires: { include: { gestionnaire: true } },
      },
    });

    if (!proforma) {
      return NextResponse.json(
        { error: "Proforma non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: proforma.id,
      numero: proforma.numero,
      objet: proforma.objet,
      statut: proforma.statut,
      dateCreation: proforma.dateCreation,
      devise: proforma.devise,
      totalHT: proforma.totalHT,
      tva: proforma.tva,
      totalTTC: proforma.totalTTC,
      resteAPayer: proforma.resteAPayer,
      client: {
        id: proforma.client.id,
        nom: proforma.client.nom,
        email: proforma.client.email,
        telephone: proforma.client.telephone,
        adresse: proforma.client.adresse,
      },
      gestionnaires: proforma.gestionnaires.map((g) => ({
        id: g.gestionnaire.id,
        nom: g.gestionnaire.nom,
        prenom: g.gestionnaire.prenom,
        email: g.gestionnaire.email,
      })),
      produits: proforma.produits.map((prod) => ({
        designation: prod.designation,
        quantite: prod.quantite,
        prixUnitaire: prod.prixUnitaire,
        duree: prod.duree,
        uniteDuree: prod.uniteDuree,
        montantTotal: prod.montantTotal,
        includeduree: prod.includeduree,
      })),
    });
  } catch (error) {
    console.error("Erreur API intégration - détail proforma:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
