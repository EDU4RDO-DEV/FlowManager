import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/80 animate-pulse dark:bg-slate-800/70",
        className,
      )}
      {...props}
    />
  );
}
