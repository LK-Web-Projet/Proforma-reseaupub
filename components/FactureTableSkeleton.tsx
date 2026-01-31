import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function FactureTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-5 w-25" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-37.5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-30" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-62.5" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-5 w-32.5 mx-auto" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-5 w-25 ml-auto" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-5 w-20 mx-auto" />
          </TableCell>
          <TableCell className="flex justify-end">
            <Skeleton className="h-5 w-5" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
