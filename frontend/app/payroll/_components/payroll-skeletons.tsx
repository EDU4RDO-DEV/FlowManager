import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PayrollCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={`payroll-card-${idx}`} className="rounded-xl border border-border bg-background">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function PayrollTableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardContent className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, idx) => (
            <Skeleton key={`payroll-row-${idx}`} className="h-11 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
