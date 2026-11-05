'use client';

import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type {
  DetailClient,
  RecetteDetailLine,
  DepenseDetailLine,
  ProformaValideeDetailLine,
} from '@/components/dashboard/MonthlyFluctuationChart';

export interface SelectedDetail {
  series: 'recettes' | 'depenses' | 'proformasValidees';
  label: string;
  periodLabel: string; // ex: "14 novembre 2026" (jour) ou "novembre 2026" (mois) — déjà formaté
  total: number;
  items: RecetteDetailLine[] | DepenseDetailLine[] | ProformaValideeDetailLine[];
}

interface DashboardDetailDialogProps {
  selected: SelectedDetail | null;
  onClose: () => void;
  formatCurrency: (value: number) => string;
}

function ClientCell({ client }: { client: DetailClient | null }) {
  return client ? (
    <Link href={`/client/${client.id}`} className="text-primary hover:underline">
      {client.nom}
    </Link>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function DashboardDetailDialog({ selected, onClose, formatCurrency }: DashboardDetailDialogProps) {
  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle>
                {selected.label} — {selected.periodLabel}
              </DialogTitle>
            </DialogHeader>
            <p className="text-lg font-bold">{formatCurrency(selected.total)}</p>
            <div className="max-h-[400px] overflow-y-auto divide-y">
              {selected.items.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">Aucune ligne sur cette période.</p>
              )}
              {selected.series === 'proformasValidees'
                ? (selected.items as ProformaValideeDetailLine[]).map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-sm gap-4">
                      <div>
                        <Link href={`/facture/${item.id}`} className="text-primary hover:underline font-medium">
                          {item.numero}
                        </Link>
                        <div><ClientCell client={item.client} /></div>
                      </div>
                      <span className="font-medium whitespace-nowrap">{formatCurrency(item.totalTTC)}</span>
                    </div>
                  ))
                : (selected.items as (RecetteDetailLine | DepenseDetailLine)[]).map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-sm gap-4">
                      <div>
                        <div className="truncate max-w-[280px]">{item.libelle}</div>
                        <div><ClientCell client={item.client} /></div>
                        {selected.series === 'recettes' && (
                          <div className="text-xs text-muted-foreground">
                            Reste à payer : {formatCurrency((item as RecetteDetailLine).resteAPayer)}
                          </div>
                        )}
                      </div>
                      <span className="font-medium whitespace-nowrap">{formatCurrency(item.montant)}</span>
                    </div>
                  ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
