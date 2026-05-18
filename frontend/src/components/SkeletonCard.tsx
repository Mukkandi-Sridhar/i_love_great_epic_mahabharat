import { Skeleton } from "@/components/ui/skeleton";

export const SkeletonCard = () => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
    <Skeleton className="aspect-[3/4] w-full rounded-xl bg-white/10" />
    <div className="space-y-2 pt-4">
      <Skeleton className="h-4 w-4/5 bg-white/10" />
      <Skeleton className="h-3 w-2/3 bg-white/10" />
      <Skeleton className="h-6 w-24 bg-white/10" />
    </div>
  </div>
);

export default SkeletonCard;
