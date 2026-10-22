import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function FournisseurTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-5 w-37.5" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-50" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-25" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-3705" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-45" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-37.5" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-5 w-25 mx-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
