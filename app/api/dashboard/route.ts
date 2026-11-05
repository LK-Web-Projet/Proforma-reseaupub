import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture, OperationType, PaiementType } from '@prisma/client';
import {
  format,
  eachMonthOfInterval,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  differenceInDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// Même table de conversion que app/api/statistiques/route.ts, pour rester cohérent
// dans toute l'app quand on agrège des montants multi-devises.
const EXCHANGE_RATES: Record<string, number> = { EUR: 655.957, USD: 615, XOF: 1 };

// "Émise, validée ou payée" au sens de l'utilisateur = tous les statuts sauf Brouillon,
// Annuler et Archiver (qui ne représentent pas une activité commerciale réelle à marger).
const MARGE_STATUSES: StatusFacture[] = [
  StatusFacture.Envoyer,
  StatusFacture.Valider,
  StatusFacture.Payer,
  StatusFacture.Solde,
];

// Statuts pouvant avoir un reste à payer actif (exclut Solde/Annuler/Archiver/Brouillon).
const IMPAYE_STATUSES: StatusFacture[] = [
  StatusFacture.Envoyer,
  StatusFacture.Valider,
  StatusFacture.Payer,
];

// --- Détection des transferts internes entre caisses visibles -----------------------
// Reprend exactement la logique de app/(main)/journal-caisse/page.tsx (totalRecettesGlobal/
// totalDepensesGlobal) : un virement entre deux caisses crée deux lignes réelles
// ("Transfert depuis/vers caisse ID X"), à exclure des totaux bruts uniquement si les DEUX
// extrémités sont des caisses visibles (sinon c'est un vrai flux externe).
function isInternalTransferIn(libelle: string, visibleIds: Set<number>): boolean {
  const m = libelle.match(/Transfert depuis caisse ID (\d+)/i);
  return m ? visibleIds.has(parseInt(m[1], 10)) : false;
}
function isInternalTransferOut(libelle: string, visibleIds: Set<number>): boolean {
  const m = libelle.match(/Transfert vers caisse ID (\d+)/i);
  return m ? visibleIds.has(parseInt(m[1], 10)) : false;
}

// --- Trésorerie : soldes + tendance 30 jours, partagés par les deux vues ------------
async function getTresorerieSnapshot(now: Date) {
  const cashRegisters = await prisma.cashRegister.findMany({
    where: { view: true },
    orderBy: { name: 'asc' },
  });
  const visibleIds = cashRegisters.map((r) => r.id);
  const visibleIdsSet = new Set(visibleIds);
  const soldeTotal = cashRegisters.reduce((s, r) => s + r.balance, 0);

  // Fenêtre de 13 mois : sert à la fois à la tendance 30 jours et à l'évolution 12 mois
  // (vue Général), une seule requête pour les deux.
  const windowStart = startOfMonth(subMonths(now, 12));
  const entries = await prisma.cashJournal.findMany({
    where: {
      cashRegisterId: { in: visibleIds },
      type: { in: [OperationType.RECETTE, OperationType.DEPENSE] },
      date_operation: { gte: windowStart, lte: now },
    },
    select: { date_operation: true, type: true, montant: true, libelle: true },
  });

  const thirtyDaysAgo = subDays(now, 30);
  const netFlow30 = entries
    .filter((e) => e.date_operation >= thirtyDaysAgo)
    .reduce((s, e) => s + (e.type === OperationType.RECETTE ? e.montant : -e.montant), 0);

  return {
    cashRegisters: cashRegisters.map((r) => ({ id: r.id, name: r.name, balance: r.balance })),
    soldeTotal,
    trend: {
      direction: (netFlow30 >= 0 ? 'up' : 'down') as 'up' | 'down',
      amount: netFlow30,
    },
    visibleIds,
    visibleIdsSet,
    entries13Mois: entries,
  };
}

// Reconstruit l'évolution de trésorerie des 12 derniers mois à rebours depuis le solde
// RÉEL actuel (fiable) — plutôt que de faire confiance à CashJournal.solde historique, qui
// peut dériver si une écriture rétroactive a été insérée (voir bouton "recalculer" caché
// dans journal-caisse).
function buildCashFlowEvolution(
  entries13Mois: { date_operation: Date; type: OperationType; montant: number }[],
  soldeTotal: number,
  now: Date
) {
  const monthlyNet = new Map<string, number>();
  for (const e of entries13Mois) {
    const key = format(e.date_operation, 'yyyy-MM');
    monthlyNet.set(key, (monthlyNet.get(key) ?? 0) + (e.type === OperationType.RECETTE ? e.montant : -e.montant));
  }

  const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now }).reverse();
  let running = soldeTotal;
  const points: { month: string; solde: number }[] = [];
  for (const m of months) {
    points.unshift({ month: format(m, 'MMM yy', { locale: fr }), solde: Math.round(running) });
    running -= monthlyNet.get(format(m, 'yyyy-MM')) ?? 0;
  }
  return points;
}

// Évolution mensuelle (12 derniers mois) pour la vue "Général" : recettes/dépenses réelles de
// caisse (mêmes exclusions de transferts internes que la vue "Ce mois") + montant des proformas
// validées/payées/soldées sur chaque mois, classées sur dateValidation si connue, sinon
// dateCreation (proformas validées avant l'ajout de ce champ — voir HISTORIQUE.md).
async function getMonthlyEvolution(
  now: Date,
  entries13Mois: { date_operation: Date; type: OperationType; montant: number; libelle: string }[],
  visibleIdsSet: Set<number>
) {
  const windowStart = startOfMonth(subMonths(now, 11));

  const validatedInvoices = await prisma.invoice.findMany({
    where: {
      statut: { in: [StatusFacture.Valider, StatusFacture.Payer, StatusFacture.Solde] },
      OR: [
        { dateValidation: { gte: windowStart, lte: now } },
        { dateValidation: null, dateCreation: { gte: windowStart, lte: now } },
      ],
    },
    select: { totalTTC: true, dateValidation: true, dateCreation: true },
  });

  const months = eachMonthOfInterval({ start: windowStart, end: now });
  const monthlyMap = new Map<string, { recettes: number; depenses: number; proformasValidees: number }>();
  for (const m of months) {
    monthlyMap.set(format(m, 'yyyy-MM'), { recettes: 0, depenses: 0, proformasValidees: 0 });
  }

  for (const e of entries13Mois) {
    const bucket = monthlyMap.get(format(e.date_operation, 'yyyy-MM'));
    if (!bucket) continue;
    if (e.type === OperationType.RECETTE && !isInternalTransferIn(e.libelle, visibleIdsSet)) bucket.recettes += e.montant;
    else if (e.type === OperationType.DEPENSE && !isInternalTransferOut(e.libelle, visibleIdsSet)) bucket.depenses += e.montant;
  }
  for (const inv of validatedInvoices) {
    const refDate = inv.dateValidation ?? inv.dateCreation;
    const bucket = monthlyMap.get(format(refDate, 'yyyy-MM'));
    if (!bucket) continue;
    bucket.proformasValidees += Number(inv.totalTTC);
  }

  return months.map((m) => ({
    month: format(m, 'MMM yy', { locale: fr }),
    ...monthlyMap.get(format(m, 'yyyy-MM'))!,
  }));
}

// --- Vue "Général" -------------------------------------------------------------------
async function getGlobalView(now: Date) {
  const [invoices, sums, statutCounts, debiteurs, soldees, impayesAnciens] = await Promise.all([
    prisma.invoice.findMany({
      where: { statut: { in: MARGE_STATUSES } },
      select: {
        id: true,
        numero: true,
        objet: true,
        dateCreation: true,
        statut: true,
        totalTTC: true,
        devise: true,
        client: { select: { nom: true } },
      },
      orderBy: { dateCreation: 'desc' },
    }),
    prisma.paiement.groupBy({
      by: ['invoiceId', 'type'],
      _sum: { montant: true },
    }),
    prisma.invoice.groupBy({
      by: ['statut'],
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ['clientId'],
      where: { resteAPayer: { gt: 0 }, statut: { in: IMPAYE_STATUSES } },
      _sum: { resteAPayer: true },
      _count: { _all: true },
      orderBy: { _sum: { resteAPayer: 'desc' } },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { statut: StatusFacture.Solde, dateCreation: { gte: subMonths(now, 12) } },
      select: {
        dateCreation: true,
        paiements: {
          where: { type: PaiementType.PAIEMENT },
          orderBy: { datePaiement: 'desc' },
          take: 1,
          select: { datePaiement: true },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        statut: { in: IMPAYE_STATUSES },
        resteAPayer: { gt: 0 },
        dateCreation: { lte: subDays(now, 30) },
      },
      select: { id: true, numero: true, resteAPayer: true, dateCreation: true, client: { select: { nom: true } } },
      orderBy: { dateCreation: 'asc' },
    }),
  ]);

  // Marge brute par proforma = Σ Paiement(PAIEMENT) − Σ Paiement(DEPENSE), par invoiceId.
  const sumsByInvoice = new Map<string, { paiement: number; depense: number }>();
  for (const s of sums) {
    const cur = sumsByInvoice.get(s.invoiceId) ?? { paiement: 0, depense: 0 };
    if (s.type === PaiementType.PAIEMENT) cur.paiement += Number(s._sum.montant ?? 0);
    else cur.depense += Number(s._sum.montant ?? 0);
    sumsByInvoice.set(s.invoiceId, cur);
  }
  const margeParProforma = invoices
    .map((inv) => {
      const rate = EXCHANGE_RATES[inv.devise] ?? 1;
      const { paiement = 0, depense = 0 } = sumsByInvoice.get(inv.id) ?? {};
      const encaisse = paiement * rate;
      const depenseXOF = depense * rate;
      return {
        id: inv.id,
        numero: inv.numero,
        client: inv.client.nom,
        objet: inv.objet,
        statut: inv.statut,
        totalTTC: Number(inv.totalTTC) * rate,
        encaisse,
        depense: depenseXOF,
        margeBrute: encaisse - depenseXOF,
      };
    })
    .sort((a, b) => b.margeBrute - a.margeBrute);

  // Taux de conversion proforma émise -> payée/soldée.
  const countsByStatut = new Map<StatusFacture, number>();
  for (const s of statutCounts) countsByStatut.set(s.statut, s._count._all);
  const payeesOuSoldees = (countsByStatut.get(StatusFacture.Payer) ?? 0) + (countsByStatut.get(StatusFacture.Solde) ?? 0);
  const totalEmises = Array.from(countsByStatut.entries())
    .filter(([statut]) => statut !== StatusFacture.Brouillon)
    .reduce((acc, [, count]) => acc + count, 0);
  const tauxConversion = totalEmises > 0 ? Math.round((payeesOuSoldees / totalEmises) * 1000) / 10 : 0;

  // Top 5 clients débiteurs.
  const clientIds = debiteurs.map((d) => d.clientId);
  const clients = clientIds.length
    ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, nom: true } })
    : [];
  const clientNameById = new Map(clients.map((c) => [c.id, c.nom]));
  const topDebiteurs = debiteurs.map((d) => ({
    clientId: d.clientId,
    nom: clientNameById.get(d.clientId) ?? 'Client inconnu',
    montant: Number(d._sum.resteAPayer ?? 0),
    nbFactures: d._count._all,
  }));

  // Délai moyen de règlement (proformas soldées des 12 derniers mois).
  const delais = soldees
    .map((inv) => {
      const lastPaiement = inv.paiements[0]?.datePaiement;
      return lastPaiement ? differenceInDays(lastPaiement, inv.dateCreation) : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  const delaiMoyenReglement = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;

  // Impayés anciens (+30 jours) — pas de champ échéance dans le schéma, donc "ancienneté"
  // basée sur la date de création, pas un vrai retard contractuel.
  const impayesAnciensTotal = impayesAnciens.reduce((s, inv) => s + Number(inv.resteAPayer), 0);
  const impayesAnciensListe = impayesAnciens.slice(0, 10).map((inv) => ({
    id: inv.id,
    numero: inv.numero,
    client: inv.client.nom,
    montant: Number(inv.resteAPayer),
    anciennete: differenceInDays(now, inv.dateCreation),
  }));

  return {
    margeParProforma,
    tauxConversion,
    topDebiteurs,
    delaiMoyenReglement,
    impayesAnciens: { total: impayesAnciensTotal, count: impayesAnciens.length, liste: impayesAnciensListe },
  };
}

// --- Vue "Ce mois" ---------------------------------------------------------------------
async function getMonthView(now: Date, visibleIds: number[], visibleIdsSet: Set<number>) {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthEntries, monthPaiements, validatedInvoices] = await Promise.all([
    prisma.cashJournal.findMany({
      where: { cashRegisterId: { in: visibleIds }, date_operation: { gte: monthStart, lte: monthEnd } },
      orderBy: { date_operation: 'desc' },
      select: {
        id: true,
        date_operation: true,
        libelle: true,
        type: true,
        montant: true,
        isApportDeCaisse: true,
        cashRegisterId: true,
        cashRegister: { select: { name: true } },
        paiement: {
          select: {
            invoice: {
              select: {
                resteAPayer: true,
                client: { select: { id: true, nom: true } },
              },
            },
          },
        },
      },
    }),
    prisma.paiement.groupBy({
      by: ['type'],
      where: { datePaiement: { gte: monthStart, lte: monthEnd } },
      _sum: { montant: true },
    }),
    // Proformas ayant atteint "Valider" (même si elles ont depuis progressé vers
    // Payer/Solde), classées sur dateValidation si connue, sinon dateCreation
    // (proformas validées avant l'ajout de ce champ — voir HISTORIQUE.md).
    prisma.invoice.findMany({
      where: {
        statut: { in: [StatusFacture.Valider, StatusFacture.Payer, StatusFacture.Solde] },
        OR: [
          { dateValidation: { gte: monthStart, lte: monthEnd } },
          { dateValidation: null, dateCreation: { gte: monthStart, lte: monthEnd } },
        ],
      },
      select: {
        id: true,
        numero: true,
        totalTTC: true,
        dateValidation: true,
        dateCreation: true,
        client: { select: { id: true, nom: true } },
      },
    }),
  ]);

  const entreesLines = monthEntries.filter(
    (e) => e.type === OperationType.RECETTE && !isInternalTransferIn(e.libelle, visibleIdsSet)
  );
  const sortiesLines = monthEntries.filter(
    (e) => e.type === OperationType.DEPENSE && !isInternalTransferOut(e.libelle, visibleIdsSet)
  );
  const entreesTotal = entreesLines.reduce((s, e) => s + e.montant, 0);
  const sortiesTotal = sortiesLines.reduce((s, e) => s + e.montant, 0);

  // Fluctuation quotidienne (recettes/dépenses/proformas validées par jour du mois),
  // avec le détail des lignes concernées pour le dialog de détail au clic.
  interface DetailClient { id: string; nom: string }
  interface RecetteDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null; resteAPayer: number }
  interface DepenseDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null }
  interface ProformaValideeDetailLine { id: string; numero: string; totalTTC: number; client: DetailClient | null }
  interface DailyFluctuationBucket {
    day: string;
    date: string;
    recettes: number;
    depenses: number;
    proformasValidees: number;
    recettesDetail: RecetteDetailLine[];
    depensesDetail: DepenseDetailLine[];
    proformasValideesDetail: ProformaValideeDetailLine[];
  }

  const dailyMap = new Map<string, DailyFluctuationBucket>();
  for (const d of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    const key = format(d, 'yyyy-MM-dd');
    dailyMap.set(key, {
      day: format(d, 'd'),
      date: key,
      recettes: 0,
      depenses: 0,
      proformasValidees: 0,
      recettesDetail: [],
      depensesDetail: [],
      proformasValideesDetail: [],
    });
  }
  for (const e of monthEntries) {
    const bucket = dailyMap.get(format(e.date_operation, 'yyyy-MM-dd'));
    if (!bucket) continue;
    const client = e.paiement?.invoice?.client
      ? { id: e.paiement.invoice.client.id, nom: e.paiement.invoice.client.nom }
      : null;

    if (e.type === OperationType.RECETTE && !isInternalTransferIn(e.libelle, visibleIdsSet)) {
      bucket.recettes += e.montant;
      bucket.recettesDetail.push({
        id: e.id,
        libelle: e.libelle,
        montant: e.montant,
        caisse: e.cashRegister.name,
        client,
        resteAPayer: e.paiement?.invoice ? Number(e.paiement.invoice.resteAPayer) : 0,
      });
    } else if (e.type === OperationType.DEPENSE && !isInternalTransferOut(e.libelle, visibleIdsSet)) {
      bucket.depenses += e.montant;
      bucket.depensesDetail.push({
        id: e.id,
        libelle: e.libelle,
        montant: e.montant,
        caisse: e.cashRegister.name,
        client,
      });
    }
  }
  for (const inv of validatedInvoices) {
    const refDate = inv.dateValidation ?? inv.dateCreation;
    const bucket = dailyMap.get(format(refDate, 'yyyy-MM-dd'));
    if (!bucket) continue;
    const totalTTC = Number(inv.totalTTC);
    bucket.proformasValidees += totalTTC;
    bucket.proformasValideesDetail.push({
      id: inv.id,
      numero: inv.numero,
      totalTTC,
      client: inv.client ? { id: inv.client.id, nom: inv.client.nom } : null,
    });
  }

  const paiementSum = monthPaiements.find((p) => p.type === PaiementType.PAIEMENT)?._sum.montant ?? 0;
  const depenseSum = monthPaiements.find((p) => p.type === PaiementType.DEPENSE)?._sum.montant ?? 0;

  return {
    entreesLines: entreesLines.map((e) => ({
      id: e.id,
      date: e.date_operation,
      libelle: e.libelle,
      montant: e.montant,
      caisse: e.cashRegister.name,
      isApportDeCaisse: !!e.isApportDeCaisse,
      client: e.paiement?.invoice?.client
        ? { id: e.paiement.invoice.client.id, nom: e.paiement.invoice.client.nom }
        : null,
    })),
    entreesTotal,
    sortiesLines: sortiesLines.map((e) => ({
      id: e.id,
      date: e.date_operation,
      libelle: e.libelle,
      montant: e.montant,
      caisse: e.cashRegister.name,
      client: e.paiement?.invoice?.client
        ? { id: e.paiement.invoice.client.id, nom: e.paiement.invoice.client.nom }
        : null,
    })),
    sortiesTotal,
    fluctuation: Array.from(dailyMap.values()),
    margeProformaDuMois: Number(paiementSum) - Number(depenseSum),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') === 'month' ? 'month' : 'global';
    const now = new Date();

    const snapshot = await getTresorerieSnapshot(now);
    const tresorerie = {
      cashRegisters: snapshot.cashRegisters,
      soldeTotal: snapshot.soldeTotal,
      trend: snapshot.trend,
    };

    if (view === 'month') {
      const month = await getMonthView(now, snapshot.visibleIds, snapshot.visibleIdsSet);
      return NextResponse.json({ view, tresorerie, ...month });
    }

    const cashFlowEvolution = buildCashFlowEvolution(snapshot.entries13Mois, snapshot.soldeTotal, now);
    const monthlyEvolution = await getMonthlyEvolution(now, snapshot.entries13Mois, snapshot.visibleIdsSet);
    const global = await getGlobalView(now);
    return NextResponse.json({ view, tresorerie, cashFlowEvolution, monthlyEvolution, ...global });
  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
