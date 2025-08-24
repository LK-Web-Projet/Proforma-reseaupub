import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function FactureTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-5 w-[100px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-[150px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-[120px]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-[250px]" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-5 w-[130px] mx-auto" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-5 w-[100px] ml-auto" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-5 w-[80px] mx-auto" />
          </TableCell>
          <TableCell className="flex justify-end">
            <Skeleton className="h-5 w-5" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
