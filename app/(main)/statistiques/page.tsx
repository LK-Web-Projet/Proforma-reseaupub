'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatistiquesPageSkeleton } from '@/components/StatistiquesPageSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Package, CreditCard, 
  AlertCircle, CheckCircle2, FileText, Wallet, LucideIcon, Calendar as CalendarIcon
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type StatData = {
  count: number;
  sum: number;
};

type Stats = {
  totalInvoices: number;
  invoiceStats: {
    brouillon: StatData;
    envoyées: StatData;
    validées: StatData;
    payées: StatData;
    soldées: StatData;
    annulées: StatData;
    archivées: StatData;
  };
  cashStats: {
    recettes: number;
    depenses: number;
    balance: number;
  };
  outstandingPayments: number;
  revenueRealized: number;
  topClients: Array<{ name: string; amount: number; count: number }>;
  topProducts: Array<{ name: string; amount: number; quantity: number }>;
  monthlyEvolution: Array<{ month: string; revenue: number; expenses: number }>;
  proformaEvolution: Array<{ month: string; revenue: number; expenses: number }>;
};

type Client = {
  id: string;
  nom: string;
};

type Gestionnaire = {
  id: string;
  nom: string;
  prenom: string;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  colorClass?: string;
}

const StatCard = ({ title, value, subValue, icon: Icon, colorClass }: StatCardProps) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
          {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-full ${colorClass || 'bg-primary/10 text-primary'}`}>
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
    maximumFractionDigits: 0
  }).format(value);
};

export default function StatistiquesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [filters, setFilters] = useState({
    clientId: '',
    gestionnaireId: '',
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (currentFilters: { clientId?: string; gestionnaireId?: string; }, currentRange?: DateRange) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentFilters?.clientId) params.append('clientId', currentFilters.clientId);
    if (currentFilters?.gestionnaireId) params.append('gestionnaireId', currentFilters.gestionnaireId);

    if (currentRange?.from) {
      params.append('startDate', currentRange.from.toISOString());
    }
    if (currentRange?.to) {
      params.append('endDate', currentRange.to.toISOString());
    }

    try {
      const res = await fetch(`/api/statistiques?${params.toString()}`);
      const data = await res.json();
      setStats(data.error ? null : data);
    } catch (e) {
      console.error(e);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
        try {
            const [clientsRes, gestRes] = await Promise.all([
                fetch('/api/clients'),
                fetch('/api/gestionnaires')
            ]);
            const [clientsData, gestData] = await Promise.all([
                clientsRes.json(),
                gestRes.json()
            ]);
            if (!clientsData.error) setClients(clientsData);
            if (!gestData.error) setGestionnaires(gestData);
        } catch (e) {
            console.error(e);
        }
        const initialFilters = { clientId: '', gestionnaireId: '' };
        const initialRange = { from: startOfYear(new Date()), to: endOfYear(new Date()) };
        await fetchStats(initialFilters, initialRange);
    };
    initData();
  }, [fetchStats]); // fetchStats est stable (useCallback avec deps []), donc exécuté seulement au montage

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    fetchStats(filters, dateRange);
  };

  const handleResetFilters = () => {
    const defaultRange = {
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    };
    const newFilters = {
      clientId: '',
      gestionnaireId: '',
    };
    setFilters(newFilters);
    setDateRange(defaultRange);
    fetchStats(newFilters, defaultRange);
  };

  const clientOptions = clients.map(c => ({ value: c.id, label: c.nom }));
  const gestionnaireOptions = gestionnaires.map(g => ({ value: g.id, label: `${g.prenom} ${g.nom}` }));

  if (loading && !stats) return <StatistiquesPageSkeleton />;

  const statusDistribution = stats ? [
    { name: 'Brouillon', value: stats.invoiceStats.brouillon.count },
    { name: 'Envoyées', value: stats.invoiceStats.envoyées.count },
    { name: 'Validées', value: stats.invoiceStats.validées.count },
    { name: 'Payées', value: stats.invoiceStats.payées.count },
    { name: 'Soldées', value: stats.invoiceStats.soldées.count },
    { name: 'Annulées', value: stats.invoiceStats.annulées.count },
  ].filter(s => s.value > 0) : [];

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Tableau de Bord</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span>Données actualisées en temps réel</span>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-slate-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Filtres d&apos;analyse
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium">Client</label>
            <Combobox
              options={clientOptions}
              value={filters.clientId}
              onChange={(value) => handleFilterChange("clientId", value)}
              placeholder="Tous les clients"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Commercial</label>
            <Combobox 
              options={gestionnaireOptions}
              value={filters.gestionnaireId}
              onChange={(value) => handleFilterChange("gestionnaireId", value)}
              placeholder="Tous les commerciaux"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium">Période</label>
            <div className={cn("grid gap-2")}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 bg-white",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd LLL y", { locale: fr })} -{" "}
                          {format(dateRange.to, "dd LLL y", { locale: fr })}
                        </>
                      ) : (
                        format(dateRange.from, "dd LLL y", { locale: fr })
                      )
                    ) : (
                      <span>Sélectionner une période</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleApplyFilters} className="w-full">Filtrer</Button>
            <Button onClick={handleResetFilters} variant="outline" className="w-full">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
            <TabsTrigger value="financials">Trésorerie</TabsTrigger>
            <TabsTrigger value="sales">Ventes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="CA Réalisé" 
                value={formatCurrency(stats.revenueRealized)} 
                subValue="Factures Validées/Payées"
                icon={TrendingUp}
                colorClass="bg-green-100 text-green-700"
              />
              <StatCard 
                title="Encours Client" 
                value={formatCurrency(stats.outstandingPayments)} 
                subValue="Reste à recouvrer"
                icon={AlertCircle}
                colorClass="bg-orange-100 text-orange-700"
              />
              <StatCard 
                title="Recettes (Caisse)" 
                value={formatCurrency(stats.cashStats.recettes)} 
                subValue="Encaissements réels"
                icon={Wallet}
                colorClass="bg-blue-100 text-blue-700"
              />
              <StatCard 
                title="Dépenses" 
                value={formatCurrency(stats.cashStats.depenses)} 
                subValue="Décaissements réels"
                icon={TrendingDown}
                colorClass="bg-red-100 text-red-700"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Évolution CA vs Dépenses</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyEvolution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Répartition des Factures</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financials" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard 
                title="Solde de Trésorerie" 
                value={formatCurrency(stats.cashStats.balance)} 
                subValue="Balance Recettes - Dépenses"
                icon={CheckCircle2}
                colorClass={stats.cashStats.balance >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
              />
              <StatCard 
                title="Nombre total de Factures" 
                value={stats.totalInvoices} 
                icon={FileText}
              />
              <StatCard 
                title="Moyenne par Facture" 
                value={formatCurrency(stats.totalInvoices > 0 ? stats.revenueRealized / stats.totalInvoices : 0)} 
                icon={CreditCard}
              />
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Flux de Trésorerie Mensuel</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.monthlyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Recettes" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard 
                title="Ventes Validées" 
                value={formatCurrency(stats.invoiceStats.validées.sum)} 
                subValue={`${stats.invoiceStats.validées.count} factures (Total TTC)`}
                icon={CheckCircle2}
                colorClass="bg-blue-100 text-blue-700"
              />
              <StatCard 
                title="Ventes Payées" 
                value={formatCurrency(stats.invoiceStats.payées.sum)} 
                subValue={`${stats.invoiceStats.payées.count} factures (Encaissements)`}
                icon={Wallet}
                colorClass="bg-indigo-100 text-indigo-700"
              />
              <StatCard 
                title="Ventes Soldées" 
                value={formatCurrency(stats.invoiceStats.soldées.sum)} 
                subValue={`${stats.invoiceStats.soldées.count} factures (Encaissées)`}
                icon={TrendingUp}
                colorClass="bg-green-100 text-green-700"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> Top 5 Clients (CA Réalisé)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.topClients.map((client, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="font-semibold">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.count} factures</p>
                        </div>
                        <p className="font-bold text-blue-600">{formatCurrency(client.amount)}</p>
                      </div>
                    ))}
                    {stats.topClients.length === 0 && <p className="text-center text-muted-foreground">Aucun client trouvé</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-500" /> Top 5 Produits (CA Réalisé)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.topProducts.map((prod, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="max-w-[70%]">
                          <p className="font-semibold truncate">{prod.name}</p>
                          <p className="text-xs text-muted-foreground">Qté: {prod.quantity}</p>
                        </div>
                        <p className="font-bold text-purple-600">{formatCurrency(prod.amount)}</p>
                      </div>
                    ))}
                    {stats.topProducts.length === 0 && <p className="text-center text-muted-foreground">Aucun produit trouvé</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Analyse des Paiements et Dépenses (Proforma)</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.proformaEvolution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="revenue" name="Entrées Proforma" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Dépenses Proforma" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-xl">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-xl font-medium text-muted-foreground">Aucune donnée disponible pour cette période</p>
          <Button onClick={handleResetFilters} variant="link">Réinitialiser les filtres</Button>
        </div>
      )}
    </div>
  );
}
