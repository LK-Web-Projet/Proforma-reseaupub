import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture, OperationType, StatutFactureFournisseur } from '@prisma/client';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClientStat {
  name: string;
  amount: number;
  count: number;
}

interface ProductStat {
  name: string;
  amount: number;
  quantity: number;
}

interface MonthlyStat {
  month: string;
  revenue: number;
  expenses: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const gestionnaireId = searchParams.get('gestionnaireId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const yearParam = searchParams.get('year');

    const exchangeRates: Record<string, number> = {
      EUR: 655.957,
      USD: 615,
      XOF: 1,
    };

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else if (yearParam) {
      const year = parseInt(yearParam);
      startDate = startOfYear(new Date(year, 0, 1));
      endDate = endOfYear(new Date(year, 11, 31));
    } else {
      const currentYear = new Date().getFullYear();
      startDate = startOfYear(new Date(currentYear, 0, 1));
      endDate = endOfYear(new Date(currentYear, 11, 31));
    }

    const invoiceWhere: {
      dateCreation: { gte: Date; lte: Date };
      clientId?: string;
      gestionnaires?: { some: { gestionnaireId: string } };
    } = {
      dateCreation: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (clientId) invoiceWhere.clientId = clientId;
    if (gestionnaireId) {
      invoiceWhere.gestionnaires = {
        some: { gestionnaireId },
      };
    }

    const [invoices, cashEntries, supplierInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          client: true,
          produits: true,
        },
      }),
      prisma.cashJournal.findMany({
        where: {
          date_operation: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.factureFournisseur.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    const stats = {
      totalInvoices: invoices.length,
      invoiceStats: {
        brouillon: { count: 0, sum: 0 },
        envoyées: { count: 0, sum: 0 },
        validées: { count: 0, sum: 0 }, // Total TTC
        payées: { count: 0, sum: 0 },   // Montant réellement payé sur factures "Payer"
        soldées: { count: 0, sum: 0 },  // Montant total (car soldé)
        annulées: { count: 0, sum: 0 },
        archivées: { count: 0, sum: 0 },
      },
      cashStats: {
        recettes: 0,
        depenses: 0,
        balance: 0,
      },
      outstandingPayments: 0,
      revenueRealized: 0, // Somme Validées (TTC) + Payées (Reel) + Soldées (TTC)
      topClients: [] as ClientStat[],
      topProducts: [] as ProductStat[],
      monthlyEvolution: [] as MonthlyStat[],
    };

    const clientsMap = new Map<string, ClientStat>();
    const productsMap = new Map<string, ProductStat>();
    
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const monthlyData = new Map<string, MonthlyStat>();
    
    months.forEach(month => {
      const key = format(month, 'yyyy-MM');
      monthlyData.set(key, {
        month: format(month, 'MMM yyyy', { locale: fr }),
        revenue: 0,
        expenses: 0,
      });
    });

    for (const invoice of invoices) {
      const rate = exchangeRates[invoice.devise] || 1;
      const totalXOF = Number(invoice.totalTTC) * rate;
      const resteXOF = Number(invoice.resteAPayer) * rate;
      const payeXOF = totalXOF - resteXOF;
      const monthKey = format(invoice.dateCreation, 'yyyy-MM');

      let amountToCountInSales = 0;

      switch (invoice.statut) {
        case StatusFacture.Brouillon:
          stats.invoiceStats.brouillon.count++;
          stats.invoiceStats.brouillon.sum += totalXOF;
          break;
        case StatusFacture.Envoyer:
          stats.invoiceStats.envoyées.count++;
          stats.invoiceStats.envoyées.sum += totalXOF;
          break;
        case StatusFacture.Valider:
          stats.invoiceStats.validées.count++;
          stats.invoiceStats.validées.sum += totalXOF;
          amountToCountInSales = totalXOF;
          break;
        case StatusFacture.Payer:
          stats.invoiceStats.payées.count++;
          stats.invoiceStats.payées.sum += payeXOF; // Uniquement le réel payé
          amountToCountInSales = payeXOF;
          break;
        case StatusFacture.Solde:
          stats.invoiceStats.soldées.count++;
          stats.invoiceStats.soldées.sum += totalXOF;
          amountToCountInSales = totalXOF;
          break;
        case StatusFacture.Annuler:
          stats.invoiceStats.annulées.count++;
          stats.invoiceStats.annulées.sum += totalXOF;
          break;
        case StatusFacture.Archiver:
          stats.invoiceStats.archivées.count++;
          stats.invoiceStats.archivées.sum += totalXOF;
          break;
      }

      // Mise à jour du CA réalisé et évolution mensuelle si facture valide/payée/soldée
      if ([StatusFacture.Valider, StatusFacture.Payer, StatusFacture.Solde].includes(invoice.statut)) {
        stats.revenueRealized += amountToCountInSales;
        if (monthlyData.has(monthKey)) {
          monthlyData.get(monthKey)!.revenue += amountToCountInSales;
        }

        // Top Clients basé sur le CA réalisé
        const clientName = invoice.client.nom;
        const currentClient = clientsMap.get(clientName) || { name: clientName, amount: 0, count: 0 };
        currentClient.amount += amountToCountInSales;
        currentClient.count++;
        clientsMap.set(clientName, currentClient);

        // Top Produits basé sur la proportion payée/validée de la facture
        const proportion = totalXOF > 0 ? amountToCountInSales / totalXOF : 0;
        for (const prod of invoice.produits) {
          const prodName = prod.designation;
          const prodAmountRealized = Number(prod.montantTotal) * rate * proportion;
          const currentProd = productsMap.get(prodName) || { name: prodName, amount: 0, quantity: 0 };
          currentProd.amount += prodAmountRealized;
          currentProd.quantity += prod.quantite;
          productsMap.set(prodName, currentProd);
        }
      }

      if (invoice.statut !== StatusFacture.Annuler) {
        stats.outstandingPayments += resteXOF;
      }
    }

    for (const entry of cashEntries) {
      const monthKey = format(entry.date_operation, 'yyyy-MM');
      if (entry.type === OperationType.RECETTE) {
        stats.cashStats.recettes += entry.montant;
      } else if (entry.type === OperationType.DEPENSE) {
        stats.cashStats.depenses += entry.montant;
        if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.expenses += entry.montant;
      }
    }

    for (const f of supplierInvoices) {
      const monthKey = format(f.date, 'yyyy-MM');
      const amount = Number(f.montant);
      if (f.status === StatutFactureFournisseur.PAYEE) {
        if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.expenses += amount;
      }
    }

    stats.cashStats.balance = stats.cashStats.recettes - stats.cashStats.depenses;

    stats.topClients = Array.from(clientsMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    stats.topProducts = Array.from(productsMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    stats.monthlyEvolution = Array.from(monthlyData.values());

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
