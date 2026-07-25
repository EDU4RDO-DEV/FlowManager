import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive" | "outline";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-sky-100 text-sky-700 border border-sky-200",
  secondary: "bg-muted/70 text-muted-foreground border border-border",
  destructive: "bg-destructive/10 text-destructive border border-destructive/30",
  outline: "bg-background text-foreground border border-border",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-tight",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
