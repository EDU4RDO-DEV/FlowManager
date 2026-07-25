import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProviderFormValues = {
  nombre: string;
  nombreCompleto: string;
  correoElectronico: string;
  telefono1: string;
  nit: string;
  dpi: string;
};

type ProviderFormCardProps = {
  title: string;
  form: ProviderFormValues;
  saving: boolean;
  onChange: (next: ProviderFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ProviderFormCard({
  title,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: ProviderFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider-name">Nombre comercial</Label>
            <Input
              id="provider-name"
              value={form.nombre}
              onChange={(event) => onChange({ ...form, nombre: event.target.value })}
              placeholder="Ej. Distribuidora Central"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-fullname">Nombre contacto</Label>
            <Input
              id="provider-fullname"
              value={form.nombreCompleto}
              onChange={(event) => onChange({ ...form, nombreCompleto: event.target.value })}
              placeholder="Nombre del representante"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-email">Correo electronico</Label>
            <Input
              id="provider-email"
              value={form.correoElectronico}
              onChange={(event) => onChange({ ...form, correoElectronico: event.target.value })}
              placeholder="contacto@proveedor.com"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-phone">Telefono</Label>
            <Input
              id="provider-phone"
              value={form.telefono1}
              onChange={(event) => onChange({ ...form, telefono1: event.target.value })}
              placeholder="5555-5555"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-nit">NIT</Label>
            <Input
              id="provider-nit"
              value={form.nit}
              onChange={(event) => onChange({ ...form, nit: event.target.value })}
              placeholder="NIT"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-dpi">DPI</Label>
            <Input
              id="provider-dpi"
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
