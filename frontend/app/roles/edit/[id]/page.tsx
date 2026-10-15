"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  RolePermissionsCard,
} from "@/app/roles/_components/role-permissions-card";
import {
  RoleFormCard,
  type RoleFormValues,
} from "@/app/roles/_components/role-form-card";
import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { getApiErrorMessage } from "@/lib/api";
import {
  getRoleById,
  getRolePermissions,
  updateRole,
  updateRolePermissions,
} from "@/services/roles.service";
import type { RolePermissionModuleDto } from "@/types/roles";

const EMPTY_FORM: RoleFormValues = {
  nombre: "",
  descripcion: "",
};

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoleFormValues>(EMPTY_FORM);
  const [permissions, setPermissions] = useState<RolePermissionModuleDto[]>([]);

  useEffect(() => {
    async function loadData() {
      const roleId = Number(params.id);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        toast.error("ID de rol invalido.");
        router.push("/roles");
        return;
      }

      setLoading(true);
      try {
        const [roleData, permissionsData] = await Promise.all([
          getRoleById(roleId),
          getRolePermissions(roleId),
        ]);
        setForm({
          nombre: roleData.nombre,
          descripcion: roleData.descripcion ?? "",
        });
        setPermissions(permissionsData.modules);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el rol."));
        router.push("/roles");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  async function handleSubmit() {
    const roleId = Number(params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      toast.error("ID de rol invalido.");
      return;
    }

    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!form.nombre.trim()) {
      toast.error("El nombre del rol es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await updateRole(roleId, {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        idUsuarioModificador: user.id,
      });

      toast.success("Rol actualizado correctamente.");
      router.push("/roles");
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el rol."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePermissions() {
    const roleId = Number(params.id);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      toast.error("ID de rol invalido.");
      return;
    }

    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    setSavingPermissions(true);
    try {
      const updated = await updateRolePermissions(roleId, {
        idUsuarioModificador: user.id,
        permissions: permissions.flatMap((moduleItem) =>
          moduleItem.actions.map((actionItem) => ({
            moduleKey: moduleItem.moduleKey,
            action: actionItem.action,
            permitido: actionItem.permitido,
          })),
        ),
      });

      setPermissions(updated.modules);
      toast.success("Permisos actualizados correctamente.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudieron actualizar los permisos."));
    } finally {
      setSavingPermissions(false);
    }
  }

  function handleTogglePermission(
    moduleKey: RolePermissionModuleDto["moduleKey"],
    action: RolePermissionModuleDto["actions"][number]["action"],
    permitido: boolean,
  ) {
    setPermissions((prev) =>
      prev.map((moduleItem) => {
        if (moduleItem.moduleKey !== moduleKey) {
          return moduleItem;
        }

        return {
          ...moduleItem,
          actions: moduleItem.actions.map((actionItem) =>
            actionItem.action === action ? { ...actionItem, permitido } : actionItem,
          ),
        };
      }),
    );
  }

  function handleToggleModule(
    moduleKey: RolePermissionModuleDto["moduleKey"],
    permitido: boolean,
  ) {
    setPermissions((prev) =>
      prev.map((moduleItem) => {
        if (moduleItem.moduleKey !== moduleKey) {
          return moduleItem;
        }

        return {
          ...moduleItem,
          actions: moduleItem.actions.map((actionItem) =>
            actionItem.action === "allow-negative-stock"
              ? actionItem
              : { ...actionItem, permitido },
          ),
        };
      }),
    );
  }

  function handleToggleActionColumn(
    action: RolePermissionModuleDto["actions"][number]["action"],
    permitido: boolean,
  ) {
    setPermissions((prev) =>
      prev.map((moduleItem) => ({
        ...moduleItem,
        actions: moduleItem.actions.map((actionItem) =>
          actionItem.action === action ? { ...actionItem, permitido } : actionItem,
        ),
      })),
    );
  }

  return (
    <RequireAuth moduleKey="roles" action="update">
      <DashboardShell
        title="Editar Rol"
        description="Submodulo para actualizar configuraciones de permisos."
      >
        <div className="w-full space-y-6">
          {loading ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Cargando informacion del rol...
            </p>
          ) : (
            <>
              <RoleFormCard
                title={`Editar rol #${params.id}`}
                form={form}
                saving={saving}
                onChange={setForm}
                onCancel={() => router.push("/roles")}
                onSubmit={handleSubmit}
              />

              <RolePermissionsCard
                modules={permissions}
                loading={loading}
                saving={savingPermissions}
                onToggle={handleTogglePermission}
                onToggleModule={handleToggleModule}
                onToggleActionColumn={handleToggleActionColumn}
                onSave={handleSavePermissions}
              />
            </>
          )}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
