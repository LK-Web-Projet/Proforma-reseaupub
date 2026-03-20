import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // Assurez-vous que le chemin vers votre instance Prisma est correct
import { generateInvoicePdf } from "@/lib/pdf"; // Importation de la fonction de génération de PDF

// GET /api/factures/[id]
// Cette fonction gère les requêtes GET pour récupérer une facture spécifique par son ID
// et génère un PDF de cette facture.
export async function GET(
  request: NextRequest, // Le premier argument est l'objet de requête Next.js
  context: { params: Promise<{ id: string }> } // Le deuxième argument contient les paramètres de route dynamiques (ici, 'id')
) {
  try {
    // Tente de trouver une facture unique dans la base de données en utilisant l'ID fourni.
    // 'include' permet de récupérer également les données du client et des produits associés à la facture.
    const { id } = await context.params; // <-- attendre la résolution
    const facture = await prisma.invoice.findUnique({
      where: { id }, // Utilise l'ID extrait des paramètres de la route pour la recherche
      include: { client: true, produits: true },
    });

    // Si aucune facture n'est trouvée avec l'ID donné
    if (!facture) {
      // Renvoie une réponse JSON avec un message d'erreur et un statut 404 (Non trouvé)
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Récupère la configuration de l'entreprise
    const { getEntrepriseConfig } = await import("@/lib/entreprise");
    const entreprise = await getEntrepriseConfig();

    // Génère le PDF de la facture en utilisant la fonction importée
    const pdfBytes = await generateInvoicePdf(facture, entreprise);

    // Renvoie le PDF sous forme de réponse avec les en-têtes appropriés
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200, // Statut HTTP 200 (OK)
      headers: {
        "Content-Type": "application/pdf", // Indique que le contenu est un PDF
        // Définit le nom du fichier pour le téléchargement ou l'affichage en ligne
        "Content-Disposition": `inline; filename="facture-${facture.numero}-${facture.objet}-${facture.client.nom}.pdf"`,
      },
    });
  } catch (error) {
    // En cas d'erreur lors de l'exécution de la requête (ex: problème de connexion à la DB, erreur PDF)
    console.error(
      "Erreur lors de la récupération ou de la génération du PDF de la facture :",
      error
    ); // Log l'erreur pour le débogage côté serveur
    // Renvoie une réponse JSON avec un message d'erreur générique et un statut 500 (Erreur Interne du Serveur)
    return NextResponse.json(
      { error: "Erreur Interne du Serveur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}

// Force la génération dynamique de cette route à chaque requête, désactivant la mise en cache statique.
export const dynamic = "force-dynamic";
// Désactive la revalidation des données pour cette route, assurant que le contenu est toujours frais.
export const revalidate = 0;
