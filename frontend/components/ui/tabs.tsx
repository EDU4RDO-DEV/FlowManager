"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextType = {
  value: string;
  setValue: (next: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used inside Tabs");
  }
  return context;
}

function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;
  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };
  return <TabsContext.Provider value={{ value: currentValue, setValue }}>{children}</TabsContext.Provider>;
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-xl border border-border bg-muted/50 p-1", className)}>
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const context = useTabsContext();
  const active = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = useTabsContext();
  if (context.value !== value) return null;
  return <div className={cn(className)}>{children}</div>;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
