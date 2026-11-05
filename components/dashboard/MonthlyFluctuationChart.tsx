'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DashboardDetailDialog, type SelectedDetail } from '@/components/dashboard/DashboardDetailDialog';

export interface DetailClient {
  id: string;
  nom: string;
}

export interface RecetteDetailLine {
  id: number;
  libelle: string;
  montant: number;
  caisse: string;
  client: DetailClient | null;
  resteAPayer: number;
}

export interface DepenseDetailLine {
  id: number;
  libelle: string;
  montant: number;
  caisse: string;
  client: DetailClient | null;
}

export interface ProformaValideeDetailLine {
  id: string;
  numero: string;
  totalTTC: number;
  client: DetailClient | null;
}

export interface DailyFluctuation {
  day: string;
  date: string;
  recettes: number;
  depenses: number;
  proformasValidees: number;
  recettesDetail: RecetteDetailLine[];
  depensesDetail: DepenseDetailLine[];
  proformasValideesDetail: ProformaValideeDetailLine[];
}

interface MonthlyFluctuationChartProps {
  data: DailyFluctuation[];
  formatCurrency: (value: number) => string;
}

const SERIES_LABEL = {
  recettes: 'Recettes',
  depenses: 'Dépenses',
  proformasValidees: 'Proformas validées',
} as const;

type SeriesKey = keyof typeof SERIES_LABEL;

export function MonthlyFluctuationChart({ data, formatCurrency }: MonthlyFluctuationChartProps) {
  const [selected, setSelected] = useState<SelectedDetail | null>(null);

  const handleBarClick = (series: SeriesKey) => (barData: { payload?: DailyFluctuation }) => {
    const day = barData?.payload;
    if (!day) return;
    setSelected({
      series,
      label: SERIES_LABEL[series],
      date: day.date,
      total: day[series],
      items:
        series === 'recettes' ? day.recettesDetail :
        series === 'depenses' ? day.depensesDetail :
        day.proformasValideesDetail,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluctuation quotidienne du mois</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar
              dataKey="recettes"
              name="Recettes"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick('recettes')}
            />
            <Bar
              dataKey="depenses"
              name="Dépenses"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick('depenses')}
            />
            <Bar
              dataKey="proformasValidees"
              name="Proformas validées"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick('proformasValidees')}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
      <DashboardDetailDialog
        selected={selected}
        onClose={() => setSelected(null)}
        formatCurrency={formatCurrency}
      />
    </Card>
  );
}
