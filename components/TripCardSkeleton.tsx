import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Placeholder shown while a result set is "loading" (initial render, search,
// filter, group changes). Mirrors TripCard's shape so the swap to real cards is
// seamless. The shimmer sweep (skeleton-shimmer) layers over Skeleton's pulse to
// echo the AWS-style card loading effect.
export default function TripCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={cn("skeleton-shimmer h-full overflow-hidden", className)}>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
    </Card>
  );
}
