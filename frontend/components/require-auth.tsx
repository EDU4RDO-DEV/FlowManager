"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { hasModulePermission, type AppModuleKey, type CrudAction } from "@/lib/rbac";

// Guard de cliente: bloquea el render hasta confirmar sesión.
// Si no hay usuario tras rehidratar, redirige a /login.
export function RequireAuth({
  children,
  moduleKey,
  action = "read",
}: {
  children: ReactNode;
  moduleKey?: AppModuleKey;
  action?: CrudAction;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasPermission = moduleKey ? hasModulePermission(user?.nombreRol, moduleKey, action) : true;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!isLoading && isAuthenticated && !hasPermission) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, hasPermission, router]);

  if (isLoading || !isAuthenticated || !hasPermission) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
