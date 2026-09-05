import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type LogisticsEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export function LogisticsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: LogisticsEmptyStateProps) {
  return (
    <Card className="rounded-xl border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <Button onClick={onAction}>{actionLabel}</Button>
      </CardContent>
    </Card>
  );
}
