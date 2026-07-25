import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = {
  moduleName: string;
};

export function ModulePlaceholder({ moduleName }: ModulePlaceholderProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base tracking-tight">{moduleName}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Pantalla base creada. En el siguiente paso conectaremos formulario, listado,
        busqueda, filtros y operaciones.
      </CardContent>
    </Card>
  );
}
