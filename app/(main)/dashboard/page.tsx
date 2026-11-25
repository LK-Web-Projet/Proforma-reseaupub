'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DashboardPageSkeleton } from '@/components/DashboardPageSkeleton';
import { StatCard } from '@/components/StatCard';
import { TresorerieSection, type TresorerieData } from '@/components/dashboard/TresorerieSection';
import { CashFlowEvolutionChart } from '@/components/dashboard/CashFlowEvolutionChart';
import { GlobalEvolutionChart, type MonthlyEvolutionPoint } from '@/components/dashboard/GlobalEvolutionChart';
import { MargeProformaSection, type MargeProforma } from '@/components/dashboard/MargeProformaSection';
import {
  ExtraIndicatorsSection,
  type TopDebiteur,
  type ImpayesAnciens,
} from '@/components/dashboard/ExtraIndicatorsSection';
import { CashJournalLinesCard, type CashJournalLine } from '@/components/dashboard/CashJournalLinesCard';
import { MonthlyFluctuationChart, type DailyFluctuation } from '@/components/dashboard/MonthlyFluctuationChart';
import { DepensesDepartementCard } from '@/components/dashboard/DepensesDepartementCard';
import { AlertCircle, TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value);

interface GlobalData {
  tresorerie: TresorerieData;
  cashFlowEvolution: { month: string; solde: number }[];
  monthlyEvolution: MonthlyEvolutionPoint[];
  autresMouvementsTotal: number;
  margeParProforma: MargeProforma[];
  tauxConversion: number;
  topDebiteurs: TopDebiteur[];
  delaiMoyenReglement: number | null;
  impayesAnciens: ImpayesAnciens;
}

interface MonthData {
  tresorerie: TresorerieData;
  entreesLines: CashJournalLine[];
  entreesTotal: number;
  autresMouvementsTotal: number;
  sortiesLines: CashJournalLine[];
  sortiesTotal: number;
  fluctuation: DailyFluctuation[];
  margeProformaDuMois: number;
}

function ErrorBlock() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed rounded-xl">
      <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
      <p className="text-xl font-medium text-muted-foreground">Aucune donnée disponible</p>
    </div>
  );
}

export default function DashboardPage() {
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [tab, setTab] = useState<'global' | 'month'>('global');

  const fetchGlobal = useCallback(async () => {
    setLoadingGlobal(true);
    try {
      const res = await fetch('/api/dashboard?view=global');
      const json = await res.json();
      setGlobalData(json.error ? null : json);
    } catch (error) {
      console.error(error);
      setGlobalData(null);
    } finally {
      setLoadingGlobal(false);
    }
  }, []);

  const fetchMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const res = await fetch('/api/dashboard?view=month');
      const json = await res.json();
      setMonthData(json.error ? null : json);
    } catch (error) {
      console.error(error);
      setMonthData(null);
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobal();
  }, [fetchGlobal]);

  const handleTabChange = (value: string) => {
    const next = value === 'month' ? 'month' : 'global';
    setTab(next);
    if (next === 'month' && !monthData && !loadingMonth) {
      fetchMonth();
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground mt-1">Les indicateurs clés pour piloter l&apos;activité</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
          </span>
          Données en temps réel
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
          <TabsTrigger value="global">Général</TabsTrigger>
          <TabsTrigger value="month">Ce mois</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-8 mt-6">
          {loadingGlobal ? (
            <DashboardPageSkeleton />
          ) : !globalData ? (
            <ErrorBlock />
          ) : (
            <>
              <TresorerieSection tresorerie={globalData.tresorerie} formatCurrency={formatCurrency} />
              <CashFlowEvolutionChart data={globalData.cashFlowEvolution} formatCurrency={formatCurrency} />
              <GlobalEvolutionChart data={globalData.monthlyEvolution} formatCurrency={formatCurrency} />
              <p className="text-xs text-muted-foreground -mt-4 flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                Autres mouvements de caisse (apports, transferts entre caisses — hors chiffre d&apos;affaires) sur les 12 derniers mois :{' '}
                <span className="font-medium text-foreground">{formatCurrency(globalData.autresMouvementsTotal)}</span>
              </p>
              <MargeProformaSection data={globalData.margeParProforma} formatCurrency={formatCurrency} />
              <ExtraIndicatorsSection
                tauxConversion={globalData.tauxConversion}
                delaiMoyenReglement={globalData.delaiMoyenReglement}
                impayesAnciens={globalData.impayesAnciens}
                topDebiteurs={globalData.topDebiteurs}
                formatCurrency={formatCurrency}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="month" className="space-y-8 mt-6">
          {loadingMonth ? (
            <DashboardPageSkeleton />
          ) : !monthData ? (
            <ErrorBlock />
          ) : (
            <>
              <TresorerieSection tresorerie={monthData.tresorerie} formatCurrency={formatCurrency} compact />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Entrées du mois"
                  value={formatCurrency(monthData.entreesTotal)}
                  subValue="Recettes liées à une proforma (CA réel), hors apports et transferts"
                  icon={TrendingUp}
                  accent={{ bg: 'bg-green-100', text: 'text-green-700', border: 'border-t-green-500' }}
                />
                <StatCard
                  title="Sorties du mois"
                  value={formatCurrency(monthData.sortiesTotal)}
                  icon={TrendingDown}
                  accent={{ bg: 'bg-red-100', text: 'text-red-700', border: 'border-t-red-500' }}
                />
                <StatCard
                  title="Marge brute (paiements proforma) du mois"
                  value={formatCurrency(monthData.margeProformaDuMois)}
                  subValue="Basée sur les paiements liés aux proformas — peut différer de la caisse globale (loyer, salaires, etc.)"
                  icon={Wallet}
                  accent={{ bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-t-blue-500' }}
                />
                <StatCard
                  title="Autres mouvements de caisse"
                  value={formatCurrency(monthData.autresMouvementsTotal)}
                  subValue="Apports de caisse et transferts entre caisses — hors chiffre d'affaires"
                  icon={ArrowLeftRight}
                  accent={{ bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-t-slate-400' }}
                />
              </div>

              <DepensesDepartementCard formatCurrency={formatCurrency} />

              <MonthlyFluctuationChart data={monthData.fluctuation} formatCurrency={formatCurrency} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CashJournalLinesCard
                  title="Lignes d'entrée"
                  kind="entrees"
                  lines={monthData.entreesLines}
                  total={monthData.entreesTotal}
                  formatCurrency={formatCurrency}
                />
                <CashJournalLinesCard
                  title="Lignes de sortie"
                  kind="sorties"
                  lines={monthData.sortiesLines}
                  total={monthData.sortiesTotal}
                  formatCurrency={formatCurrency}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
