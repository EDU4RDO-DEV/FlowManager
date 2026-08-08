import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProvidersTableSkeletonProps = {
  rows?: number;
};

export function ProvidersCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`providers-card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function ProvidersTableSkeleton({ rows = 8 }: ProvidersTableSkeletonProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-6 gap-4 border-b border-border bg-muted/40 px-4 py-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={`providers-head-${idx}`} className="h-4 w-24" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, row) => (
                <div key={`providers-row-${row}`} className="grid grid-cols-6 gap-4 px-4 py-3">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <Skeleton
                      key={`providers-cell-${row}-${col}`}
                      className={col === 5 ? "h-8 w-24" : "h-4 w-full"}
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
