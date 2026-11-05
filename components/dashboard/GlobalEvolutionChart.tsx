'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DashboardDetailDialog, type SelectedDetail } from '@/components/dashboard/DashboardDetailDialog';
import type {
  RecetteDetailLine,
  DepenseDetailLine,
  ProformaValideeDetailLine,
} from '@/components/dashboard/MonthlyFluctuationChart';

export interface MonthlyEvolutionPoint {
  month: string;
  monthLabel: string;
  recettes: number;
  depenses: number;
  proformasValidees: number;
  recettesDetail: RecetteDetailLine[];
  depensesDetail: DepenseDetailLine[];
  proformasValideesDetail: ProformaValideeDetailLine[];
}

interface GlobalEvolutionChartProps {
  data: MonthlyEvolutionPoint[];
  formatCurrency: (value: number) => string;
}

const SERIES_LABEL = {
  recettes: 'Recettes',
  depenses: 'Dépenses',
  proformasValidees: 'Proformas validées',
} as const;

type SeriesKey = keyof typeof SERIES_LABEL;

export function GlobalEvolutionChart({ data, formatCurrency }: GlobalEvolutionChartProps) {
  const [selected, setSelected] = useState<SelectedDetail | null>(null);

  const handleBarClick = (series: SeriesKey) => (barData: { payload?: MonthlyEvolutionPoint }) => {
    const point = barData?.payload;
    if (!point) return;
    setSelected({
      series,
      label: SERIES_LABEL[series],
      periodLabel: point.monthLabel,
      total: point[series],
      items:
        series === 'recettes' ? point.recettesDetail :
        series === 'depenses' ? point.depensesDetail :
        point.proformasValideesDetail,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution CA vs Dépenses (12 derniers mois)</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
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
