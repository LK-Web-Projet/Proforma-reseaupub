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

    // 1. Définition de la période
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

    // 2. Filtres pour les factures
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

    // 3. Récupération des données
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

    // 4. Traitement des statistiques
    const stats = {
      totalInvoices: invoices.length,
      invoiceStats: {
        brouillon: { count: 0, sum: 0 },
        envoyées: { count: 0, sum: 0 },
        validées: { count: 0, sum: 0 },
        payées: { count: 0, sum: 0 },
        soldées: { count: 0, sum: 0 },
        annulées: { count: 0, sum: 0 },
        archivées: { count: 0, sum: 0 },
      },
      cashStats: {
        recettes: 0,
        depenses: 0,
        balance: 0,
      },
      outstandingPayments: 0,
      revenueRealized: 0, // Validées + Payées + Soldées
      topClients: [] as ClientStat[],
      topProducts: [] as ProductStat[],
      monthlyEvolution: [] as MonthlyStat[],
    };

    const clientsMap = new Map<string, ClientStat>();
    const productsMap = new Map<string, ProductStat>();
    
    // Initialisation de l'évolution mensuelle
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

    // Traitement des factures
    for (const invoice of invoices) {
      const rate = exchangeRates[invoice.devise] || 1;
      const totalXOF = Number(invoice.totalTTC) * rate;
      const resteXOF = Number(invoice.resteAPayer) * rate;
      const monthKey = format(invoice.dateCreation, 'yyyy-MM');

      // Par statut
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
          stats.revenueRealized += totalXOF;
          if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.revenue += totalXOF;
          break;
        case StatusFacture.Payer:
          stats.invoiceStats.payées.count++;
          stats.invoiceStats.payées.sum += totalXOF;
          stats.revenueRealized += totalXOF;
          if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.revenue += totalXOF;
          break;
        case StatusFacture.Solde:
          stats.invoiceStats.soldées.count++;
          stats.invoiceStats.soldées.sum += totalXOF;
          stats.revenueRealized += totalXOF;
          if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.revenue += totalXOF;
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

      if (invoice.statut !== StatusFacture.Annuler) {
        stats.outstandingPayments += resteXOF;
      }

      // Top Clients
      const clientName = invoice.client.nom;
      const currentClient = clientsMap.get(clientName) || { name: clientName, amount: 0, count: 0 };
      currentClient.amount += totalXOF;
      currentClient.count++;
      clientsMap.set(clientName, currentClient);

      // Top Produits
      for (const prod of invoice.produits) {
        const prodName = prod.designation;
        const prodAmount = Number(prod.montantTotal) * rate;
        const currentProd = productsMap.get(prodName) || { name: prodName, amount: 0, quantity: 0 };
        currentProd.amount += prodAmount;
        currentProd.quantity += prod.quantite;
        productsMap.set(prodName, currentProd);
      }
    }

    // Traitement du journal de caisse
    for (const entry of cashEntries) {
      const monthKey = format(entry.date_operation, 'yyyy-MM');
      if (entry.type === OperationType.RECETTE) {
        stats.cashStats.recettes += entry.montant;
      } else if (entry.type === OperationType.DEPENSE) {
        stats.cashStats.depenses += entry.montant;
        if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.expenses += entry.montant;
      }
    }

    // Traitement des factures fournisseurs (dépenses additionnelles si payées)
    for (const f of supplierInvoices) {
      const monthKey = format(f.date, 'yyyy-MM');
      const amount = Number(f.montant);
      if (f.status === StatutFactureFournisseur.PAYEE) {
        // On évite de double compter si c'est déjà dans le journal de caisse
        // Mais ici on veut les dépenses globales engagées/payées
        if (monthlyData.has(monthKey)) monthlyData.get(monthKey)!.expenses += amount;
      }
    }

    stats.cashStats.balance = stats.cashStats.recettes - stats.cashStats.depenses;

    // Finalisation des classements
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
