import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function QualityCardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-xl">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function QualityTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
