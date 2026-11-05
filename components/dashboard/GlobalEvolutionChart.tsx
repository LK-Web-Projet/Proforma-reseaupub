import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export interface MonthlyEvolutionPoint {
  month: string;
  recettes: number;
  depenses: number;
  proformasValidees: number;
}

interface GlobalEvolutionChartProps {
  data: MonthlyEvolutionPoint[];
  formatCurrency: (value: number) => string;
}

export function GlobalEvolutionChart({ data, formatCurrency }: GlobalEvolutionChartProps) {
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
            <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="proformasValidees" name="Proformas validées" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
