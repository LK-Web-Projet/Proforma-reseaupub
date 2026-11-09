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

export interface WeeklyTreasuryPoint {
  weekLabel: string;
  weekStart: string;
  recettes: number;
  depenses: number;
  proformasValidees: number;
  recettesDetail: RecetteDetailLine[];
  depensesDetail: DepenseDetailLine[];
  proformasValideesDetail: ProformaValideeDetailLine[];
}

interface WeeklyTreasuryChartProps {
  data: WeeklyTreasuryPoint[];
  formatCurrency: (value: number) => string;
}

const SERIES_LABEL = {
  recettes: 'Recettes',
  depenses: 'Dépenses',
  proformasValidees: 'Proformas validées',
} as const;

type SeriesKey = keyof typeof SERIES_LABEL;

export function WeeklyTreasuryChart({ data, formatCurrency }: WeeklyTreasuryChartProps) {
  const [selected, setSelected] = useState<SelectedDetail | null>(null);

  const handleBarClick = (series: SeriesKey) => (barData: { payload?: WeeklyTreasuryPoint }) => {
    const point = barData?.payload;
    if (!point) return;
    setSelected({
      series,
      label: SERIES_LABEL[series],
      periodLabel: point.weekLabel,
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
        <CardTitle>Trésorerie hebdomadaire</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="weekLabel" fontSize={11} tickLine={false} axisLine={false} />
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
