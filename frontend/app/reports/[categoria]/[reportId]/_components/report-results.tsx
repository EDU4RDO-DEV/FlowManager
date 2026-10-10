import { Fragment } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportsAccentKey } from "@/lib/reports-accent";
import type { ReportColumn, ReportColumnType, ReportResult } from "@/types/reports";

import { ReportResultsEmptyState } from "../../../_components/reports-empty-state";

const currencyFormatter = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 2 });

function formatCell(value: unknown, type: ReportColumnType): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (type) {
    case "currency":
      return `Q ${currencyFormatter.format(Number(value))}`;
    case "number":
      return numberFormatter.format(Number(value));
    case "percent":
      return `${numberFormatter.format(Number(value))} %`;
    case "date": {
      const date = new Date(String(value));
      // timeZone: "UTC" evita que una fecha-calendario (guardada como medianoche UTC)
      // se muestre un día antes según el huso horario del navegador del usuario.
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString("es-GT", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });
    }
    default:
      return String(value);
  }
}

function alignClass(column: ReportColumn): string {
  const align = column.align ?? (column.type === "text" || column.type === "badge" ? "left" : "right");
  return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
}

function DataRow({ columns, row }: { columns: ReportColumn[]; row: Record<string, unknown> }) {
  return (
    <TableRow>
      {columns.map((column) => (
        <TableCell key={column.key} className={alignClass(column)}>
          {formatCell(row[column.key], column.type)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function AggregateRow({
  columns,
  values,
  label,
  className,
}: {
  columns: ReportColumn[];
  values: Record<string, number>;
  label: string;
  className: string;
}) {
  return (
    <TableRow className={className}>
      {columns.map((column, index) => (
        <TableCell key={column.key} className={alignClass(column)}>
          {index === 0 ? label : column.key in values ? formatCell(values[column.key], column.type) : ""}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function ReportResults({ result, accent }: { result: ReportResult; accent: ReportsAccentKey }) {
  const hasGroups = Boolean(result.groups && result.groups.length > 0);
  const hasRows = result.rows.length > 0;

  if (!hasGroups && !hasRows) {
    return <ReportResultsEmptyState />;
  }

  return (
    <div className="space-y-4" data-accent={accent}>
      {result.indicators && result.indicators.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.indicators.map((indicator) => (
            <Card key={indicator.label} className="rounded-xl border border-[color:var(--reports-accent-soft)] bg-[color:var(--reports-kpi-bg)]">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{indicator.label}</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--reports-accent-text)]">{indicator.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <Card className="rounded-xl border border-border bg-background">
        <CardContent className="overflow-x-auto p-0 print:overflow-visible">
          <Table>
            <TableHeader>
              <TableRow className="bg-[color:var(--reports-table-head)] hover:bg-[color:var(--reports-table-head)]">
                {result.columns.map((column) => (
                  <TableHead key={column.key} className={`${alignClass(column)} text-xs uppercase tracking-wide text-white`}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasGroups
                ? result.groups!.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-[color:var(--reports-accent-soft)]">
                        <TableCell colSpan={result.columns.length} className="font-semibold">
                          {group.label}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row, index) => (
                        <DataRow key={`${group.key}-row-${index}`} columns={result.columns} row={row} />
                      ))}
                      {group.subtotals ? (
                        <AggregateRow
                          columns={result.columns}
                          values={group.subtotals}
                          label="Subtotal"
                          className="bg-[color:var(--reports-accent-muted)] font-semibold text-[color:var(--reports-accent-text)]"
                        />
                      ) : null}
                    </Fragment>
                  ))
                : result.rows.map((row, index) => <DataRow key={`row-${index}`} columns={result.columns} row={row} />)}

              {result.totals ? (
                <AggregateRow
                  columns={result.columns}
                  values={result.totals}
                  label="TOTAL GENERAL"
                  className="bg-[color:var(--reports-table-head)] font-bold text-white"
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.meta.truncado ? (
        <p className="text-xs text-amber-600">
          Se alcanzó el límite de filas del reporte; el resultado puede estar incompleto.
        </p>
      ) : null}
    </div>
  );
}
