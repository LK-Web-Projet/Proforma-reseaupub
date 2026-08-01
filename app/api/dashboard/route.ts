import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture, OperationType } from '@prisma/client';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';

interface YearStat {
  year: number;
  commandeTotal: number;
  encaisseTotal: number;
  resteAPayer: number;
  clientsAvecImpaye: number;
}

interface MonthlyStat {
  month: string;
  recettes: number;
  depenses: number;
}

const COMMANDE_STATUSES: StatusFacture[] = [
  StatusFacture.Valider,
  StatusFacture.Payer,
  StatusFacture.Solde,
];

export async function GET() {
  try {
    const now = new Date();

    const [invoices, cashRegisters, currentYearEntries] = await Promise.all([
      prisma.invoice.findMany({
        where: { statut: { in: COMMANDE_STATUSES } },
        select: {
          dateCreation: true,
          totalTTC: true,
          resteAPayer: true,
          clientId: true,
        },
      }),
      prisma.cashRegister.findMany({ where: { view: true } }),
      prisma.cashJournal.findMany({
        where: {
          date_operation: {
            gte: startOfYear(now),
            lte: endOfYear(now),
          },
        },
      }),
    ]);

    const byYearMap = new Map<number, YearStat>();
    const clientsAvecImpayeByYear = new Map<number, Set<string>>();

    let commandeTotal = 0;
    let encaisseTotal = 0;
    let resteAPayerTotal = 0;

    for (const invoice of invoices) {
      const year = invoice.dateCreation.getFullYear();
      const totalTTC = Number(invoice.totalTTC);
      const reste = Number(invoice.resteAPayer);
      const encaisse = totalTTC - reste;

      const yearStat = byYearMap.get(year) || {
        year,
        commandeTotal: 0,
        encaisseTotal: 0,
        resteAPayer: 0,
        clientsAvecImpaye: 0,
      };
      yearStat.commandeTotal += totalTTC;
      yearStat.encaisseTotal += encaisse;
      yearStat.resteAPayer += reste;
      byYearMap.set(year, yearStat);

      if (reste > 0) {
        const set = clientsAvecImpayeByYear.get(year) || new Set<string>();
        set.add(invoice.clientId);
        clientsAvecImpayeByYear.set(year, set);
      }

      commandeTotal += totalTTC;
      encaisseTotal += encaisse;
      resteAPayerTotal += reste;
    }

    for (const [year, set] of clientsAvecImpayeByYear) {
      const yearStat = byYearMap.get(year);
      if (yearStat) yearStat.clientsAvecImpaye = set.size;
    }

    const byYear = Array.from(byYearMap.values()).sort((a, b) => a.year - b.year);

    const soldeCaisseTotal = cashRegisters.reduce((acc, r) => acc + r.balance, 0);

    const months = eachMonthOfInterval({ start: startOfYear(now), end: endOfYear(now) });
    const monthlyMap = new Map<string, MonthlyStat>();
    months.forEach((month) => {
      const key = format(month, 'yyyy-MM');
      monthlyMap.set(key, {
        month: format(month, 'MMM yyyy', { locale: fr }),
        recettes: 0,
        depenses: 0,
      });
    });

    for (const entry of currentYearEntries) {
      const key = format(entry.date_operation, 'yyyy-MM');
      const stat = monthlyMap.get(key);
      if (!stat) continue;
      if (entry.type === OperationType.RECETTE) stat.recettes += entry.montant;
      else if (entry.type === OperationType.DEPENSE) stat.depenses += entry.montant;
    }

    return NextResponse.json({
      commandeTotal,
      encaisseTotal,
      resteAPayerTotal,
      byYear,
      soldeCaisseTotal,
      cashRegisters: cashRegisters.map((r) => ({ name: r.name, balance: r.balance })),
      cashMonthlyEvolution: Array.from(monthlyMap.values()),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
