import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-5 w-[150px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-[200px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-[150px]" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-8 w-[60px] mx-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
