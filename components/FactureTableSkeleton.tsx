import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lignes d'attente de la liste des proformas : mêmes colonnes que le tableau (numéro / date, client,
 * objet, gestionnaire, total TTC, reste à payer, statut, actions), largeurs relatives pour ne jamais
 * élargir le tableau.
 */
export function FactureTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3 mt-1" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-full" />
          </TableCell>
          <TableCell className="hidden xl:table-cell">
            <Skeleton className="h-5 w-full" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="h-5 w-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-3/4 mx-auto" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-5 mx-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
