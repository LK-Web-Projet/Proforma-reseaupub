import { requireAnyPage } from "@/lib/authz";
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { StatusFacture, OperationType } from '@prisma/client';
import {
  format,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  type RecetteDetailLine,
  type DepenseDetailLine,
  type ProformaValideeDetailLine,
  isInternalTransferOut,
  isEcritureBudgetAnnulee,
  BUDGET_ANNULATION_SELECT,
} from '@/lib/dashboardReporting';

interface WeeklyBucket {
  weekLabel: string;
  weekStart: string;
  recettes: number;
  depenses: number;
  proformasValidees: number;
  recettesDetail: RecetteDetailLine[];
  depensesDetail: DepenseDetailLine[];
  proformasValideesDetail: ProformaValideeDetailLine[];
}

// Rapport "Trésorerie hebdomadaire" : même logique que la vue "Ce mois" (par jour) et
// "Général" (par mois) de app/api/dashboard/route.ts, mais agrégée par semaine (lundi-dimanche),
// sur une période personnalisable (?from=&to=, par défaut les 12 dernières semaines).
export async function GET(request: Request) {
  const refusAcces = await requireAnyPage(["dashboard"]);
  if (refusAcces) return refusAcces;
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now;
    const from = searchParams.get('from')
      ? new Date(searchParams.get('from')!)
      : subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 11);

    const periodStart = startOfWeek(from, { weekStartsOn: 1 });
    const periodEnd = endOfWeek(to, { weekStartsOn: 1 });

    const cashRegisters = await prisma.cashRegister.findMany({ where: { view: true } });
    const visibleIds = cashRegisters.map((r) => r.id);
    const visibleIdsSet = new Set(visibleIds);

    const [entries, validatedInvoices] = await Promise.all([
      prisma.cashJournal.findMany({
        where: {
          cashRegisterId: { in: visibleIds },
          type: { in: [OperationType.RECETTE, OperationType.DEPENSE] },
          date_operation: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          date_operation: true,
          type: true,
          montant: true,
          libelle: true,
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
          ...BUDGET_ANNULATION_SELECT,
        },
      }),
      // Proformas ayant atteint "Valider" (même si elles ont depuis progressé vers
      // Payer/Solde), classées sur dateValidation si connue, sinon dateCreation
      // (proformas validées avant l'ajout de ce champ — voir HISTORIQUE.md).
      prisma.invoice.findMany({
        where: {
          statut: { in: [StatusFacture.Valider, StatusFacture.Payer, StatusFacture.Solde] },
          OR: [
            { dateValidation: { gte: periodStart, lte: periodEnd } },
            { dateValidation: null, dateCreation: { gte: periodStart, lte: periodEnd } },
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

    const weeks = eachWeekOfInterval({ start: periodStart, end: periodEnd }, { weekStartsOn: 1 });
    const weeklyMap = new Map<string, WeeklyBucket>();
    for (const w of weeks) {
      const key = format(w, 'yyyy-MM-dd');
      const weekEnd = endOfWeek(w, { weekStartsOn: 1 });
      weeklyMap.set(key, {
        weekLabel: `${format(w, 'd MMM', { locale: fr })} – ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`,
        weekStart: key,
        recettes: 0,
        depenses: 0,
        proformasValidees: 0,
        recettesDetail: [],
        depensesDetail: [],
        proformasValideesDetail: [],
      });
    }

    // "Recettes" = uniquement les lignes liées à un paiement de proforma (CA réel) — les
    // apports de caisse et transferts entre caisses n'ont jamais de `paiement.invoice` lié,
    // ce seul critère les exclut naturellement (voir app/api/dashboard/route.ts).
    let autresMouvementsTotal = 0;
    for (const e of entries) {
      const bucket = weeklyMap.get(format(startOfWeek(e.date_operation, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      if (!bucket || isEcritureBudgetAnnulee(e)) continue;
      const client = e.paiement?.invoice?.client ?? null;

      if (e.type === OperationType.RECETTE && !!e.paiement?.invoice) {
        bucket.recettes += e.montant;
        bucket.recettesDetail.push({
          id: e.id,
          libelle: e.libelle,
          montant: e.montant,
          caisse: e.cashRegister.name,
          client,
          resteAPayer: e.paiement?.invoice ? Number(e.paiement.invoice.resteAPayer) : 0,
        });
      } else if (e.type === OperationType.RECETTE) {
        autresMouvementsTotal += e.montant;
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
      const bucket = weeklyMap.get(format(startOfWeek(refDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
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

    return NextResponse.json({ weeks: Array.from(weeklyMap.values()), autresMouvementsTotal });
  } catch (error) {
    console.error('Erreur lors de la récupération du rapport trésorerie hebdomadaire :', error);
    return NextResponse.json({ error: 'Erreur Interne du Serveur' }, { status: 500 });
  }
}
