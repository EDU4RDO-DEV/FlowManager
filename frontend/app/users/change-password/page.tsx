"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { changeUserPassword } from "@/services/users.service";

export default function ChangeOwnPasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!user?.id) {
      toast.error("No se pudo identificar el usuario autenticado.");
      return;
    }

    if (!currentPassword) {
      toast.error("Ingresa tu clave actual.");
      return;
    }

    if (!nextPassword || nextPassword.length < 8) {
      toast.error("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    try {
      await changeUserPassword(user.id, {
        claveActual: currentPassword,
        nuevaClave: nextPassword,
        idUsuarioModificador: user.id,
      });
      toast.success("Tu clave fue actualizada correctamente.");
      router.push("/users");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cambiar tu clave."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireAuth moduleKey="usuarios" action="update">
      <DashboardShell
        title="Cambiar mi clave"
        description="Formulario en página dedicada para actualizar tu contraseña."
      >
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a usuarios
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Actualizar contraseña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Clave actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Ingresa clave actual"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="next-password">Nueva clave</Label>
                <Input
                  id="next-password"
                  type="password"
                  maxLength={128}
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  placeholder="Minimo 8 caracteres"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/users")} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Actualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </RequireAuth>
  );
}
