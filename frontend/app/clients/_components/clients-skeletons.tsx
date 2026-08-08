import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ClientsTableSkeletonProps = {
  rows?: number;
};

export function ClientsCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`clients-card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function ClientsTableSkeleton({ rows = 8 }: ClientsTableSkeletonProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-190">
            <div className="grid grid-cols-6 gap-4 border-b border-border bg-muted/40 px-4 py-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={`clients-head-${idx}`} className="h-4 w-20" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, row) => (
                <div key={`clients-row-${row}`} className="grid grid-cols-6 gap-4 px-4 py-3">
                  {Array.from({ length: 6 }).map((__, col) => (
                    <Skeleton
                      key={`clients-cell-${row}-${col}`}
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
