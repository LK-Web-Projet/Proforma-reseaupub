import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2 w-full">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                </div>
            </CardContent>
        </Card>
    );
}

export function StatistiquesPageSkeleton() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Card className="bg-slate-50/50">
        <CardHeader>
            <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Skeleton className="h-10 w-[400px]" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-[350px]">
                <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                <CardContent><Skeleton className="h-full w-full" /></CardContent>
            </Card>
            <Card className="h-[350px]">
                <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                <CardContent className="flex justify-center items-center">
                    <Skeleton className="h-48 w-48 rounded-full" />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
