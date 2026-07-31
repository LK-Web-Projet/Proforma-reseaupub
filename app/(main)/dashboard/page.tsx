'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle, Wallet, LucideIcon, ShoppingCart, Users,
} from 'lucide-react';

const formatFcfa = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

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

interface DashboardData {
  commandeTotal: number;
  encaisseTotal: number;
  resteAPayerTotal: number;
  byYear: YearStat[];
  soldeCaisseTotal: number;
  cashRegisters: { name: string; balance: number }[];
  cashMonthlyEvolution: MonthlyStat[];
}

interface StatCardAccent {
  bg: string;
  text: string;
  border: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  colorClass?: StatCardAccent;
}

const StatCard = ({ title, value, subValue, icon: Icon, colorClass }: StatCardProps) => (
  <Card className={`border-t-4 ${colorClass?.border || 'border-t-primary'} shadow-sm hover:shadow-md transition-shadow`}>
    <CardContent className="pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-1 truncate">{value}</h3>
          {subValue && <p className="text-xs text-muted-foreground mt-2">{subValue}</p>}
        </div>
        <div className={`shrink-0 p-3 rounded-xl ${colorClass?.bg || 'bg-primary/10'} ${colorClass?.text || 'text-primary'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value);
};

function DashboardSkeleton() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        setData(json.error ? null : json);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading && !data) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-xl">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-xl font-medium text-muted-foreground">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de l&apos;activité financière</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
          </span>
          Données en temps réel
        </div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Solde par caisse</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {data.cashRegisters.map((register) => (
            <Card
              key={register.name}
              className="w-full sm:w-56 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate">{register.name}</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{formatFcfa(register.balance)}</div>
              </CardContent>
            </Card>
          ))}
          {data.cashRegisters.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune caisse visible</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Vue d&apos;ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Commande Totale"
            value={formatCurrency(data.commandeTotal)}
            subValue="Factures validées, payées ou soldées"
            icon={ShoppingCart}
            colorClass={{ bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-t-blue-500' }}
          />
          <StatCard
            title="Encaissement Total"
            value={formatCurrency(data.encaisseTotal)}
            subValue={`Reste à encaisser : ${formatCurrency(data.resteAPayerTotal)}`}
            icon={Wallet}
            colorClass={{ bg: 'bg-green-100', text: 'text-green-700', border: 'border-t-green-500' }}
          />
          <StatCard
            title="Solde Caisse Total"
            value={formatCurrency(data.soldeCaisseTotal)}
            subValue={`${data.cashRegisters.length} caisse(s) visible(s)`}
            icon={Users}
            colorClass={{ bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-t-purple-500' }}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Commandé / Encaissé / Reste à encaisser par année</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byYear}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="commandeTotal" name="Commandé" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="encaisseTotal" name="Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resteAPayer" name="Reste à encaisser" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clients avec impayés par année</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byYear}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="clientsAvecImpaye" name="Clients avec impayé" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Évolution mensuelle de la Caisse ({new Date().getFullYear()})</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cashMonthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
