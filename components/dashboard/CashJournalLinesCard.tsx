import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface CashJournalLine {
  id: number;
  date: string;
  libelle: string;
  montant: number;
  caisse: string;
  isApportDeCaisse?: boolean;
}

interface CashJournalLinesCardProps {
  title: string;
  kind: 'entrees' | 'sorties';
  lines: CashJournalLine[];
  total: number;
  formatCurrency: (value: number) => string;
}

export function CashJournalLinesCard({ title, kind, lines, total, formatCurrency }: CashJournalLinesCardProps) {
  const colorClass = kind === 'entrees' ? 'text-green-700' : 'text-red-700';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className={`text-lg font-bold ${colorClass}`}>{formatCurrency(total)}</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-20 text-muted-foreground">
                    Aucune ligne ce mois-ci.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(line.date), 'dd MMM', { locale: fr })}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate">{line.libelle}</div>
                      {line.isApportDeCaisse && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">Apport de caisse</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{line.caisse}</TableCell>
                    <TableCell className={`text-right font-medium ${colorClass}`}>
                      {formatCurrency(line.montant)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
