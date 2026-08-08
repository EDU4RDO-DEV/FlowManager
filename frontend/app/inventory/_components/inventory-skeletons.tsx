import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

type CardSkeletonProps = {
  count?: number;
};

export function TableSkeleton({ rows = 8, columns = 8 }: TableSkeletonProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-[920px]">
            <div className="grid gap-4 border-b border-border bg-muted/40 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns }).map((_, idx) => (
                <Skeleton key={`head-${idx}`} className="h-4 w-20" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: rows }).map((_, row) => (
                <div
                  key={`row-${row}`}
                  className="grid gap-4 px-4 py-3"
                  style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: columns }).map((__, col) => (
                    <Skeleton
                      key={`cell-${row}-${col}`}
                      className={col === columns - 1 ? "h-8 w-28" : "h-4 w-full"}
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

export function CardSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, idx) => (
        <Card key={`card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function FormSkeleton() {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}
