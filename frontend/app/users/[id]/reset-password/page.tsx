"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api";
import { getUserById, resetUserPassword } from "@/services/users.service";
import type { UserDto } from "@/types/users";

export default function ResetUserPasswordPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = Number(params.id);

  const [targetUser, setTargetUser] = useState<UserDto | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (!Number.isInteger(userId) || userId <= 0) {
        toast.error("ID de usuario invalido.");
        router.push("/users");
        return;
      }

      setLoading(true);
      try {
        const data = await getUserById(userId);
        setTargetUser(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo cargar el usuario."));
        router.push("/users");
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, [router, userId]);

  async function handleSubmit() {
    if (!newPassword || newPassword.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      await resetUserPassword(userId, {
        nuevaClave: newPassword,
        ...(user?.id ? { idUsuarioModificador: user.id } : {}),
      });
      toast.success("Clave restablecida correctamente.");
      router.push("/users");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restablecer la clave."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="usuarios" action="update">
      <DashboardShell
        title="Restablecer clave"
        description="Formulario en página dedicada para restablecer contraseña de usuario."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a usuarios
          </Button>

          {loading ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">Cargando usuario...</CardContent>
            </Card>
          ) : targetUser ? (
            <Card>
              <CardHeader>
                <CardTitle>Usuario: {targetUser.nombre}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Nueva clave</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimo 8 caracteres"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => router.push("/users")} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
