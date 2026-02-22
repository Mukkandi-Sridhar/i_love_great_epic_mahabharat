import { Skeleton } from "@/components/ui/skeleton";

export const ProductSkeleton = () => {
  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-3">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-3" />
        <div className="flex items-center gap-1 mb-2">
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
};
