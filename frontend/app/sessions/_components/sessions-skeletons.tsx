import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SessionsTableSkeletonProps = {
  rows?: number;
};

export function SessionsCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`sessions-card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function SessionsTableSkeleton({ rows = 8 }: SessionsTableSkeletonProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-7 gap-4 border-b border-border bg-muted/40 px-4 py-3">
              {Array.from({ length: 7 }).map((_, idx) => (
                <Skeleton key={`sessions-head-${idx}`} className="h-4 w-24" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, row) => (
                <div key={`sessions-row-${row}`} className="grid grid-cols-7 gap-4 px-4 py-3">
                  {Array.from({ length: 7 }).map((__, col) => (
                    <Skeleton
                      key={`sessions-cell-${row}-${col}`}
                      className={col === 6 ? "h-8 w-28" : "h-4 w-full"}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
