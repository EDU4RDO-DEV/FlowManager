"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type DropdownMenuContextType = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within DropdownMenu");
  }
  return context;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function closeMenu() {
      setOpen(false);
    }

    window.addEventListener("scroll", closeMenu, true);
    return () => window.removeEventListener("scroll", closeMenu, true);
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useDropdownMenuContext();

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = useDropdownMenuContext();

  React.useEffect(() => {
    function handleGlobalClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-dropdown-root='true']")) {
        setOpen(false);
      }
    }

    if (open) {
      window.addEventListener("click", handleGlobalClick);
    }

    return () => window.removeEventListener("click", handleGlobalClick);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      data-dropdown-root="true"
      className={cn(
        "absolute right-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-border bg-background p-1",
        className,
      )}
      role="menu"
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { setOpen } = useDropdownMenuContext();

  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
        className,
      )}
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
