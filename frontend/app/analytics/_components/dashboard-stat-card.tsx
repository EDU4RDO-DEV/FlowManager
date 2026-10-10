"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStatCardProps {
  title: string;
  value: string;
  description: string;
  changePercent: number | null;
  icon: LucideIcon;
  isLoading: boolean;
}

export function DashboardStatCard({
  title,
  value,
  description,
  changePercent,
  icon: Icon,
  isLoading,
}: DashboardStatCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="mb-2 h-8 w-28" />
        ) : (
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
        )}
        <div className="mt-1 flex min-h-5 items-center gap-1 text-xs text-muted-foreground">
          {!isLoading && changePercent !== null ? (
            <>
              {changePercent < 0 ? (
                <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              <span>{changePercent > 0 ? "+" : ""}{changePercent}% vs. período anterior</span>
            </>
          ) : (
            <span>{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
