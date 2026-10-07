"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ReportParamField, ReportParamOption } from "@/types/reports";

type RemoteOption = Record<string, unknown>;

// Extrae value/label de respuestas heterogéneas (clientes, usuarios, productos, rutas),
// sin necesitar un endpoint de catálogo dedicado para cada selector de parámetro.
function extractOptionLabel(item: RemoteOption): string {
  const entidad = item.entidad as RemoteOption | undefined;
  return (
    (item.nombreCompleto as string | undefined) ??
    (entidad?.nombreCompleto as string | undefined) ??
    (item.nombre as string | undefined) ??
    (item.placa as string | undefined) ??
    (item.correo as string | undefined) ??
    String(item.id ?? "")
  );
}

function extractOptionValue(item: RemoteOption): string {
  return String(item.id ?? "");
}

function useRemoteOptions(endpoint?: string): { options: ReportParamOption[]; isLoading: boolean } {
  const [options, setOptions] = useState<ReportParamOption[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(endpoint));

  useEffect(() => {
    if (!endpoint) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .get<{ data?: unknown }>(endpoint)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data.data) ? data.data : (data.data as { items?: unknown[] })?.items ?? [];
        const parsed = (list as RemoteOption[]).map((item) => ({
          value: extractOptionValue(item),
          label: extractOptionLabel(item),
        }));
        setOptions(parsed);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return { options, isLoading };
}

function SelectField({
  field,
  value,
  onChange,
}: {
  field: ReportParamField;
  value: string;
  onChange: (value: string) => void;
}) {
  const remote = useRemoteOptions(field.optionsEndpoint);
  const options = field.options ?? remote.options;

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={remote.isLoading ? "Cargando..." : "Selecciona una opción"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type ReportParamValues = Record<string, string>;

type ReportParamFormProps = {
  parametros: ReportParamField[];
  values: ReportParamValues;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  isSubmitting: boolean;
};

export function ReportParamForm({ parametros, values, onChange, onSubmit, onClear, isSubmitting }: ReportParamFormProps) {
  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {parametros.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>

          {field.type === "select" ? (
            <SelectField field={field} value={values[field.key] ?? ""} onChange={(v) => onChange(field.key, v)} />
          ) : field.type === "boolean" ? (
            <Select value={values[field.key] ?? ""} onValueChange={(v) => onChange(field.key, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Sí</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={field.key}
              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}

          {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
        </div>
      ))}

      <div className="col-span-full flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Generando..." : "Generar reporte"}
        </Button>
        <Button type="button" variant="outline" onClick={onClear} disabled={isSubmitting}>
          Limpiar filtros
        </Button>
      </div>
    </form>
  );
}
