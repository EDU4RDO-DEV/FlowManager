import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoleDto } from "@/types/users";

export type UserFormValues = {
  nombre: string;
  correo: string;
  clave: string;
  idRol: string;
};

type UserFormCardProps = {
  mode: "create" | "edit";
  title: string;
  roles: RoleDto[];
  form: UserFormValues;
  saving: boolean;
  onChange: (next: UserFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function UserFormCard({
  mode,
  title,
  roles,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: UserFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completa los datos del usuario y confirma la operacion para continuar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Nombre</Label>
            <Input
              id="user-name"
              value={form.nombre}
              onChange={(event) => onChange({ ...form, nombre: event.target.value })}
              placeholder="Nombre completo"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">Correo</Label>
            <Input
              id="user-email"
              type="email"
              value={form.correo}
              onChange={(event) => onChange({ ...form, correo: event.target.value })}
              placeholder="correo@empresa.com"
              className="bg-background"
            />
          </div>

          {mode === "create" ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Clave inicial</Label>
              <Input
                id="user-password"
                type="password"
                value={form.clave}
                onChange={(event) => onChange({ ...form, clave: event.target.value })}
                placeholder="Minimo 8 caracteres"
                className="bg-background"
              />
            </div>
          ) : null}

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="user-role">Rol</Label>
            <select
              id="user-role"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
              value={form.idRol}
              onChange={(event) => onChange({ ...form, idRol: event.target.value })}
            >
              <option value="">Sin rol</option>
              {roles.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="hover:bg-muted/50 transition-colors">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700 transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "create" ? "Crear usuario" : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
