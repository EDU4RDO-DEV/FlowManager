import { Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RolePermissionModuleDto } from "@/types/roles";

type RolePermissionsCardProps = {
  modules: RolePermissionModuleDto[];
  loading: boolean;
  saving: boolean;
  onToggle: (
    moduleKey: RolePermissionModuleDto["moduleKey"],
    action: RolePermissionModuleDto["actions"][number]["action"],
    permitido: boolean,
  ) => void;
  onToggleModule: (
    moduleKey: RolePermissionModuleDto["moduleKey"],
    permitido: boolean,
  ) => void;
  onToggleActionColumn: (
    action: RolePermissionModuleDto["actions"][number]["action"],
    permitido: boolean,
  ) => void;
  onSave: () => void;
};

export function RolePermissionsCard({
  modules,
  loading,
  saving,
  onToggle,
  onToggleModule,
  onToggleActionColumn,
  onSave,
}: RolePermissionsCardProps) {
  const headers = [...new Map(
    modules.flatMap((moduleItem) => moduleItem.actions)
      .map((action) => [action.action, action] as const),
  ).values()];

  function isColumnFullyEnabled(action: RolePermissionModuleDto["actions"][number]["action"]): boolean {
    return modules.length > 0 &&     modules.some((moduleItem) =>
      moduleItem.actions.some((actionItem) => actionItem.action === action),
    ) &&
    modules
      .filter((moduleItem) => moduleItem.actions.some((actionItem) => actionItem.action === action))
      .every((moduleItem) =>
        moduleItem.actions.find((actionItem) => actionItem.action === action)?.permitido === true,
      );
  }

  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Permisos por modulo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Activa acciones CRUD y permisos especiales por módulo. El saldo negativo aplica sólo a Producción.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3.5" />
            RBAC Persistente
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Cargando permisos...
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Modulo</th>
                  {headers.map((action) => (
                    <th key={action.action} className="px-3 py-2 text-center font-medium">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isColumnFullyEnabled(action.action)}
                          onChange={(event) => onToggleActionColumn(action.action, event.target.checked)}
                          className="size-4 rounded border-border"
                        />
                        <span>{action.actionName}</span>
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((moduleItem) => (
                  <tr key={moduleItem.moduleKey} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={moduleItem.actions
                            .filter((actionItem) => actionItem.action !== "allow-negative-stock")
                            .every((actionItem) => actionItem.permitido)}
                          onChange={(event) => onToggleModule(moduleItem.moduleKey, event.target.checked)}
                          className="size-4 rounded border-border"
                        />
                        <span>{moduleItem.moduleName}</span>
                      </label>
                    </td>
                    {moduleItem.actions.map((actionItem) => (
                      <td key={`${moduleItem.moduleKey}-${actionItem.action}`} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={actionItem.permitido}
                          onChange={(event) =>
                            onToggle(moduleItem.moduleKey, actionItem.action, event.target.checked)
                          }
                          className="size-4 rounded border-border"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={onSave}
            disabled={loading || saving || modules.length === 0}
            className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar permisos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
