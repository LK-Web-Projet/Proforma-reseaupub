import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <div className="space-y-2">
                <Skeleton className="h-5 w-[150px]" />
                <Skeleton className="h-3 w-[100px]" />
            </div>
          </TableCell>
          <TableCell>
            <div className="space-y-2">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-3 w-[150px]" />
            </div>
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-6 w-[40px] mx-auto rounded-full" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-6 w-[40px] mx-auto rounded-full" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-6 w-[40px] mx-auto rounded-full" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="h-6 w-[40px] mx-auto rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-8 w-[60px] ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
