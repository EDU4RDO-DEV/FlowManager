import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeDto } from "@/types/employees";
import type { RoleDto } from "@/types/users";

function createEmployeeAccountEmail(name: string, employeeId: number): string {
  const localPart = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `${localPart || `empleado${employeeId}`}@flowmanager.com`;
}

function resolveImagePreviewUrl(imagePath: string): string {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const configuredBase = process.env.NEXT_PUBLIC_API_URL;
  if (configuredBase) {
    return `${configuredBase}${imagePath}`;
  }

  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000${imagePath}`;
  }

  return imagePath;
}

export type UserFormValues = {
  nombre: string;
  correo: string;
  clave: string;
  idRol: string;
  idEmpleadoVinculado: string;
  entidadSexo: string;
  entidadFechaNacimiento: string;
  entidadTelefono1: string;
  entidadTelefono2: string;
  entidadCorreoElectronico: string;
  entidadRutaImagen: string;
  entidadNit: string;
  entidadDpi: string;
};

type UserFormCardProps = {
  mode: "create" | "edit";
  title: string;
  roles: RoleDto[];
  employees: EmployeeDto[];
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
  employees,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: UserFormCardProps) {
  const hasLinkedEmployee = Boolean(form.idEmpleadoVinculado);

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
            <Label htmlFor="user-email">Correo</Label>
            <Input
              id="user-email"
              type="email"
              value={form.correo}
              onChange={(event) => onChange({ ...form, correo: event.target.value })}
              readOnly={hasLinkedEmployee}
              placeholder="correo@flowmanager.com"
              className="bg-background"
            />
          </div>

          {mode === "create" ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Clave inicial</Label>
              <Input
                id="user-password"
                type="password"
                maxLength={128}
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

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="user-linked-employee">Vincular con empleado existente (opcional)</Label>
            <select
              id="user-linked-employee"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
              value={form.idEmpleadoVinculado}
              onChange={(event) => {
                const employeeId = event.target.value;
                const employee = employees.find((item) => item.id === Number(employeeId));

                if (!employee) {
                  onChange({ ...form, idEmpleadoVinculado: employeeId });
                  return;
                }

                const entity = employee.entidad;
                onChange({
                  ...form,
                  idEmpleadoVinculado: employeeId,
                  nombre: entity.nombreCompleto,
                  correo: createEmployeeAccountEmail(entity.nombreCompleto, employee.id),
                  entidadSexo: entity.sexo ?? "",
                  entidadFechaNacimiento: entity.fechaNacimiento?.slice(0, 10) ?? "",
                  entidadTelefono1: entity.telefono1 ?? "",
                  entidadTelefono2: entity.telefono2 ?? "",
                  entidadCorreoElectronico: entity.correoElectronico ?? "",
                  entidadRutaImagen: entity.rutaImagen ?? "",
                  entidadNit: entity.nit ?? "",
                  entidadDpi: entity.dpi ?? "",
                });
              }}
            >
              <option value="">Sin vinculo</option>
              {employees.map((employee) => (
                <option key={employee.id} value={String(employee.id)}>
                  {employee.entidad.nombreCompleto} (Empleado #{employee.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos de entidad
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="user-name">Nombre completo</Label>
            <Input
              id="user-name"
              value={form.nombre}
              onChange={(event) => onChange({ ...form, nombre: event.target.value })}
              readOnly={hasLinkedEmployee}
              placeholder="Nombre completo"
              className="bg-background"
            />
          </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-sex">Sexo</Label>
                <select
                  id="entity-sex"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
                  value={form.entidadSexo}
                  onChange={(event) => onChange({ ...form, entidadSexo: event.target.value })}
                  disabled={hasLinkedEmployee}
                >
                  <option value="">Sin especificar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-birth-date">Fecha de nacimiento</Label>
                <Input
                  id="entity-birth-date"
                  type="date"
                  value={form.entidadFechaNacimiento}
                  onChange={(event) => onChange({ ...form, entidadFechaNacimiento: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-email">Correo entidad</Label>
                <Input
                  id="entity-email"
                  type="email"
                  value={form.entidadCorreoElectronico}
                  onChange={(event) => onChange({ ...form, entidadCorreoElectronico: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  placeholder="correo.entidad@empresa.com"
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-phone-1">Telefono 1</Label>
                <Input
                  id="entity-phone-1"
                  value={form.entidadTelefono1}
                  onChange={(event) => onChange({ ...form, entidadTelefono1: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  placeholder="50255550101"
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-phone-2">Telefono 2</Label>
                <Input
                  id="entity-phone-2"
                  value={form.entidadTelefono2}
                  onChange={(event) => onChange({ ...form, entidadTelefono2: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  placeholder="50255550102"
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Imagen del empleado</Label>
                <div className="flex h-24 items-center gap-3 rounded-lg border bg-background p-2">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {form.entidadRutaImagen.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImagePreviewUrl(form.entidadRutaImagen)}
                        alt={`Imagen de ${form.nombre || "usuario"}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center text-xs text-muted-foreground">
                        Sin imagen
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {form.entidadRutaImagen.trim() ? "Imagen registrada en Empleados" : "Sin imagen registrada"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-nit">NIT</Label>
                <Input
                  id="entity-nit"
                  value={form.entidadNit}
                  onChange={(event) => onChange({ ...form, entidadNit: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  placeholder="1234567-8"
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entity-dpi">DPI</Label>
                <Input
                  id="entity-dpi"
                  value={form.entidadDpi}
                  onChange={(event) => onChange({ ...form, entidadDpi: event.target.value })}
                  readOnly={hasLinkedEmployee}
                  placeholder="1234567890101"
                  className="bg-background"
                />
              </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="hover:bg-muted/50 transition-colors">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "create" ? "Crear usuario" : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
