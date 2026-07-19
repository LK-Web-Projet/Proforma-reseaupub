import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { StatusFacture } from "@prisma/client";

// GET /api/integration/proformas?statut=Valider
// Liste les proformas (par défaut : uniquement celles validées) pour l'app campagnes.
export async function GET(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const statutParam = searchParams.get("statut");
  const statut = (
    statutParam && Object.values(StatusFacture).includes(statutParam as StatusFacture)
      ? statutParam
      : "Valider"
  ) as StatusFacture;

  try {
    const proformas = await prisma.invoice.findMany({
      where: { statut },
      orderBy: { dateCreation: "desc" },
      include: {
        client: true,
        produits: true,
        gestionnaires: { include: { gestionnaire: true } },
      },
    });

    return NextResponse.json(
      proformas.map((p) => ({
        id: p.id,
        numero: p.numero,
        objet: p.objet,
        statut: p.statut,
        dateCreation: p.dateCreation,
        devise: p.devise,
        totalHT: p.totalHT,
        tva: p.tva,
        totalTTC: p.totalTTC,
        resteAPayer: p.resteAPayer,
        client: {
          id: p.client.id,
          nom: p.client.nom,
          email: p.client.email,
          telephone: p.client.telephone,
          adresse: p.client.adresse,
        },
        gestionnaires: p.gestionnaires.map((g) => ({
          id: g.gestionnaire.id,
          nom: g.gestionnaire.nom,
          prenom: g.gestionnaire.prenom,
          email: g.gestionnaire.email,
        })),
        produits: p.produits.map((prod) => ({
          designation: prod.designation,
          quantite: prod.quantite,
          prixUnitaire: prod.prixUnitaire,
          duree: prod.duree,
          uniteDuree: prod.uniteDuree,
          montantTotal: prod.montantTotal,
          includeduree: prod.includeduree,
        })),
      }))
    );
  } catch (error) {
    console.error("Erreur API intégration - liste proformas:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
