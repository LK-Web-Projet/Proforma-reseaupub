import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { Wallet, Activity } from 'lucide-react';

export interface TresorerieData {
  cashRegisters: { id: number; name: string; balance: number }[];
  soldeTotal: number;
  trend: { direction: 'up' | 'down'; amount: number };
}

interface TresorerieSectionProps {
  tresorerie: TresorerieData;
  formatCurrency: (value: number) => string;
  compact?: boolean;
}

export function TresorerieSection({ tresorerie, formatCurrency, compact = false }: TresorerieSectionProps) {
  const { cashRegisters, soldeTotal, trend } = tresorerie;
  const trendValue = `${trend.direction === 'up' ? '+' : ''}${formatCurrency(trend.amount)}`;

  return (
    <section className="space-y-4">
      {!compact && (
        <>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Trésorerie disponible</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {cashRegisters.map((register) => (
              <Card key={register.id} className="w-full sm:w-56">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">{register.name}</CardTitle>
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Wallet className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{formatCurrency(register.balance)}</div>
                </CardContent>
              </Card>
            ))}
            {cashRegisters.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune caisse visible</p>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Trésorerie totale disponible"
          value={formatCurrency(soldeTotal)}
          subValue={compact ? undefined : `${cashRegisters.length} caisse(s) visible(s)`}
          icon={Wallet}
          accent={{ bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-t-blue-500' }}
        />
        <StatCard
          title="Tendance de trésorerie (30 jours)"
          value={trendValue}
          icon={Activity}
          accent={
            trend.direction === 'up'
              ? { bg: 'bg-green-100', text: 'text-green-700', border: 'border-t-green-500' }
              : { bg: 'bg-red-100', text: 'text-red-700', border: 'border-t-red-500' }
          }
          trend={{
            direction: trend.direction,
            label: trend.direction === 'up' ? 'La trésorerie monte' : 'La trésorerie baisse',
          }}
        />
      </div>
    </section>
  );
}
