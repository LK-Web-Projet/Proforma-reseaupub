import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface MonthlyFluctuationChartProps {
  data: { day: string; recettes: number; depenses: number }[];
  formatCurrency: (value: number) => string;
}

export function MonthlyFluctuationChart({ data, formatCurrency }: MonthlyFluctuationChartProps) {
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
            <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
