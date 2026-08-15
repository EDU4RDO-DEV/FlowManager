import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ClientFormValues = {
  nombreCompleto: string;
  sexo: string;
  fechaNacimiento: string;
  correoElectronico: string;
  telefono1: string;
  telefono2: string;
  rutaImagen: string;
  nit: string;
  dpi: string;
};

type ClientFormCardProps = {
  title: string;
  form: ClientFormValues;
  saving: boolean;
  onChange: (next: ClientFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ClientFormCard({
  title,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: ClientFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="client-fullname">Nombre completo</Label>
            <Input
              id="client-fullname"
              value={form.nombreCompleto}
              onChange={(event) => onChange({ ...form, nombreCompleto: event.target.value })}
              placeholder="Nombre del cliente"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-sex">Sexo</Label>
            <select
              id="client-sex"
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted/50"
              value={form.sexo}
              onChange={(event) => onChange({ ...form, sexo: event.target.value })}
            >
              <option value="">Sin especificar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-birth-date">Fecha de nacimiento</Label>
            <Input
              id="client-birth-date"
              type="date"
              value={form.fechaNacimiento}
              onChange={(event) => onChange({ ...form, fechaNacimiento: event.target.value })}
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-email">Correo electronico</Label>
            <Input
              id="client-email"
              value={form.correoElectronico}
              onChange={(event) => onChange({ ...form, correoElectronico: event.target.value })}
              placeholder="correo@cliente.com"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-phone">Telefono</Label>
            <Input
              id="client-phone"
              value={form.telefono1}
              onChange={(event) => onChange({ ...form, telefono1: event.target.value })}
              placeholder="5555-5555"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-phone-2">Telefono 2</Label>
            <Input
              id="client-phone-2"
              value={form.telefono2}
              onChange={(event) => onChange({ ...form, telefono2: event.target.value })}
              placeholder="5555-5556"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-image-path">Ruta imagen</Label>
            <Input
              id="client-image-path"
              value={form.rutaImagen}
              onChange={(event) => onChange({ ...form, rutaImagen: event.target.value })}
              placeholder="/uploads/clientes/foto.jpg"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-nit">NIT</Label>
            <Input
              id="client-nit"
              value={form.nit}
              onChange={(event) => onChange({ ...form, nit: event.target.value })}
              placeholder="NIT o CF"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-dpi">DPI</Label>
            <Input
              id="client-dpi"
              value={form.dpi}
              onChange={(event) => onChange({ ...form, dpi: event.target.value })}
              placeholder="CUI"
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
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
