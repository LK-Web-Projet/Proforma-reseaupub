import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const gestionnaireId = searchParams.get('gestionnaireId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');

    const where: { clientId?: string; gestionnaires?: { some: { gestionnaireId: string; }; }; dateCreation?: { gte: Date; lte: Date; }; } = {};

    if (clientId) {
      where.clientId = clientId;
    }
    if (gestionnaireId) {
      where.gestionnaires = {
        some: { gestionnaireId },
      };
    }
    if (startDate && endDate) {
      where.dateCreation = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (year) {
      const parsedYear = parseInt(year);
      const yearStartDate = new Date(parsedYear, 0, 1);
      const yearEndDate = new Date(parsedYear, 11, 31, 23, 59, 59);
      where.dateCreation = {
        gte: yearStartDate,
        lte: yearEndDate,
      };
    }

    const invoices = await prisma.invoice.findMany({ where });

    const exchangeRates = {
      EUR: 655.957,
      USD: 615, // Taux approximatif
      XOF: 1,
    };

    const stats = {
      totalInvoices: invoices.length,
      validated: { count: 0, sum: 0 },
      sent: { count: 0, sum: 0 },
      cancelled: { count: 0, sum: 0 },
      archived: { count: 0, sum: 0 },
      brouillon: { count: 0, sum: 0 },
      payer: { count: 0, sum: 0 },
    };

    for (const invoice of invoices) {
      const totalTTC = Number(invoice.totalTTC);
      const exchangeRate = exchangeRates[invoice.devise] || 1;
      const totalInXOF = totalTTC * exchangeRate;

      switch (invoice.statut) {
        case StatusFacture.Valider:
          stats.validated.count++;
          stats.validated.sum += totalInXOF;
          break;
        case StatusFacture.Envoyer:
          stats.sent.count++;
          stats.sent.sum += totalInXOF;
          break;
        case StatusFacture.Annuler:
          stats.cancelled.count++;
          stats.cancelled.sum += totalInXOF;
          break;
        case StatusFacture.Archiver:
          stats.archived.count++;
          stats.archived.sum += totalInXOF;
          break;
        case StatusFacture.Brouillon:
          stats.brouillon.count++;
          stats.brouillon.sum += totalInXOF;
          break;
        case StatusFacture.Payer:
          stats.payer.count++;
          stats.payer.sum += totalInXOF;
          break;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
