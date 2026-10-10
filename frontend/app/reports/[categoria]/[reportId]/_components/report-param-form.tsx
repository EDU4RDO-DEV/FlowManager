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
import { api, getApiErrorMessage } from "@/lib/api";
import type { ReportsAccentKey } from "@/lib/reports-accent";
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

function useRemoteOptions(endpoint?: string): { options: ReportParamOption[]; isLoading: boolean; error: string | null } {
  const [remote, setRemote] = useState<{
    endpoint: string | undefined;
    options: ReportParamOption[];
    isLoading: boolean;
    error: string | null;
  }>({ endpoint, options: [], isLoading: Boolean(endpoint), error: null });

  useEffect(() => {
    if (!endpoint) return;

    let cancelled = false;

    api
      .get<{ data?: unknown }>(endpoint)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data.data) ? data.data : (data.data as { items?: unknown[] })?.items ?? [];
        const parsed = (list as RemoteOption[]).map((item) => ({
          value: extractOptionValue(item),
          label: extractOptionLabel(item),
        }));
        setRemote({ endpoint, options: parsed, isLoading: false, error: null });
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setRemote({
            endpoint,
            options: [],
            isLoading: false,
            error: getApiErrorMessage(requestError, "No se pudieron cargar las opciones."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const matchesEndpoint = remote.endpoint === endpoint;
  return {
    options: endpoint && matchesEndpoint ? remote.options : [],
    isLoading: Boolean(endpoint) && (!matchesEndpoint || remote.isLoading),
    error: endpoint && matchesEndpoint ? remote.error : null,
  };
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
    <>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          disabled={remote.isLoading || Boolean(remote.error)}
          className="border-[color:var(--reports-accent-soft)] bg-[color:var(--reports-accent-muted)] focus:ring-[color:var(--reports-accent-ring)]"
        >
          <SelectValue
            placeholder={remote.isLoading ? "Cargando..." : remote.error ? "No se pudieron cargar las opciones" : "Selecciona una opción"}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {remote.error ? <p className="text-xs text-destructive" role="status">{remote.error}</p> : null}
    </>
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
  accent: ReportsAccentKey;
};

export function ReportParamForm({ parametros, values, onChange, onSubmit, onClear, isSubmitting, accent }: ReportParamFormProps) {
  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-accent={accent}
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
              <SelectTrigger className="border-[color:var(--reports-accent-soft)] bg-[color:var(--reports-accent-muted)] focus:ring-[color:var(--reports-accent-ring)]">
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
              className="border-[color:var(--reports-accent-soft)] bg-[color:var(--reports-accent-muted)] focus-visible:ring-[color:var(--reports-accent-ring)]"
            />
          )}

          {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
        </div>
      ))}

      <div className="col-span-full flex flex-wrap gap-2 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-[color:var(--reports-accent)] text-white hover:bg-[color:var(--reports-accent-strong)]"
        >
          {isSubmitting ? "Generando..." : "Generar reporte"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={isSubmitting}
          className="border-[color:var(--reports-accent-soft)] hover:bg-[color:var(--reports-accent-muted)]"
        >
          Limpiar filtros
        </Button>
      </div>
    </form>
  );
}
