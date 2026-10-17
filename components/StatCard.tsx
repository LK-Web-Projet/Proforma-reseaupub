import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

export interface StatCardAccent {
  bg: string;
  text: string;
  border: string;
}

export interface StatCardTrend {
  direction: 'up' | 'down';
  label: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  accent?: StatCardAccent;
  trend?: StatCardTrend;
}

/**
 * Carte KPI partagée, utilisée par le tableau de bord. Volontairement distincte du
 * StatCard local de app/(main)/statistiques/page.tsx (page intouchée par ailleurs).
 */
export function StatCard({ title, value, subValue, icon: Icon, accent, trend }: StatCardProps) {
  return (
    <Card className={`border-t-4 ${accent?.border || 'border-t-primary'} shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-1 truncate">{value}</h3>
            {subValue && <p className="text-xs text-muted-foreground mt-2">{subValue}</p>}
            {trend && (
              <div
                className={`flex items-center gap-1 text-xs font-semibold mt-2 ${
                  trend.direction === 'up' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {trend.label}
              </div>
            )}
          </div>
          <div className={`shrink-0 p-3 rounded-xl ${accent?.bg || 'bg-primary/10'} ${accent?.text || 'text-primary'}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
