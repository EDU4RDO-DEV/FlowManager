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

export function ReportResults({ result }: { result: ReportResult }) {
  const hasGroups = Boolean(result.groups && result.groups.length > 0);
  const hasRows = result.rows.length > 0;

  if (!hasGroups && !hasRows) {
    return <ReportResultsEmptyState />;
  }

  return (
    <div className="space-y-4">
      {result.indicators && result.indicators.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.indicators.map((indicator) => (
            <Card key={indicator.label} className="rounded-xl border border-border bg-background">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">{indicator.label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{indicator.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <Card className="rounded-xl border border-border bg-background">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {result.columns.map((column) => (
                  <TableHead key={column.key} className={alignClass(column)}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasGroups
                ? result.groups!.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-slate-100 dark:bg-slate-800/60">
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
                          className="bg-sky-50 font-medium dark:bg-sky-950/40"
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
                  className="bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.meta.truncado ? (
        <p className="text-xs text-amber-600">
          Se alcanzó el límite de filas del reporte. Mostrando los primeros {result.rows.length} registros.
        </p>
      ) : null}
    </div>
  );
}
