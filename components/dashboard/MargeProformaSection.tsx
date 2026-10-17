'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export interface MargeProforma {
  id: string;
  numero: string;
  client: string;
  objet: string;
  statut: string;
  totalTTC: number;
  encaisse: number;
  depense: number;
  margeBrute: number;
}

interface MargeProformaSectionProps {
  data: MargeProforma[];
  formatCurrency: (value: number) => string;
}

export function MargeProformaSection({ data, formatCurrency }: MargeProformaSectionProps) {
  const chartData = useMemo(() => {
    if (data.length <= 10) return data;
    const top5 = data.slice(0, 5);
    const bottom5 = data.slice(-5);
    return [...top5, ...bottom5];
  }, [data]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Marge brute par proforma</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Proformas émises, validées, payées ou soldées — Marge = encaissements − dépenses directement liées.
        </p>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meilleures et moins bonnes marges</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="numero" fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="margeBrute" name="Marge brute" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.margeBrute >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Proforma</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Dépensé</TableHead>
                  <TableHead className="text-right">Marge brute</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Aucune proforma émise, validée, payée ou soldée.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <div>{row.numero}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.objet}</div>
                      </TableCell>
                      <TableCell>{row.client}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.statut}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-700">{formatCurrency(row.encaisse)}</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(row.depense)}</TableCell>
                      <TableCell className={`text-right font-semibold ${row.margeBrute >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(row.margeBrute)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
