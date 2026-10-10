import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { nowIso, round2, sumByKey } from '../helpers';
import { optionalPositiveIntParam } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'planilla';
const CATEGORIA_LABEL = 'Planillas / Comisiones';

const estadoPlanillaOptions = [
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'CERRADA', label: 'Cerrada' },
];

const tipoAjusteOptions = [
  { value: 'BONO_META', label: 'Bono por meta' },
  { value: 'VIATICO', label: 'Viático' },
  { value: 'DESCUENTO', label: 'Descuento' },
];

function empleadoParam() {
  return { key: 'idEmpleado', label: 'Empleado', type: 'select' as const, optionsEndpoint: '/api/employees' };
}

// 67. Planillas por período ------------------------------------------------------------------------
const planillasPeriodoSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  idEmpleado: optionalPositiveIntParam,
  estado: z.enum(['BORRADOR', 'CERRADA']).optional(),
});
type PlanillasPeriodoParams = z.infer<typeof planillasPeriodoSchema>;

const planillasPorPeriodo: ReportDefinition<PlanillasPeriodoParams> = {
  id: 'planillas-por-periodo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Planillas por período',
  descripcion: 'Sueldo base, comisiones, bonos, viáticos, descuentos y líquido por empleado.',
  moduloPermiso: 'planilla',
  layout: 'financial',
  parametros: [
    { key: 'anio', label: 'Año', type: 'number' },
    { key: 'mes', label: 'Mes (1-12)', type: 'number' },
    empleadoParam(),
    { key: 'estado', label: 'Estado', type: 'select', options: estadoPlanillaOptions },
  ],
  schema: planillasPeriodoSchema,
  async run(params) {
    const planillas = await prisma.planillaMensual.findMany({
      where: {
        Anulado: false,
        ...(params.anio ? { Anio: params.anio } : {}),
        ...(params.mes ? { Mes: params.mes } : {}),
        ...(params.idEmpleado ? { IdEmpleado: params.idEmpleado } : {}),
        ...(params.estado ? { Estado: params.estado } : {}),
      },
      include: { Empleado: { select: { Entidad: { select: { NombreCompleto: true } } } } },
      orderBy: [{ Anio: 'desc' }, { Mes: 'desc' }],
      take: 5000,
    });

    const rows = planillas.map((p) => ({
      periodo: `${p.Mes}/${p.Anio}`,
      empleado: p.Empleado.Entidad.NombreCompleto,
      estado: p.Estado,
      sueldoBase: round2(Number(p.SueldoBase)),
      comisiones: round2(Number(p.TotalComisiones)),
      bonos: round2(Number(p.TotalBonosMetas)),
      viaticos: round2(Number(p.TotalViaticos)),
      descuentos: round2(Number(p.TotalDescuentos)),
      liquido: round2(Number(p.SueldoLiquido)),
    }));

    return {
      columns: [
        { key: 'periodo', label: 'Período', type: 'text' },
        { key: 'empleado', label: 'Empleado', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
        { key: 'sueldoBase', label: 'Sueldo base', type: 'currency' },
        { key: 'comisiones', label: 'Comisiones', type: 'currency' },
        { key: 'bonos', label: 'Bonos', type: 'currency' },
        { key: 'viaticos', label: 'Viáticos', type: 'currency' },
        { key: 'descuentos', label: 'Descuentos', type: 'currency' },
        { key: 'liquido', label: 'Líquido', type: 'currency' },
      ],
      rows,
      totals: { liquido: sumByKey(rows, (r) => Number(r.liquido)) },
      indicators: [
        { label: 'Planillas', value: rows.length },
        { label: 'Total líquido', value: `Q ${sumByKey(rows, (r) => Number(r.liquido)).toFixed(2)}` },
      ],
      meta: { totalRegistros: rows.length, truncado: planillas.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 68. Comisiones por empleado y producto -------------------------------------------------------------
const comisionesEmpleadoSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  idEmpleado: optionalPositiveIntParam,
});
type ComisionesEmpleadoParams = z.infer<typeof comisionesEmpleadoSchema>;

const comisionesPorEmpleado: ReportDefinition<ComisionesEmpleadoParams> = {
  id: 'comisiones-por-empleado',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Comisiones por empleado y producto',
  descripcion: 'Detalle del cálculo de comisiones por producto dentro de cada planilla.',
  moduloPermiso: 'planilla',
  layout: 'financial',
  parametros: [
    { key: 'anio', label: 'Año', type: 'number' },
    { key: 'mes', label: 'Mes (1-12)', type: 'number' },
    empleadoParam(),
  ],
  schema: comisionesEmpleadoSchema,
  async run(params) {
    const detalles = await prisma.planillaDetalleComision.findMany({
      where: {
        Anulado: false,
        PlanillaMensual: {
          Anulado: false,
          ...(params.anio ? { Anio: params.anio } : {}),
          ...(params.mes ? { Mes: params.mes } : {}),
          ...(params.idEmpleado ? { IdEmpleado: params.idEmpleado } : {}),
        },
      },
      include: {
        InventarioItem: { select: { Nombre: true } },
        PlanillaMensual: { select: { Mes: true, Anio: true, Empleado: { select: { Entidad: { select: { NombreCompleto: true } } } } } },
      },
      orderBy: { Id: 'desc' },
      take: 5000,
    });

    const rows = detalles.map((d) => ({
      periodo: `${d.PlanillaMensual.Mes}/${d.PlanillaMensual.Anio}`,
      empleado: d.PlanillaMensual.Empleado.Entidad.NombreCompleto,
      producto: d.InventarioItem.Nombre,
      cantidad: round2(d.Cantidad),
      tipoCalculo: d.TipoCalculo,
      montoComision: round2(Number(d.MontoComision)),
    }));

    return {
      columns: [
        { key: 'periodo', label: 'Período', type: 'text' },
        { key: 'empleado', label: 'Empleado', type: 'text' },
        { key: 'producto', label: 'Producto', type: 'text' },
        { key: 'cantidad', label: 'Cantidad', type: 'number' },
        { key: 'tipoCalculo', label: 'Tipo de cálculo', type: 'badge' },
        { key: 'montoComision', label: 'Comisión', type: 'currency' },
      ],
      rows,
      totals: { montoComision: sumByKey(rows, (r) => Number(r.montoComision)) },
      meta: { totalRegistros: rows.length, truncado: detalles.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 69. Ajustes de planilla por tipo -------------------------------------------------------------------
const ajustesPlanillaSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  tipoAjuste: z.enum(['BONO_META', 'VIATICO', 'DESCUENTO']).optional(),
});
type AjustesPlanillaParams = z.infer<typeof ajustesPlanillaSchema>;

const ajustesPlanilla: ReportDefinition<AjustesPlanillaParams> = {
  id: 'ajustes-planilla-por-tipo',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Ajustes de planilla por tipo',
  descripcion: 'Bonos por meta, viáticos y descuentos aplicados en planilla.',
  moduloPermiso: 'planilla',
  layout: 'financial',
  parametros: [
    { key: 'anio', label: 'Año', type: 'number' },
    { key: 'mes', label: 'Mes (1-12)', type: 'number' },
    { key: 'tipoAjuste', label: 'Tipo de ajuste', type: 'select', options: tipoAjusteOptions },
  ],
  schema: ajustesPlanillaSchema,
  async run(params) {
    const ajustes = await prisma.planillaDetalleAjuste.findMany({
      where: {
        Anulado: false,
        ...(params.tipoAjuste ? { TipoAjuste: params.tipoAjuste } : {}),
        PlanillaMensual: {
          Anulado: false,
          ...(params.anio ? { Anio: params.anio } : {}),
          ...(params.mes ? { Mes: params.mes } : {}),
        },
      },
      include: {
        PlanillaMensual: { select: { Mes: true, Anio: true, Empleado: { select: { Entidad: { select: { NombreCompleto: true } } } } } },
      },
      take: 5000,
    });

    const rows = ajustes.map((a) => ({
      periodo: `${a.PlanillaMensual.Mes}/${a.PlanillaMensual.Anio}`,
      empleado: a.PlanillaMensual.Empleado.Entidad.NombreCompleto,
      tipoAjuste: a.TipoAjuste,
      descripcion: a.Descripcion,
      monto: round2(Number(a.Monto)),
    }));

    const byTipo = new Map<string, number>();
    for (const row of rows) {
      byTipo.set(row.tipoAjuste, (byTipo.get(row.tipoAjuste) ?? 0) + Number(row.monto));
    }

    return {
      columns: [
        { key: 'periodo', label: 'Período', type: 'text' },
        { key: 'empleado', label: 'Empleado', type: 'text' },
        { key: 'tipoAjuste', label: 'Tipo', type: 'badge' },
        { key: 'descripcion', label: 'Descripción', type: 'text' },
        { key: 'monto', label: 'Monto', type: 'currency' },
      ],
      rows,
      totals: { monto: sumByKey(rows, (r) => Number(r.monto)) },
      indicators: Array.from(byTipo.entries()).map(([tipo, monto]) => ({ label: tipo, value: `Q ${round2(monto).toFixed(2)}` })),
      meta: { totalRegistros: rows.length, truncado: ajustes.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 70. Resumen de nómina mensual ---------------------------------------------------------------------
const resumenNominaSchema = z.object({ anio: z.coerce.number().int().min(2000).max(2100) });
type ResumenNominaParams = z.infer<typeof resumenNominaSchema>;

const resumenNominaMensual: ReportDefinition<ResumenNominaParams> = {
  id: 'resumen-nomina-mensual',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Resumen de nómina mensual',
  descripcion: 'Total pagado por mes a lo largo de un año.',
  moduloPermiso: 'planilla',
  layout: 'financial',
  parametros: [{ key: 'anio', label: 'Año', type: 'number', required: true }],
  schema: resumenNominaSchema,
  async run(params) {
    const planillas = await prisma.planillaMensual.findMany({
      where: { Anulado: false, Anio: params.anio },
      select: { Mes: true, SueldoLiquido: true },
      take: 5000,
    });

    const byMes = new Map<number, number>();
    for (const p of planillas) {
      byMes.set(p.Mes, (byMes.get(p.Mes) ?? 0) + Number(p.SueldoLiquido));
    }

    const rows = Array.from(byMes.entries())
      .sort(([a], [b]) => a - b)
      .map(([mes, total]) => ({ mes, total: round2(total) }));

    return {
      columns: [
        { key: 'mes', label: 'Mes', type: 'number' },
        { key: 'total', label: 'Total pagado', type: 'currency' },
      ],
      rows,
      totals: { total: sumByKey(rows, (r) => Number(r.total)) },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 71. Empleados por puesto/estado ------------------------------------------------------------------
const empleadosPuestoSchema = z.object({ estado: z.enum(['activos', 'anulados', 'todos']).default('activos') });
type EmpleadosPuestoParams = z.infer<typeof empleadosPuestoSchema>;

const empleadosPorPuesto: ReportDefinition<EmpleadosPuestoParams> = {
  id: 'empleados-por-puesto',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Empleados por puesto y estado',
  descripcion: 'Distribución de empleados según su puesto de trabajo.',
  moduloPermiso: 'empleados',
  parametros: [
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'activos', label: 'Activos' },
        { value: 'anulados', label: 'Anulados' },
        { value: 'todos', label: 'Todos' },
      ],
    },
  ],
  schema: empleadosPuestoSchema,
  async run(params) {
    const empleados = await prisma.empleado.findMany({
      where: {
        ...(params.estado === 'activos' ? { Anulado: false } : {}),
        ...(params.estado === 'anulados' ? { Anulado: true } : {}),
      },
      select: { PuestoTrabajo: true, Anulado: true },
      take: 5000,
    });

    const byPuesto = new Map<string, number>();
    for (const e of empleados) {
      byPuesto.set(e.PuestoTrabajo, (byPuesto.get(e.PuestoTrabajo) ?? 0) + 1);
    }

    const rows = Array.from(byPuesto.entries()).map(([puesto, conteo]) => ({ puesto, conteo }));

    return {
      columns: [
        { key: 'puesto', label: 'Puesto de trabajo', type: 'text' },
        { key: 'conteo', label: '# Empleados', type: 'number' },
      ],
      rows,
      totals: { conteo: empleados.length },
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

export const payrollReports = [planillasPorPeriodo, comisionesPorEmpleado, ajustesPlanilla, resumenNominaMensual, empleadosPorPuesto];
