import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserDto } from "@/types/users";

export type EmployeeFormValues = {
  idUsuarioVinculado: string;
  nombreCompleto: string;
  correoElectronico: string;
  telefono1: string;
  nit: string;
  dpi: string;
  puestoTrabajo: string;
  descripcionPuesto: string;
  fechaContratacion: string;
  fechaSalida: string;
  sueldoBase: string;
};

type EmployeeFormCardProps = {
  title: string;
  users: UserDto[];
  form: EmployeeFormValues;
  saving: boolean;
  onChange: (next: EmployeeFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function EmployeeFormCard({
  title,
  users,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: EmployeeFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="employee-linked-user">Vincular con usuario existente (opcional)</Label>
            <select
              id="employee-linked-user"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
              value={form.idUsuarioVinculado}
              onChange={(event) =>
                onChange({ ...form, idUsuarioVinculado: event.target.value })
              }
            >
              <option value="">Sin vinculo</option>
              {users.map((linkedUser) => (
                <option key={linkedUser.id} value={String(linkedUser.id)}>
                  {linkedUser.nombre} ({linkedUser.correo})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="nombre-completo">Nombre completo</Label>
            <Input
              id="nombre-completo"
              value={form.nombreCompleto}
              onChange={(event) => onChange({ ...form, nombreCompleto: event.target.value })}
              placeholder="Nombre del empleado"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correo">Correo electronico</Label>
            <Input
              id="correo"
              value={form.correoElectronico}
              onChange={(event) => onChange({ ...form, correoElectronico: event.target.value })}
              placeholder="correo@empresa.com"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Telefono</Label>
            <Input
              id="telefono"
              value={form.telefono1}
              onChange={(event) => onChange({ ...form, telefono1: event.target.value })}
              placeholder="5555-5555"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nit">NIT</Label>
            <Input
              id="nit"
              value={form.nit}
              onChange={(event) => onChange({ ...form, nit: event.target.value })}
              placeholder="CF o NIT"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dpi">DPI</Label>
            <Input
              id="dpi"
              value={form.dpi}
              onChange={(event) => onChange({ ...form, dpi: event.target.value })}
              placeholder="CUI"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="puesto">Puesto</Label>
            <Input
              id="puesto"
              value={form.puestoTrabajo}
              onChange={(event) => onChange({ ...form, puestoTrabajo: event.target.value })}
              placeholder="Ej. Supervisor de planta"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sueldo">Sueldo base</Label>
            <Input
              id="sueldo"
              type="number"
              min="0"
              step="0.01"
              value={form.sueldoBase}
              onChange={(event) => onChange({ ...form, sueldoBase: event.target.value })}
              placeholder="0.00"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha-contratacion">Fecha de contratacion</Label>
            <Input
              id="fecha-contratacion"
              type="date"
              value={form.fechaContratacion}
              onChange={(event) => onChange({ ...form, fechaContratacion: event.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha-salida">Fecha de salida</Label>
            <Input
              id="fecha-salida"
              type="date"
              value={form.fechaSalida}
              onChange={(event) => onChange({ ...form, fechaSalida: event.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="descripcion">Descripcion del puesto</Label>
            <textarea
              id="descripcion"
              className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={form.descripcionPuesto}
              onChange={(event) => onChange({ ...form, descripcionPuesto: event.target.value })}
              placeholder="Responsabilidades y alcance"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving} className="hover:bg-muted/50 transition-colors">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 transition-colors">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
