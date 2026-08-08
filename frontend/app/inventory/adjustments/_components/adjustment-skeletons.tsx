import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
