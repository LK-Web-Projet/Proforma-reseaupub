import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { StatusFacture } from "@prisma/client";

// GET /api/gestionnaires/[id] - Récupérer un gestionnaire et ses factures
export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = await context.params; // <- utilise context.params
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
              dateCreation: "desc",
            },
          },
        },
      },
    });

    if (!gestionnaire) {
      return NextResponse.json(
        { error: "Gestionnaire non trouvé." },
        { status: 404 }
      );
    }

    const invoices = gestionnaire.factures.map((f) => f.invoice);

    const stats = {
      validated: { count: 0, total: 0 },
      sent: { count: 0, total: 0 },
      cancelled: { count: 0, total: 0 },
      payer: { count: 0, total: 0 },
      totalInvoices: invoices.length,
      totalAmount: 0,
    };

    for (const invoice of invoices) {
      stats.totalAmount += invoice.totalTTC.toNumber();
      switch (invoice.statut) {
        case StatusFacture.Valider:
          stats.validated.count++;
          stats.validated.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Envoyer:
          stats.sent.count++;
          stats.sent.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Annuler:
          stats.cancelled.count++;
          stats.cancelled.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Payer:
          stats.payer.count++;
          stats.payer.total += invoice.totalTTC.toNumber();
          break;
      }
    }

    const response = {
      ...gestionnaire,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      `Erreur lors de la récupération du gestionnaire ${context.params.id} :`,
      error
    );
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}