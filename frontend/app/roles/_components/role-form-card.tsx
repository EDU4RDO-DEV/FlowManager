import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RoleFormValues = {
  nombre: string;
  descripcion: string;
};

type RoleFormCardProps = {
  title: string;
  form: RoleFormValues;
  saving: boolean;
  onChange: (next: RoleFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function RoleFormCard({
  title,
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: RoleFormCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-background">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define un nombre claro y una descripcion operativa para el rol.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="role-name">Nombre</Label>
            <Input
              id="role-name"
              value={form.nombre}
              onChange={(event) => onChange({ ...form, nombre: event.target.value })}
              placeholder="Ej. Supervisor de produccion"
              className="bg-background"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="role-description">Descripcion</Label>
            <textarea
              id="role-description"
              className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={form.descripcion}
              onChange={(event) => onChange({ ...form, descripcion: event.target.value })}
              placeholder="Describe alcance y responsabilidad del rol"
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
