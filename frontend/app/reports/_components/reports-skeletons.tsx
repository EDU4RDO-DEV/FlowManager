import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportCategoriesSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <Card key={`report-category-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function ReportListSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <Card key={`report-item-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function ReportResultsSkeleton() {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="min-w-190">
            <div className="grid grid-cols-5 gap-4 border-b border-border bg-muted/40 px-4 py-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={`report-results-head-${idx}`} className="h-4 w-20" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, row) => (
                <div key={`report-results-row-${row}`} className="grid grid-cols-5 gap-4 px-4 py-3">
                  {Array.from({ length: 5 }).map((__, col) => (
                    <Skeleton key={`report-results-cell-${row}-${col}`} className="h-4 w-full" />
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
