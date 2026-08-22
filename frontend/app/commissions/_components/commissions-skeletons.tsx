import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CommissionsCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`comm-card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function CommissionsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, idx) => (
            <Skeleton key={`comm-row-${idx}`} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
