import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full h-[100vh] flex flex-wrap  items-center justify-center bg-gray-100">
      <div className="h-full w-1/2 flex flex-col items-center justify-center gap-8 p-5 bg-black text-pink-600">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="w-1/2 h-full flex items-center justify-center bg-white p-8">
        <Skeleton className="w-[400px] h-[500px] rounded-lg" />
      </div>
    </div>
  );
}
