import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture } from '@prisma/client';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Cartes de statistiques
    const validatedInvoices = await prisma.invoice.aggregate({
      where: { statut: StatusFacture.Valider },
      _count: { id: true },
      _sum: { totalTTC: true },
    });

    const sentInvoices = await prisma.invoice.count({
      where: { statut: StatusFacture.Envoyer },
    });

    const validatedInvoicesThisMonth = await prisma.invoice.aggregate({
      where: {
        statut: StatusFacture.Valider,
        dateCreation: { gte: startOfMonth },
      },
      _count: { id: true },
      _sum: { totalTTC: true },
    });

    // 2. Données pour le graphique en barres empilées
    const invoicesForChart = await prisma.invoice.findMany({
        where: {
            statut: { in: [StatusFacture.Envoyer, StatusFacture.Valider] },
        },
        select: { dateCreation: true, statut: true, totalTTC: true }
    });

    const monthlyChartData = invoicesForChart.reduce((acc, invoice) => {
        const month = invoice.dateCreation.toISOString().slice(0, 7); // Format YYYY-MM
        if (!acc[month]) {
            acc[month] = { month, Envoyer: 0, Valider: 0 };
        }
        acc[month][invoice.statut] += invoice.totalTTC;
        return acc;
    }, {});


    return NextResponse.json({
      validatedInvoices: {
        count: validatedInvoices._count.id,
        sum: validatedInvoices._sum.totalTTC,
      },
      sentInvoices,
      validatedInvoicesThisMonth: {
        count: validatedInvoicesThisMonth._count.id,
        sum: validatedInvoicesThisMonth._sum.totalTTC,
      },
      monthlyChartData: Object.values(monthlyChartData),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
