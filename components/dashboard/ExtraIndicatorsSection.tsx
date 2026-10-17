import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Clock, AlertTriangle, UserX } from 'lucide-react';

export interface TopDebiteur {
  clientId: string;
  nom: string;
  montant: number;
  nbFactures: number;
}

export interface ImpayesAnciens {
  total: number;
  count: number;
  liste: { id: string; numero: string; client: string; montant: number; anciennete: number }[];
}

interface ExtraIndicatorsSectionProps {
  tauxConversion: number;
  delaiMoyenReglement: number | null;
  impayesAnciens: ImpayesAnciens;
  topDebiteurs: TopDebiteur[];
  formatCurrency: (value: number) => string;
}

export function ExtraIndicatorsSection({
  tauxConversion,
  delaiMoyenReglement,
  impayesAnciens,
  topDebiteurs,
  formatCurrency,
}: ExtraIndicatorsSectionProps) {
  const plusGrosDebiteur = topDebiteurs[0];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Autres indicateurs clés</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Taux de conversion"
          value={`${tauxConversion}%`}
          subValue="Proformas payées ou soldées"
          icon={Target}
          accent={{ bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-t-blue-500' }}
        />
        <StatCard
          title="Délai moyen de règlement"
          value={delaiMoyenReglement !== null ? `${delaiMoyenReglement} jours` : 'N/A'}
          subValue="Proformas soldées (12 derniers mois)"
          icon={Clock}
          accent={{ bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-t-purple-500' }}
        />
        <StatCard
          title="Impayés anciens (+30j)"
          value={formatCurrency(impayesAnciens.total)}
          subValue={`${impayesAnciens.count} proforma(s)`}
          icon={AlertTriangle}
          accent={{ bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-t-orange-500' }}
        />
        <StatCard
          title="Plus gros débiteur"
          value={plusGrosDebiteur ? plusGrosDebiteur.nom : 'Aucun'}
          subValue={plusGrosDebiteur ? formatCurrency(plusGrosDebiteur.montant) : undefined}
          icon={UserX}
          accent={{ bg: 'bg-red-100', text: 'text-red-700', border: 'border-t-red-500' }}
        />
      </div>

      {topDebiteurs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 clients débiteurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topDebiteurs.map((d) => (
              <div key={d.clientId} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{d.nom}</p>
                  <p className="text-xs text-muted-foreground">{d.nbFactures} facture(s) impayée(s)</p>
                </div>
                <span className="text-sm font-semibold text-red-700">{formatCurrency(d.montant)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
