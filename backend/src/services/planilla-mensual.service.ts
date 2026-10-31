import { createHash } from 'node:crypto';
import { prisma } from '../config/prisma';

type AjusteTipo = 'BONO_META';
type EstadoPlanilla = 'BORRADOR' | 'CERRADA';
type TipoCalculoRegla = 'PORCENTAJE_VENTA' | 'MONTO_POR_UNIDAD';

type AjusteInput = {
  tipoAjuste: AjusteTipo;
  descripcion: string;
  monto: number;
};

type SalarySnapshotInput = {
  idEmpleadoSueldoVigencia: number | null;
  fechaInicio: Date;
  fechaFin: Date;
  diasCalendario: number;
  sueldoMensualSnapshot: number;
  montoDevengado: number;
};

type AdjustmentDetailInput = {
  tipoAjuste: AjusteTipo | 'ADELANTO' | 'FALTANTE';
  descripcion: string;
  monto: number;
};

type EmployeePayrollInput = {
  idEmpleado: number;
  diasTrabajados?: number;
  ajustes?: AjusteInput[];
};

type GeneratePayrollInput = {
  mes: number;
  anio: number;
  idUsuarioGenerador: number;
  previewId: string;
  idEmpleado?: number;
  observaciones?: string;
  empleados?: EmployeePayrollInput[];
};

type PreviewPayrollInput = {
  mes: number;
  anio: number;
  idEmpleado?: number;
  empleados?: EmployeePayrollInput[];
};

type UpdatePayrollInput = {
  idUsuarioModificador: number;
  observaciones?: string | null;
  ajustes?: AjusteInput[];
};

function normalizeEstado(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateProratedSalary(
  employee: {
    Id: number;
    SueldoBase: unknown;
    FechaContratacion: Date;
    FechaSalida: Date | null;
    HistorialSueldos: Array<{
      Id: number;
      SueldoBase: unknown;
      FechaInicioVigencia: Date;
      FechaFinVigencia: Date | null;
    }>;
  },
  range: { start: Date; end: Date },
): { sueldoBase: number; detalleSalarios: SalarySnapshotInput[]; historialIncompleto: boolean } {
  const employmentStart = new Date(Math.max(
    dateOnlyUtc(employee.FechaContratacion).getTime(),
    dateOnlyUtc(range.start).getTime(),
  ));
  const employmentEnd = new Date(Math.min(
    dateOnlyUtc(employee.FechaSalida ?? range.end).getTime(),
    dateOnlyUtc(range.end).getTime(),
  ));
  if (employmentStart > employmentEnd) {
    return { sueldoBase: 0, detalleSalarios: [], historialIncompleto: false };
  }

  const versions = employee.HistorialSueldos
    .map((version) => ({
      ...version,
      inicio: dateOnlyUtc(version.FechaInicioVigencia),
      fin: version.FechaFinVigencia ? dateOnlyUtc(version.FechaFinVigencia) : null,
      sueldo: Number(version.SueldoBase),
    }))
    .filter((version) => version.inicio <= employmentEnd)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const currentSalary = Number(employee.SueldoBase);
  const daysInMonth = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() + 1, 0)).getUTCDate();
  const segments: SalarySnapshotInput[] = [];
  let segmentStart: Date | null = null;
  let activeVersion: (typeof versions)[number] | null = null;
  let segmentDays = 0;
  let historialIncompleto = false;

  const flushSegment = (end: Date) => {
    if (!segmentStart || segmentDays === 0 || !activeVersion) return;
    const monthlySalary = activeVersion.sueldo;
    segments.push({
      idEmpleadoSueldoVigencia: activeVersion.Id,
      fechaInicio: segmentStart,
      fechaFin: end,
      diasCalendario: segmentDays,
      sueldoMensualSnapshot: toMoney(monthlySalary),
      montoDevengado: toMoney((monthlySalary / daysInMonth) * segmentDays),
    });
  };

  for (let timestamp = employmentStart.getTime(); timestamp <= employmentEnd.getTime(); timestamp += 86_400_000) {
    const day = new Date(timestamp);
    const applicableVersions = versions.filter(
      (item) => item.inicio <= day && (!item.fin || item.fin >= day),
    );
    const version = applicableVersions[applicableVersions.length - 1] ?? null;
    const effectiveVersion = version ?? (
      versions.length === 0 && Number.isFinite(currentSalary) && currentSalary >= 0
        ? {
            Id: 0,
            SueldoBase: currentSalary,
            FechaInicioVigencia: employmentStart,
            FechaFinVigencia: null,
            inicio: employmentStart,
            fin: null,
            sueldo: currentSalary,
          }
        : null
    );
    if (!effectiveVersion || !Number.isFinite(effectiveVersion.sueldo) || effectiveVersion.sueldo < 0) {
      historialIncompleto = true;
      if (segmentStart) flushSegment(new Date(timestamp - 86_400_000));
      segmentStart = null;
      activeVersion = null;
      segmentDays = 0;
      continue;
    }

    if (activeVersion?.Id !== effectiveVersion.Id) {
      if (segmentStart) flushSegment(new Date(timestamp - 86_400_000));
      segmentStart = day;
      segmentDays = 0;
      activeVersion = effectiveVersion;
    }
    segmentDays += 1;
  }
  if (segmentStart) flushSegment(employmentEnd);

  return {
    sueldoBase: toMoney(segments.reduce((total, segment) => total + segment.montoDevengado, 0)),
    detalleSalarios: segments.map((segment) => ({
      ...segment,
      idEmpleadoSueldoVigencia: segment.idEmpleadoSueldoVigencia || null,
    })),
    historialIncompleto,
  };
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function startOfMonthUtc(mes: number, anio: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1, 0, 0, 0, 0));
}

function endOfMonthUtc(mes: number, anio: number): Date {
  return new Date(Date.UTC(anio, mes, 0, 23, 59, 59, 999));
}

function validatePeriod(mes: number, anio: number) {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error('Mes inválido');
  }

  if (!Number.isInteger(anio) || anio < 2000 || anio > 9999) {
    throw new Error('Año inválido');
  }
}

function validateAjustes(ajustes: AjusteInput[] = []) {
  for (const ajuste of ajustes) {
    if (ajuste.monto < 0) {
      throw new Error('Monto de ajuste inválido');
    }
  }
}

function getEmployeeInput(employeeInputs: EmployeePayrollInput[] = [], idEmpleado: number) {
  const matches = employeeInputs.filter((item) => item.idEmpleado === idEmpleado);
  if (matches.length > 1) {
    throw new Error('No se puede repetir un empleado en la previsualización.');
  }
  return matches[0] ?? { idEmpleado, diasTrabajados: 0, ajustes: [] };
}

async function validateUsuarioExists(idUsuario: number) {
  const user = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }
}

function toPlanillaDto(planilla: {
  Id: number;
  IdEmpleado: number;
  Mes: number;
  Anio: number;
  Estado: string;
  IdUsuarioGenerador: number | null;
  SueldoBase: unknown;
  TotalComisiones: unknown;
  TotalBonosMetas: unknown;
  TotalViaticos: unknown;
  TotalDescuentos: unknown;
  SueldoLiquido: unknown;
  Observaciones: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  DiasTrabajados?: number | null;
  TarifaViaticoAplicada?: unknown;
  FechaAnulacion: Date | null;
  Empleado?: {
    Id: number;
    IdUsuarioVinculado: number | null;
    Entidad: {
      Id: number;
      NombreCompleto: string;
    };
  };
}) {
  return {
    id: planilla.Id,
    idEmpleado: planilla.IdEmpleado,
    mes: planilla.Mes,
    anio: planilla.Anio,
    estado: normalizeEstado(planilla.Estado) as EstadoPlanilla,
    idUsuarioGenerador: planilla.IdUsuarioGenerador,
    sueldoBase: Number(planilla.SueldoBase),
    totalComisiones: Number(planilla.TotalComisiones),
    totalBonosMetas: Number(planilla.TotalBonosMetas),
    totalViaticos: Number(planilla.TotalViaticos),
    diasTrabajados: planilla.DiasTrabajados ?? 0,
    tarifaViaticoAplicada: planilla.TarifaViaticoAplicada === null ||
      planilla.TarifaViaticoAplicada === undefined
      ? null
      : Number(planilla.TarifaViaticoAplicada),
    totalDescuentos: Number(planilla.TotalDescuentos),
    sueldoLiquido: Number(planilla.SueldoLiquido),
    observaciones: planilla.Observaciones,
    fechaRegistro: planilla.FechaRegistro,
    idUsuarioModificador: planilla.IdUsuarioModificador,
    fechaModificacion: planilla.FechaModificacion,
    anulado: planilla.Anulado,
    idUsuarioAnulador: planilla.IdUsuarioAnulador,
    fechaAnulacion: planilla.FechaAnulacion,
    empleado: planilla.Empleado
      ? {
          id: planilla.Empleado.Id,
          idUsuarioVinculado: planilla.Empleado.IdUsuarioVinculado,
          entidad: {
            id: planilla.Empleado.Entidad.Id,
            nombreCompleto: planilla.Empleado.Entidad.NombreCompleto,
          },
        }
      : undefined,
  };
}

type CalculatedCommissionRow = {
  idReglaComision: number | null;
  idReglaComisionCategoria?: number;
  idCategoriaComision?: number;
  baseCategoriaAplicada?: number | null;
  categoriaComisionSnapshot?: string;
  idConfiguracionComision: number | null;
  cantidadMinimaAplicada: number | null;
  cantidadMaximaAplicada: number | null;
  idInventarioItem: number;
  nombreProducto: string;
  cantidad: number;
  baseCalculo: number;
  tipoCalculo: TipoCalculoRegla;
  valorAplicado: number;
  montoComision: number;
  fuentes: Array<{
    idDetalleVenta: number;
    idVenta: number;
    idRutaSesion: number | null;
    idEmpleadoAtribuido: number;
    fechaSesion: Date;
    sesionAnulada: boolean;
    estadoPago: string;
    ventaAnulada: boolean;
    detalleVentaAnulado: boolean;
    esBonificacion: boolean;
    idUsuarioChofer: number | null;
    idUsuarioVendedor: number | null;
    idUsuarioAtribuido: number | null;
    rolAtribucion: 'VENDEDOR';
    cantidad: number;
    precioUnitario: number;
    baseCalculo: number;
  }>;
};

type EmployeeComputation = {
  idEmpleado: number;
  nombreEmpleado: string;
  idUsuarioVinculado: number | null;
  sueldoBase: number;
  detalleSalarios: SalarySnapshotInput[];
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  diasTrabajados: number;
  tarifaViaticoAplicada: number | null;
  sueldoLiquido: number;
  detalleComisiones: CalculatedCommissionRow[];
  detalleAjustes: AdjustmentDetailInput[];
  adelantoAplicaciones: Array<{ idAdelantoEmpleado: number; montoAplicado: number }>;
  faltanteIds: number[];
};

type PayrollValidation = {
  idEmpleado: number;
  nombreEmpleado: string;
  codigo: 'CONFIGURACION_FALTANTE' |
    'CONFIGURACION_NO_DISPONIBLE' | 'REGLAS_NO_CONFIGURADAS' |
    'REGLA_FALTANTE' | 'REGLAS_SOLAPADAS' | 'DATOS_CALCULO_INVALIDOS' |
    'PLANILLA_EXISTENTE' | 'TIPO_TRABAJADOR_FALTANTE' | 'HISTORIAL_SUELDO_INCOMPLETO' |
    'TARIFA_VIATICO_NO_CONFIGURADA' | 'CATEGORIA_COMISION_FALTANTE';
  mensaje: string;
  idInventarioItem?: number;
  nombreProducto?: string;
};

async function calculateEmployeePayroll(
  employee: {
    Id: number;
    IdUsuarioVinculado: number | null;
    IdConfiguracionComision: number | null;
    IdTipoTrabajador: number | null;
    SueldoBase: unknown;
    FechaContratacion: Date;
    FechaSalida: Date | null;
    HistorialSueldos: Array<{
      Id: number;
      SueldoBase: unknown;
      FechaInicioVigencia: Date;
      FechaFinVigencia: Date | null;
    }>;
    TipoTrabajador: { Clave: string } | null;
    Entidad: { NombreCompleto: string };
  },
  range: { start: Date; end: Date },
  employeeInput: EmployeePayrollInput,
  tarifaViatico: { TarifaDiaria: unknown } | null,
): Promise<{ planilla?: EmployeeComputation; validaciones: PayrollValidation[] }> {
  const validaciones: PayrollValidation[] = [];
  const idUsuarioVinculado = employee.IdUsuarioVinculado;
  if (employee.IdTipoTrabajador === null) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'TIPO_TRABAJADOR_FALTANTE',
        mensaje: 'Asigne un tipo de trabajador al empleado antes de calcular.',
      }],
    };
  }

  const tipoTrabajador = employee.TipoTrabajador?.Clave;
  const isPlantWorker = tipoTrabajador === 'PLANTA';
  if (tipoTrabajador !== 'PLANTA' && tipoTrabajador !== 'RUTA') {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'TIPO_TRABAJADOR_FALTANTE',
        mensaje: 'El tipo de trabajador no está configurado para la nómina.',
      }],
    };
  }

  const ajustes = employeeInput.ajustes ?? [];
  validateAjustes(ajustes);
  const diasTrabajados = isPlantWorker ? 0 : employeeInput.diasTrabajados ?? 0;
  if (!Number.isInteger(diasTrabajados) || diasTrabajados < 0 || diasTrabajados > 31) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: 'Los días trabajados deben ser un entero entre 0 y 31.',
      }],
    };
  }

  if (!isPlantWorker && diasTrabajados > 0 && !tarifaViatico) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'TARIFA_VIATICO_NO_CONFIGURADA',
        mensaje: 'No hay tarifa de viático vigente para el período.',
      }],
    };
  }

  const configuracion = isPlantWorker
    ? null
    : employee.IdConfiguracionComision
      ? await prisma.configuracionComision.findFirst({
          where: { Id: employee.IdConfiguracionComision, Anulado: false },
          select: { Id: true },
        })
      : await prisma.configuracionComision.findFirst({
          where: { EsGeneral: true, Anulado: false },
          select: { Id: true },
        });

  if (!isPlantWorker && !configuracion) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: employee.IdConfiguracionComision
          ? 'CONFIGURACION_NO_DISPONIBLE'
          : 'CONFIGURACION_FALTANTE',
        mensaje: employee.IdConfiguracionComision
          ? 'La configuración asignada no existe o está anulada.'
          : 'No existe una configuración general de comisión activa.',
      }],
    };
  }

  const salary = calculateProratedSalary(employee, range);
  if (salary.historialIncompleto) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'HISTORIAL_SUELDO_INCOMPLETO',
        mensaje: 'No existe una vigencia salarial válida para todos los días trabajados del período.',
      }],
    };
  }
  const sueldoBase = salary.sueldoBase;

  const detalles = isPlantWorker ? [] : await prisma.detalleVenta.findMany({
    where: {
      Anulado: false,
      EsBonificacion: false,
      Venta: {
        Anulado: false,
        TipoRegistro: 'VENTA',
        FechaVentaEfectiva: {
          gte: range.start,
          lte: range.end,
        },
        IdEmpleadoVendedor: employee.Id,
      },
    },
    select: {
      Id: true,
      IdVenta: true,
      IdInventarioItem: true,
      Anulado: true,
      EsBonificacion: true,
      Cantidad: true,
      PrecioUnitario: true,
      Venta: {
        select: {
          EstadoPago: true,
          Anulado: true,
          TipoRegistro: true,
          FechaVentaEfectiva: true,
          IdEmpleadoVendedor: true,
          RutaSesion: {
            select: {
              Id: true,
              FechaSesion: true,
              Anulado: true,
              IdUsuarioChofer: true,
              IdUsuarioVendedor: true,
            },
          },
        },
      },
      InventarioItem: {
        select: {
          Nombre: true,
          IdCategoriaComision: true,
          CategoriaComision: {
            select: {
              Nombre: true,
            },
          },
        },
      },
    },
  });

  const grouped = new Map<
    number,
    {
      nombre: string;
      idCategoriaComision: number | null;
      categoriaComisionNombre: string | null;
      cantidad: number;
      baseCalculo: number;
      fuentes: CalculatedCommissionRow['fuentes'];
    }
  >();

  const uniqueDetails = new Map(detalles.map((detalle) => [detalle.Id, detalle]));
  for (const detalle of uniqueDetails.values()) {
    const sesion = detalle.Venta.RutaSesion;
    const fechaVenta = detalle.Venta.FechaVentaEfectiva;
    if (
      detalle.Venta.IdEmpleadoVendedor !== employee.Id ||
      !fechaVenta ||
      detalle.Venta.TipoRegistro !== 'VENTA'
    ) {
      continue;
    }

    const precioUnitario = Number(detalle.PrecioUnitario);
    if (
      !Number.isFinite(detalle.Cantidad) ||
      detalle.Cantidad <= 0 ||
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0
    ) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: `La venta #${detalle.IdVenta} contiene cantidad o precio unitario inválido.`,
        idInventarioItem: detalle.IdInventarioItem,
        nombreProducto: detalle.InventarioItem.Nombre,
      });
      continue;
    }

    const subtotal = precioUnitario * detalle.Cantidad;
    if (!Number.isFinite(subtotal)) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: `La base de cálculo de la venta #${detalle.IdVenta} excede el rango numérico.`,
        idInventarioItem: detalle.IdInventarioItem,
        nombreProducto: detalle.InventarioItem.Nombre,
      });
      continue;
    }

    const fuente: CalculatedCommissionRow['fuentes'][number] = {
      idDetalleVenta: detalle.Id,
      idVenta: detalle.IdVenta,
      idRutaSesion: sesion?.Id ?? null,
      idEmpleadoAtribuido: employee.Id,
      fechaSesion: fechaVenta,
      sesionAnulada: sesion?.Anulado ?? false,
      estadoPago: detalle.Venta.EstadoPago,
      ventaAnulada: detalle.Venta.Anulado,
      detalleVentaAnulado: detalle.Anulado,
      esBonificacion: detalle.EsBonificacion,
      idUsuarioChofer: sesion?.IdUsuarioChofer ?? null,
      idUsuarioVendedor: sesion?.IdUsuarioVendedor ?? null,
      idUsuarioAtribuido: null,
      rolAtribucion: 'VENDEDOR',
      cantidad: detalle.Cantidad,
      precioUnitario,
      baseCalculo: toMoney(subtotal),
    };
    const actual = grouped.get(detalle.IdInventarioItem);
    if (!actual) {
      grouped.set(detalle.IdInventarioItem, {
        nombre: detalle.InventarioItem.Nombre,
        idCategoriaComision: detalle.InventarioItem.IdCategoriaComision,
        categoriaComisionNombre: detalle.InventarioItem.CategoriaComision?.Nombre ?? null,
        cantidad: detalle.Cantidad,
        baseCalculo: subtotal,
        fuentes: [fuente],
      });
      continue;
    }

    if (actual.idCategoriaComision !== detalle.InventarioItem.IdCategoriaComision) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: `La categoría de comisión del producto "${detalle.InventarioItem.Nombre}" cambió durante el cálculo.`,
        idInventarioItem: detalle.IdInventarioItem,
        nombreProducto: detalle.InventarioItem.Nombre,
      });
      continue;
    }

    actual.cantidad += detalle.Cantidad;
    actual.baseCalculo += subtotal;
    actual.fuentes.push(fuente);
  }

  const reglas = isPlantWorker ? [] : await prisma.reglaComision.findMany({
    where: {
      IdConfiguracionComision: configuracion?.Id ?? -1,
      Anulado: false,
    },
    select: {
      Id: true,
      IdConfiguracionComision: true,
      IdInventarioItem: true,
      CantidadMinima: true,
      CantidadMaxima: true,
      TipoCalculo: true,
      Porcentaje: true,
      MontoPorUnidad: true,
    },
  });
  const reglasCategoria = isPlantWorker ? [] : await prisma.reglaComisionCategoria.findMany({
    where: {
      IdConfiguracionComision: configuracion?.Id ?? -1,
      Anulado: false,
      FechaInicioVigencia: { lte: range.end },
      OR: [
        { FechaFinVigencia: null },
        { FechaFinVigencia: { gte: range.end } },
      ],
    },
    select: {
      Id: true,
      IdCategoriaComision: true,
      MontoMinimoVenta: true,
      Porcentaje: true,
      FechaInicioVigencia: true,
      FechaFinVigencia: true,
    },
  });

  const unmappedItems = [...grouped.values()].filter((item) => item.idCategoriaComision === null);
  if (!isPlantWorker && unmappedItems.length > 0 && reglas.length === 0) {
    validaciones.push({
      idEmpleado: employee.Id,
      nombreEmpleado: employee.Entidad.NombreCompleto,
      codigo: 'REGLAS_NO_CONFIGURADAS',
      mensaje: 'La configuración no contiene reglas activas para productos sin categoría de comisión.',
    });
  }

  const basePorCategoria = new Map<number, number>();
  for (const item of grouped.values()) {
    if (item.idCategoriaComision !== null) {
      basePorCategoria.set(
        item.idCategoriaComision,
        (basePorCategoria.get(item.idCategoriaComision) ?? 0) + item.baseCalculo,
      );
    }
  }
  const reglasCategoriaAplicadas = new Map<number, (typeof reglasCategoria)[number]>();
  for (const [idCategoria, baseCategoria] of basePorCategoria) {
    const vigentes = reglasCategoria
      .filter((rule) =>
        rule.IdCategoriaComision === idCategoria &&
        rule.FechaInicioVigencia <= range.end &&
        (rule.FechaFinVigencia === null || rule.FechaFinVigencia >= range.start),
      )
      .sort((left, right) => Number(right.MontoMinimoVenta) - Number(left.MontoMinimoVenta));
    const selected = vigentes.find((rule) => Number(rule.MontoMinimoVenta) <= baseCategoria);
    if (!selected) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'REGLA_FALTANTE',
        mensaje: `No hay una regla vigente para la categoría "${[...grouped.values()].find((item) => item.idCategoriaComision === idCategoria)?.categoriaComisionNombre ?? idCategoria}".`,
      });
    } else {
      reglasCategoriaAplicadas.set(idCategoria, selected);
    }
  }

  for (const [idInventarioItem, item] of grouped.entries()) {
    if (item.idCategoriaComision !== null) {
      continue;
    }

    const reglasAplicables = reglas.filter((regla) => {
      if (regla.IdInventarioItem !== idInventarioItem) {
        return false;
      }
      const max = regla.CantidadMaxima ?? Number.POSITIVE_INFINITY;
      return item.cantidad >= regla.CantidadMinima && item.cantidad <= max;
    });

    if (reglasAplicables.length !== 1) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: reglasAplicables.length === 0 ? 'REGLA_FALTANTE' : 'REGLAS_SOLAPADAS',
        mensaje: reglasAplicables.length === 0
          ? `No hay una regla activa para la cantidad del producto "${item.nombre}".`
          : `Hay varias reglas activas para la cantidad del producto "${item.nombre}"; corrija el solapamiento.`,
        idInventarioItem,
        nombreProducto: item.nombre,
      });
      continue;
    }

    const regla = reglasAplicables[0];
    const tipoCalculo = normalizeEstado(regla.TipoCalculo);
    const porcentaje = Number(regla.Porcentaje);
    const montoPorUnidad = regla.MontoPorUnidad === null ? null : Number(regla.MontoPorUnidad);
    const reglaValida = tipoCalculo === 'PORCENTAJE_VENTA'
      ? Number.isFinite(porcentaje) && porcentaje > 0 && porcentaje <= 100
      : tipoCalculo === 'MONTO_POR_UNIDAD' &&
        montoPorUnidad !== null &&
        Number.isFinite(montoPorUnidad) &&
        montoPorUnidad > 0;

    if (!reglaValida) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: `La regla activa para "${item.nombre}" contiene tipo o valores inválidos.`,
        idInventarioItem,
        nombreProducto: item.nombre,
      });
    }
  }

  const detalleComisiones: CalculatedCommissionRow[] = [];
  let totalComisiones = 0;
  const categoriaComisionSinRedondear = new Map<number, number>();
  const categoriaComisionRedondeada = new Map<number, number>();

  for (const [idInventarioItem, item] of grouped.entries()) {
    if (item.idCategoriaComision !== null) {
      const reglaCategoria = reglasCategoriaAplicadas.get(item.idCategoriaComision);
      if (!reglaCategoria || configuracion === null) {
        continue;
      }
      const porcentaje = Number(reglaCategoria.Porcentaje);
      if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
        validaciones.push({
          idEmpleado: employee.Id,
          nombreEmpleado: employee.Entidad.NombreCompleto,
          codigo: 'DATOS_CALCULO_INVALIDOS',
          mensaje: `La regla de comisión para "${item.categoriaComisionNombre ?? item.idCategoriaComision}" contiene un porcentaje inválido.`,
        });
        continue;
      }
      const montoSinRedondear = item.baseCalculo * (porcentaje / 100);
      const acumuladoSinRedondear =
        (categoriaComisionSinRedondear.get(item.idCategoriaComision) ?? 0) + montoSinRedondear;
      const acumuladoRedondeado = toMoney(acumuladoSinRedondear);
      const montoComisionRounded = toMoney(
        acumuladoRedondeado - (categoriaComisionRedondeada.get(item.idCategoriaComision) ?? 0),
      );
      categoriaComisionSinRedondear.set(item.idCategoriaComision, acumuladoSinRedondear);
      categoriaComisionRedondeada.set(item.idCategoriaComision, acumuladoRedondeado);
      totalComisiones += montoComisionRounded;
      detalleComisiones.push({
        idReglaComision: null,
        idReglaComisionCategoria: reglaCategoria.Id,
        idCategoriaComision: item.idCategoriaComision,
        baseCategoriaAplicada: toMoney(basePorCategoria.get(item.idCategoriaComision) ?? 0),
        categoriaComisionSnapshot: item.categoriaComisionNombre ?? '',
        idConfiguracionComision: configuracion.Id,
        cantidadMinimaAplicada: 0,
        cantidadMaximaAplicada: null,
        idInventarioItem,
        nombreProducto: item.nombre,
        cantidad: toMoney(item.cantidad),
        baseCalculo: toMoney(item.baseCalculo),
        tipoCalculo: 'PORCENTAJE_VENTA',
        valorAplicado: toMoney(porcentaje),
        montoComision: montoComisionRounded,
        fuentes: item.fuentes,
      });
      continue;
    }

    const regla = reglas.find((candidate) => {
      if (candidate.IdInventarioItem !== idInventarioItem) {
        return false;
      }
      const max = candidate.CantidadMaxima ?? Number.POSITIVE_INFINITY;
      return item.cantidad >= candidate.CantidadMinima && item.cantidad <= max;
    });

    if (!regla) {
      continue;
    }

    const tipoCalculo = normalizeEstado(regla.TipoCalculo) as TipoCalculoRegla;
    let montoComision = 0;
    let valorAplicado = 0;

    if (tipoCalculo === 'MONTO_POR_UNIDAD') {
      const montoUnidad = regla.MontoPorUnidad === null ? 0 : Number(regla.MontoPorUnidad);
      valorAplicado = montoUnidad;
      montoComision = item.cantidad * montoUnidad;
    } else {
      valorAplicado = Number(regla.Porcentaje);
      montoComision = item.baseCalculo * (valorAplicado / 100);
    }

    if (!Number.isFinite(montoComision)) {
      validaciones.push({
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: `El importe de comisión para "${item.nombre}" excede el rango numérico.`,
        idInventarioItem,
        nombreProducto: item.nombre,
      });
      continue;
    }

    const montoComisionRounded = toMoney(montoComision);
    totalComisiones += montoComisionRounded;

    detalleComisiones.push({
      idReglaComision: regla.Id,
      idConfiguracionComision: regla.IdConfiguracionComision,
      cantidadMinimaAplicada: regla.CantidadMinima,
      cantidadMaximaAplicada: regla.CantidadMaxima,
      idInventarioItem,
      nombreProducto: item.nombre,
      cantidad: toMoney(item.cantidad),
      baseCalculo: toMoney(item.baseCalculo),
      tipoCalculo,
      valorAplicado: toMoney(valorAplicado),
      montoComision: montoComisionRounded,
      fuentes: item.fuentes,
    });
  }

  if (!isPlantWorker) {
    const commissionLedger = await prisma.comisionDevengada.findMany({
      where: {
        IdEmpleado: employee.Id,
        Mes: range.start.getUTCMonth() + 1,
        Anio: range.start.getUTCFullYear(),
      },
      include: {
        DetalleVenta: {
          select: {
            IdInventarioItem: true,
            PrecioUnitario: true,
            Anulado: true,
            EsBonificacion: true,
            InventarioItem: { select: { Id: true, Nombre: true } },
            Venta: {
              select: {
                Id: true,
                IdRutaSesion: true,
                EstadoPago: true,
                Anulado: true,
                RutaSesion: {
                  select: {
                    FechaSesion: true,
                    Anulado: true,
                    IdUsuarioChofer: true,
                    IdUsuarioVendedor: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { Id: 'asc' },
    });

    if (commissionLedger.length > 0) {
      const bySaleDetail = new Map<number, typeof commissionLedger>();
      for (const entry of commissionLedger) {
        const detailEntries = bySaleDetail.get(entry.IdDetalleVenta) ?? [];
        detailEntries.push(entry);
        bySaleDetail.set(entry.IdDetalleVenta, detailEntries);
      }

      detalleComisiones.splice(0, detalleComisiones.length);
      totalComisiones = 0;
      for (const entries of bySaleDetail.values()) {
        const latest = entries[entries.length - 1];
        const montoComision = toMoney(entries.reduce((sum, entry) => sum + Number(entry.MontoMovimiento), 0));
        if (montoComision === 0) continue;
        const tipoCalculo = normalizeEstado(latest.TipoCalculoSnapshot);
        if (tipoCalculo !== 'PORCENTAJE_VENTA' && tipoCalculo !== 'MONTO_POR_UNIDAD') continue;

        const source = latest.DetalleVenta;
        const routeSession = source.Venta.RutaSesion;
        detalleComisiones.push({
          idReglaComision: latest.IdReglaSnapshot,
          idReglaComisionCategoria: latest.IdReglaCategoriaSnapshot ?? undefined,
          idCategoriaComision: latest.IdCategoriaSnapshot ?? undefined,
          categoriaComisionSnapshot: latest.CategoriaSnapshot ?? undefined,
          baseCategoriaAplicada: latest.BaseCategoriaSnapshot === null
            ? null
            : Number(latest.BaseCategoriaSnapshot),
          idConfiguracionComision: latest.IdConfiguracionSnapshot,
          cantidadMinimaAplicada: null,
          cantidadMaximaAplicada: null,
          idInventarioItem: source.IdInventarioItem,
          nombreProducto: latest.NombreProductoSnapshot || source.InventarioItem.Nombre,
          cantidad: latest.CantidadSnapshot,
          baseCalculo: Number(latest.BaseCalculoSnapshot),
          tipoCalculo,
          valorAplicado: Number(latest.ValorAplicadoSnapshot),
          montoComision,
          fuentes: [{
            idDetalleVenta: latest.IdDetalleVenta,
            idVenta: latest.IdVenta,
            idRutaSesion: source.Venta.IdRutaSesion,
            idEmpleadoAtribuido: employee.Id,
            fechaSesion: routeSession?.FechaSesion ?? latest.FechaVentaEfectiva,
            sesionAnulada: routeSession?.Anulado ?? false,
            estadoPago: source.Venta.EstadoPago,
            ventaAnulada: source.Venta.Anulado,
            detalleVentaAnulado: source.Anulado,
            esBonificacion: source.EsBonificacion,
            idUsuarioChofer: routeSession?.IdUsuarioChofer ?? null,
            idUsuarioVendedor: routeSession?.IdUsuarioVendedor ?? null,
            idUsuarioAtribuido: null,
            rolAtribucion: 'VENDEDOR',
            cantidad: latest.CantidadSnapshot,
            precioUnitario: Number(source.PrecioUnitario),
            baseCalculo: Number(latest.BaseCalculoSnapshot),
          }],
        });
        totalComisiones = toMoney(totalComisiones + montoComision);
      }

      for (let index = validaciones.length - 1; index >= 0; index -= 1) {
        const validation = validaciones[index];
        if (
          ['REGLAS_NO_CONFIGURADAS', 'REGLA_FALTANTE', 'REGLAS_SOLAPADAS', 'CATEGORIA_COMISION_FALTANTE'].includes(validation.codigo) ||
          (validation.codigo === 'DATOS_CALCULO_INVALIDOS' && validation.idInventarioItem !== undefined)
        ) {
          validaciones.splice(index, 1);
        }
      }
    }
  }

  if (validaciones.length > 0) {
    return { validaciones };
  }

  const totalBonosMetas = toMoney(
    ajustes
      .filter((item) => item.tipoAjuste === 'BONO_META')
      .reduce((acc, item) => acc + item.monto, 0),
  );
  const [adelantos, faltantes] = await Promise.all([
    prisma.adelantoEmpleado.findMany({
      where: {
        IdEmpleado: employee.Id,
        IdPlanillaMensual: null,
        Anulado: false,
      },
      select: {
        Id: true,
        Monto: true,
        Fecha: true,
        Observacion: true,
        Aplicaciones: {
          where: { Anulado: false },
          select: { MontoAplicado: true },
        },
      },
      orderBy: [{ Fecha: 'asc' }, { Id: 'asc' }],
    }),
    prisma.faltanteEmpleado.findMany({
      where: {
        IdEmpleado: employee.Id,
        IdPlanillaMensual: null,
        Anulado: false,
        Estado: 'APROBADO',
        Fecha: { gte: range.start, lte: range.end },
      },
      select: { Id: true, Monto: true, Fecha: true, Observacion: true },
      orderBy: { Id: 'asc' },
    }),
  ]);
  const totalFaltantes = faltantes.reduce((sum, item) => sum + Number(item.Monto), 0);
  const deductionCapacity = Math.max(
    0,
    sueldoBase + totalComisiones + totalBonosMetas - totalFaltantes,
  );
  let remainingAdvanceCapacity = toMoney(deductionCapacity);
  const adelantoAplicaciones: Array<{ idAdelantoEmpleado: number; montoAplicado: number }> = [];
  for (const advance of adelantos) {
    const alreadyApplied = advance.Aplicaciones.reduce(
      (sum, application) => sum + Number(application.MontoAplicado),
      0,
    );
    const balance = toMoney(Math.max(0, Number(advance.Monto) - alreadyApplied));
    const applied = toMoney(Math.min(balance, remainingAdvanceCapacity));
    if (applied > 0) {
      adelantoAplicaciones.push({ idAdelantoEmpleado: advance.Id, montoAplicado: applied });
      remainingAdvanceCapacity = toMoney(remainingAdvanceCapacity - applied);
    }
    if (remainingAdvanceCapacity <= 0) break;
  }
  const totalAdelantos = toMoney(
    adelantoAplicaciones.reduce((sum, item) => sum + item.montoAplicado, 0),
  );
  const totalDescuentos = toMoney(
    totalAdelantos + totalFaltantes,
  );
  const tarifaViaticoAplicada = isPlantWorker || diasTrabajados === 0 || !tarifaViatico
    ? null
    : Number(tarifaViatico.TarifaDiaria);
  const totalViaticos = tarifaViaticoAplicada === null
    ? 0
    : toMoney(diasTrabajados * tarifaViaticoAplicada);

  const sueldoLiquido = toMoney(
    sueldoBase + totalComisiones + totalBonosMetas - totalDescuentos,
  );

  if (
    !Number.isFinite(totalBonosMetas) ||
    !Number.isFinite(totalViaticos) ||
    !Number.isFinite(totalDescuentos) ||
    !Number.isFinite(sueldoLiquido)
  ) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: 'Los importes o ajustes exceden el rango numérico.',
      }],
    };
  }

  if (validaciones.length > 0) {
    return { validaciones };
  }

  return {
    planilla: {
      idEmpleado: employee.Id,
      nombreEmpleado: employee.Entidad.NombreCompleto,
      idUsuarioVinculado,
      sueldoBase: toMoney(sueldoBase),
      detalleSalarios: salary.detalleSalarios,
      totalComisiones: toMoney(isPlantWorker ? 0 : totalComisiones),
      totalBonosMetas,
      totalViaticos,
      totalDescuentos,
      diasTrabajados,
      tarifaViaticoAplicada,
      sueldoLiquido,
      detalleComisiones: isPlantWorker ? [] : detalleComisiones,
      detalleAjustes: [
        ...ajustes,
        ...adelantoAplicaciones.map((application) => {
          const item = adelantos.find((advance) => advance.Id === application.idAdelantoEmpleado)!;
          return {
          tipoAjuste: 'ADELANTO' as const,
          descripcion: `Adelanto #${item.Id}${item.Observacion ? ` - ${item.Observacion}` : ''}`,
          monto: application.montoAplicado,
          };
        }),
        ...faltantes.map((item) => ({
          tipoAjuste: 'FALTANTE' as const,
          descripcion: `Faltante aprobado #${item.Id}${item.Observacion ? ` - ${item.Observacion}` : ''}`,
          monto: Number(item.Monto),
        })),
      ],
      adelantoAplicaciones,
      faltanteIds: faltantes.map((item) => item.Id),
    },
    validaciones,
  };
}

export async function previewPayroll(input: PreviewPayrollInput) {
  validatePeriod(input.mes, input.anio);
  const employeeInputs = input.empleados ?? [];
  for (const employeeInput of employeeInputs) {
    if (!Number.isInteger(employeeInput.idEmpleado) || employeeInput.idEmpleado <= 0) {
      throw new Error('Empleado inválido en los parámetros individuales.');
    }
    if (
      employeeInput.diasTrabajados !== undefined &&
      (!Number.isInteger(employeeInput.diasTrabajados) ||
        employeeInput.diasTrabajados < 0 ||
        employeeInput.diasTrabajados > 31)
    ) {
      throw new Error('Los días trabajados deben ser un entero entre 0 y 31.');
    }
    validateAjustes(employeeInput.ajustes);
    if (employeeInput.ajustes?.some((adjustment) => adjustment.tipoAjuste !== 'BONO_META')) {
      throw new Error('Solo se permiten bonos manuales; viáticos y descuentos se calculan por empleado.');
    }
  }

  const range = {
    start: startOfMonthUtc(input.mes, input.anio),
    end: endOfMonthUtc(input.mes, input.anio),
  };
  const empleados = await prisma.empleado.findMany({
    where: {
      Anulado: false,
      FechaContratacion: { lte: range.end },
      OR: [
        { FechaSalida: null },
        { FechaSalida: { gte: range.start } },
      ],
      ...(input.idEmpleado !== undefined ? { Id: input.idEmpleado } : {}),
      Entidad: {
        Anulado: false,
      },
    },
    select: {
      Id: true,
      IdUsuarioVinculado: true,
      IdConfiguracionComision: true,
      SueldoBase: true,
      FechaContratacion: true,
      FechaSalida: true,
      IdTipoTrabajador: true,
      TipoTrabajador: {
        select: { Clave: true },
      },
      HistorialSueldos: {
        where: {
          FechaInicioVigencia: { lte: range.end },
          OR: [
            { FechaFinVigencia: null },
            { FechaFinVigencia: { gte: range.start } },
          ],
        },
        orderBy: { FechaInicioVigencia: 'asc' },
        select: {
          Id: true,
          SueldoBase: true,
          FechaInicioVigencia: true,
          FechaFinVigencia: true,
        },
      },
      Entidad: {
        select: {
          NombreCompleto: true,
        },
      },
    },
    orderBy: { Id: 'asc' },
  });

  if (input.idEmpleado !== undefined && empleados.length === 0) {
    throw new Error('Empleado no existe');
  }
  const employeeIds = new Set(empleados.map((employee) => employee.Id));
  if (employeeInputs.some((employeeInput) => !employeeIds.has(employeeInput.idEmpleado))) {
    throw new Error('Hay parámetros individuales para un empleado que no está incluido.');
  }

  const tarifaViatico = await prisma.tarifaViatico.findFirst({
    where: {
      FechaInicioVigencia: { lte: range.end },
      OR: [
        { FechaFinVigencia: null },
        { FechaFinVigencia: { gte: range.end } },
      ],
    },
    select: { TarifaDiaria: true },
    orderBy: { FechaInicioVigencia: 'desc' },
  });

  const calculated = await Promise.all(
    empleados.map((empleado) => calculateEmployeePayroll(
      empleado,
      range,
      getEmployeeInput(employeeInputs, empleado.Id),
      tarifaViatico,
    )),
  );
  const existingPayrolls = await prisma.planillaMensual.findMany({
    where: {
      Mes: input.mes,
      Anio: input.anio,
      Anulado: false,
      ...(input.idEmpleado !== undefined ? { IdEmpleado: input.idEmpleado } : {}),
    },
    select: { IdEmpleado: true },
  });
  const existingEmployeeIds = new Set(existingPayrolls.map((row) => row.IdEmpleado));
  const validaciones = calculated.flatMap((result) => result.validaciones);
  if (empleados.length === 0) {
    throw new Error('No hay empleados activos para incluir en el período.');
  }
  for (const empleado of empleados) {
    if (existingEmployeeIds.has(empleado.Id)) {
      validaciones.push({
        idEmpleado: empleado.Id,
        nombreEmpleado: empleado.Entidad.NombreCompleto,
        codigo: 'PLANILLA_EXISTENTE',
        mensaje: 'Ya existe una planilla activa para este empleado y período.',
      });
    }
  }
  const planillas = calculated.flatMap((result) => result.planilla ? [result.planilla] : []);

  const previewId = createHash('sha256')
    .update(JSON.stringify({
      mes: input.mes,
      anio: input.anio,
      idEmpleado: input.idEmpleado ?? null,
      empleados: employeeInputs,
      planillas,
      validaciones,
    }))
    .digest('hex');
  return {
    mes: input.mes,
    anio: input.anio,
    previewId,
    planillas,
    validaciones,
  };
}

export async function generatePayroll(input: GeneratePayrollInput) {
  validatePeriod(input.mes, input.anio);
  await validateUsuarioExists(input.idUsuarioGenerador);

  const preview = await previewPayroll({
    mes: input.mes,
    anio: input.anio,
    idEmpleado: input.idEmpleado,
    empleados: input.empleados,
  });

  if (preview.previewId !== input.previewId) {
    throw new Error('La previsualización cambió; vuelva a previsualizar antes de generar.');
  }

  if (preview.validaciones.length > 0) {
    throw new Error('Hay validaciones pendientes; corrija los datos indicados antes de generar.');
  }

  const created = await prisma.$transaction(async (tx) => {
    const inserted = [];

    for (const row of preview.planillas) {
      const duplicate = await tx.planillaMensual.findFirst({
        where: {
          IdEmpleado: row.idEmpleado,
          Mes: input.mes,
          Anio: input.anio,
          Anulado: false,
        },
        select: { Id: true },
      });

      if (duplicate) {
        throw new Error(`Ya existe planilla activa para empleado ${row.idEmpleado} en el período`);
      }

      const planilla = await tx.planillaMensual.create({
        data: {
          IdEmpleado: row.idEmpleado,
          Mes: input.mes,
          Anio: input.anio,
          Estado: 'BORRADOR',
          EstadoPago: 'PENDIENTE',
          IdUsuarioGenerador: input.idUsuarioGenerador,
          SueldoBase: row.sueldoBase,
          TotalComisiones: row.totalComisiones,
          TotalBonosMetas: row.totalBonosMetas,
          TotalViaticos: row.totalViaticos,
          TotalDescuentos: row.totalDescuentos,
          SueldoLiquido: row.sueldoLiquido,
          DiasTrabajados: row.diasTrabajados,
          TarifaViaticoAplicada: row.tarifaViaticoAplicada,
          Observaciones: input.observaciones,
          Anulado: false,
        },
      });
      await tx.planillaEvento.create({
        data: {
          IdPlanillaMensual: planilla.Id,
          IdUsuario: input.idUsuarioGenerador,
          Accion: 'GENERAR',
        },
      });

      if (row.detalleSalarios.length > 0) {
        await tx.planillaDetalleSalario.createMany({
          data: row.detalleSalarios.map((salary) => ({
            IdPlanillaMensual: planilla.Id,
            IdEmpleadoSueldoVigencia: salary.idEmpleadoSueldoVigencia,
            FechaInicio: salary.fechaInicio,
            FechaFin: salary.fechaFin,
            DiasCalendario: salary.diasCalendario,
            SueldoMensualSnapshot: salary.sueldoMensualSnapshot,
            MontoDevengado: salary.montoDevengado,
          })),
        });
      }

      if (row.detalleComisiones.length > 0) {
        for (const item of row.detalleComisiones) {
          const detalle = await tx.planillaDetalleComision.create({
            data: {
            IdPlanillaMensual: planilla.Id,
            IdInventarioItem: item.idInventarioItem,
            IdConfiguracionComision: item.idConfiguracionComision,
            IdReglaComision: item.idReglaComision,
            IdReglaComisionCategoria: item.idReglaComisionCategoria,
            IdCategoriaComision: item.idCategoriaComision,
            BaseCategoriaAplicada: item.baseCategoriaAplicada,
            CategoriaComisionSnapshot: item.categoriaComisionSnapshot,
            NombreProductoSnapshot: item.nombreProducto,
            CantidadMinimaAplicada: item.cantidadMinimaAplicada,
            CantidadMaximaAplicada: item.cantidadMaximaAplicada,
            Cantidad: item.cantidad,
            BaseCalculo: item.baseCalculo,
            TipoCalculo: item.tipoCalculo,
            ValorAplicado: item.valorAplicado,
            MontoComision: item.montoComision,
            Anulado: false,
            },
            select: { Id: true },
          });

          await tx.planillaDetalleComisionFuente.createMany({
            data: item.fuentes.map((fuente) => ({
              IdPlanillaDetalleComision: detalle.Id,
              IdDetalleVenta: fuente.idDetalleVenta,
              IdVenta: fuente.idVenta,
              IdRutaSesion: fuente.idRutaSesion,
              IdEmpleadoAtribuido: fuente.idEmpleadoAtribuido,
              FechaSesion: fuente.fechaSesion,
              SesionAnulada: fuente.sesionAnulada,
              EstadoPago: fuente.estadoPago,
              VentaAnulada: fuente.ventaAnulada,
              DetalleVentaAnulado: fuente.detalleVentaAnulado,
              EsBonificacion: fuente.esBonificacion,
              IdUsuarioChofer: fuente.idUsuarioChofer,
              IdUsuarioVendedor: fuente.idUsuarioVendedor,
              IdUsuarioAtribuido: fuente.idUsuarioAtribuido,
              RolAtribucion: fuente.rolAtribucion,
              Cantidad: fuente.cantidad,
              PrecioUnitario: fuente.precioUnitario,
              BaseCalculo: fuente.baseCalculo,
            })),
          });
        }
      }

      if (row.detalleAjustes.length > 0) {
        await tx.planillaDetalleAjuste.createMany({
          data: row.detalleAjustes.map((item) => ({
            IdPlanillaMensual: planilla.Id,
            TipoAjuste: item.tipoAjuste,
            Descripcion: item.descripcion,
            Monto: item.monto,
            Anulado: false,
          })),
        });
      }

      if (row.adelantoAplicaciones.length > 0) {
        await tx.planillaDetalleAdelanto.createMany({
          data: row.adelantoAplicaciones.map((application) => ({
            IdAdelantoEmpleado: application.idAdelantoEmpleado,
            IdPlanillaMensual: planilla.Id,
            MontoAplicado: application.montoAplicado,
            Anulado: false,
          })),
        });
      }
      if (row.faltanteIds.length > 0) {
        const linked = await tx.faltanteEmpleado.updateMany({
          where: {
            Id: { in: row.faltanteIds },
            IdPlanillaMensual: null,
            Estado: 'APROBADO',
            Anulado: false,
          },
          data: { IdPlanillaMensual: planilla.Id },
        });
        if (linked.count !== row.faltanteIds.length) {
          throw new Error('Los faltantes cambiaron durante la generación; vuelva a previsualizar.');
        }
      }

      inserted.push({
        ...row,
        id: planilla.Id,
      });
    }

    return inserted;
  });

  return {
    mes: input.mes,
    anio: input.anio,
    previewId: preview.previewId,
    planillas: created,
  };
}

export async function listPayrolls(filters: {
  mes?: number;
  anio?: number;
  anulado?: boolean;
  idEmpleado?: number;
}) {
  const data = await prisma.planillaMensual.findMany({
    where: {
      ...(filters.mes !== undefined ? { Mes: filters.mes } : {}),
      ...(filters.anio !== undefined ? { Anio: filters.anio } : {}),
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : {}),
      ...(filters.idEmpleado !== undefined ? { IdEmpleado: filters.idEmpleado } : {}),
    },
    include: {
      Empleado: {
        select: {
          Id: true,
          IdUsuarioVinculado: true,
          Entidad: {
            select: {
              Id: true,
              NombreCompleto: true,
            },
          },
        },
      },
    },
    orderBy: [{ Anio: 'desc' }, { Mes: 'desc' }, { Id: 'desc' }],
  });

  return data.map(toPlanillaDto);
}

export async function listMyPayrolls(idUsuario: number) {
  const employee = await prisma.empleado.findFirst({
    where: { IdUsuarioVinculado: idUsuario, Anulado: false },
    select: { Id: true },
  });
  if (!employee) {
    return [];
  }
  return listPayrolls({ idEmpleado: employee.Id, anulado: false });
}

export async function getMyPayrollById(idUsuario: number, idPlanilla: number) {
  const employee = await prisma.empleado.findFirst({
    where: { IdUsuarioVinculado: idUsuario, Anulado: false },
    select: { Id: true },
  });
  if (!employee) {
    throw new Error('Planilla no existe');
  }
  const payroll = await prisma.planillaMensual.findFirst({
    where: {
      Id: idPlanilla,
      IdEmpleado: employee.Id,
      Anulado: false,
    },
    select: { Id: true },
  });
  if (!payroll) {
    throw new Error('Planilla no existe');
  }
  return getPayrollById(payroll.Id);
}

export async function getPayrollById(id: number) {
  const planilla = await prisma.planillaMensual.findFirst({
    where: { Id: id },
    include: {
      Empleado: {
        select: {
          Id: true,
          IdUsuarioVinculado: true,
          Entidad: {
            select: {
              Id: true,
              NombreCompleto: true,
            },
          },
        },
      },
      PlanillaDetalleComision: {
        where: { Anulado: false },
        include: {
          InventarioItem: {
            select: {
              Id: true,
              Nombre: true,
            },
          },
          Fuentes: {
            orderBy: { Id: 'asc' },
          },
        },
        orderBy: { Id: 'asc' },
      },
      DetallesSalario: {
        orderBy: { FechaInicio: 'asc' },
      },
      PlanillaDetalleAjuste: {
        where: { Anulado: false },
        orderBy: { Id: 'asc' },
      },
    },
  });

  if (!planilla) {
    throw new Error('Planilla no existe');
  }

  return {
    ...toPlanillaDto(planilla),
    detalleSalarios: planilla.DetallesSalario.map((salary) => ({
      id: salary.Id,
      idEmpleadoSueldoVigencia: salary.IdEmpleadoSueldoVigencia,
      fechaInicio: salary.FechaInicio,
      fechaFin: salary.FechaFin,
      diasCalendario: salary.DiasCalendario,
      sueldoMensualSnapshot: Number(salary.SueldoMensualSnapshot),
      montoDevengado: Number(salary.MontoDevengado),
    })),
    detalleComisiones: planilla.PlanillaDetalleComision.map((item) => ({
      id: item.Id,
      idInventarioItem: item.IdInventarioItem,
      idConfiguracionComision: item.IdConfiguracionComision,
      idReglaComision: item.IdReglaComision,
      idReglaComisionCategoria: item.IdReglaComisionCategoria,
      idCategoriaComision: item.IdCategoriaComision,
      baseCategoriaAplicada: item.BaseCategoriaAplicada === null
        ? null
        : Number(item.BaseCategoriaAplicada),
      categoriaComisionSnapshot: item.CategoriaComisionSnapshot,
      cantidadMinimaAplicada: item.CantidadMinimaAplicada,
      cantidadMaximaAplicada: item.CantidadMaximaAplicada,
      nombreProducto: item.NombreProductoSnapshot ?? item.InventarioItem.Nombre,
      cantidad: item.Cantidad,
      baseCalculo: Number(item.BaseCalculo),
      tipoCalculo: item.TipoCalculo,
      valorAplicado: Number(item.ValorAplicado),
      montoComision: Number(item.MontoComision),
      fuentes: item.Fuentes.map((fuente) => ({
        idDetalleVenta: fuente.IdDetalleVenta,
        idVenta: fuente.IdVenta,
        idRutaSesion: fuente.IdRutaSesion,
        idEmpleadoAtribuido: fuente.IdEmpleadoAtribuido,
        fechaSesion: fuente.FechaSesion,
        sesionAnulada: fuente.SesionAnulada,
        estadoPago: fuente.EstadoPago,
        ventaAnulada: fuente.VentaAnulada,
        detalleVentaAnulado: fuente.DetalleVentaAnulado,
        esBonificacion: fuente.EsBonificacion,
        idUsuarioChofer: fuente.IdUsuarioChofer,
        idUsuarioVendedor: fuente.IdUsuarioVendedor,
        idUsuarioAtribuido: fuente.IdUsuarioAtribuido,
        rolAtribucion: fuente.RolAtribucion,
        cantidad: fuente.Cantidad,
        precioUnitario: Number(fuente.PrecioUnitario),
        baseCalculo: Number(fuente.BaseCalculo),
      })),
    })),
    detalleAjustes: planilla.PlanillaDetalleAjuste.map((item) => ({
      id: item.Id,
      tipoAjuste: item.TipoAjuste,
      descripcion: item.Descripcion,
      monto: Number(item.Monto),
    })),
  };
}

function assertEditablePayrollState(estado: string, anulado: boolean) {
  if (anulado) {
    throw new Error('Planilla anulada no se puede editar');
  }

  if (normalizeEstado(estado) !== 'BORRADOR') {
    throw new Error('Planilla cerrada es inmutable');
  }
}

export async function updatePayroll(id: number, input: UpdatePayrollInput) {
  if (input.ajustes !== undefined) {
    validateAjustes(input.ajustes);
  }
  await validateUsuarioExists(input.idUsuarioModificador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id },
    select: {
      Id: true,
      Estado: true,
      Anulado: true,
      SueldoBase: true,
      TotalComisiones: true,
      TotalBonosMetas: true,
      TotalViaticos: true,
      TotalDescuentos: true,
    },
  });

  if (!existing) {
    throw new Error('Planilla no existe');
  }

  assertEditablePayrollState(existing.Estado, existing.Anulado);

  const ajustes = input.ajustes;
  const totalBonosMetas = ajustes === undefined
    ? Number(existing.TotalBonosMetas)
    : toMoney(ajustes
      .filter((item) => item.tipoAjuste === 'BONO_META')
      .reduce((total, item) => total + item.monto, 0));
  const totalViaticos = Number(existing.TotalViaticos);
  const totalDescuentos = Number(existing.TotalDescuentos);
  const sueldoLiquido = toMoney(
    Number(existing.SueldoBase) + Number(existing.TotalComisiones) +
    totalBonosMetas - totalDescuentos,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const planilla = await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        ...(ajustes !== undefined ? {
          TotalBonosMetas: totalBonosMetas,
          TotalViaticos: totalViaticos,
          TotalDescuentos: totalDescuentos,
          SueldoLiquido: sueldoLiquido,
        } : {}),
        Observaciones: input.observaciones,
        IdUsuarioModificador: input.idUsuarioModificador,
        FechaModificacion: new Date(),
      },
      include: {
        Empleado: {
          select: {
            Id: true,
            IdUsuarioVinculado: true,
            Entidad: {
              select: {
                Id: true,
                NombreCompleto: true,
              },
            },
          },
        },
      },
    });

    if (ajustes !== undefined) {
      await tx.planillaDetalleAjuste.updateMany({
        where: { IdPlanillaMensual: id, Anulado: false, TipoAjuste: 'BONO_META' },
        // Preserve advance and shortage snapshots; only manual bonus rows are editable.
        data: {
          Anulado: true,
          IdUsuarioAnulador: input.idUsuarioModificador,
          FechaAnulacion: new Date(),
        },
      });
    }

    if (ajustes && ajustes.length > 0) {
      await tx.planillaDetalleAjuste.createMany({
        data: ajustes.map((item) => ({
          IdPlanillaMensual: id,
          TipoAjuste: item.tipoAjuste,
          Descripcion: item.descripcion,
          Monto: item.monto,
          Anulado: false,
        })),
      });
    }

    return planilla;
  });

  return toPlanillaDto(updated);
}

export async function closePayroll(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Estado: true },
  });

  if (!existing) {
    throw new Error('Planilla no existe');
  }

  if (normalizeEstado(existing.Estado) === 'CERRADA') {
    return getPayrollById(id);
  }

  await prisma.$transaction(async (tx) => {
    await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        Estado: 'CERRADA',
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
    });
    await tx.planillaEvento.create({
      data: {
        IdPlanillaMensual: id,
        IdUsuario: idUsuarioModificador,
        Accion: 'CERRAR',
      },
    });
  });

  return getPayrollById(id);
}

export async function reopenPayroll(
  id: number,
  idUsuarioModificador: number,
  motivo: string,
) {
  await validateUsuarioExists(idUsuarioModificador);
  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Estado: true },
  });
  if (!existing) {
    throw new Error('Planilla no existe');
  }
  if (normalizeEstado(existing.Estado) !== 'CERRADA') {
    throw new Error('Solo se puede reabrir una planilla cerrada.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        Estado: 'BORRADOR',
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
    });
    await tx.planillaEvento.create({
      data: {
        IdPlanillaMensual: id,
        IdUsuario: idUsuarioModificador,
        Accion: 'REABRIR',
        Motivo: motivo,
      },
    });
  });
  return getPayrollById(id);
}

export async function deletePayroll(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true, Estado: true },
  });

  if (!existing) {
    throw new Error('Planilla no existe');
  }

  if (normalizeEstado(existing.Estado) !== 'BORRADOR') {
    throw new Error('No se puede anular una planilla cerrada; reábrala primero.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.planillaDetalleAdelanto.updateMany({
      where: { IdPlanillaMensual: id, Anulado: false },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });
    await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });
    await tx.planillaEvento.create({
      data: {
        IdPlanillaMensual: id,
        IdUsuario: idUsuarioAnulador,
        Accion: 'ANULAR',
      },
    });
  });
}

export async function restorePayroll(id: number, idUsuarioModificador: number) {
  await validateUsuarioExists(idUsuarioModificador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id, Anulado: true },
    select: {
      Id: true,
      IdEmpleado: true,
      Mes: true,
      Anio: true,
    },
  });

  if (!existing) {
    throw new Error('Planilla anulada no existe');
  }

  const duplicate = await prisma.planillaMensual.findFirst({
    where: {
      IdEmpleado: existing.IdEmpleado,
      Mes: existing.Mes,
      Anio: existing.Anio,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (duplicate) {
    throw new Error('Ya existe una planilla activa para el mismo empleado y período');
  }

  await prisma.$transaction(async (tx) => {
    const advanceApplications = await tx.planillaDetalleAdelanto.findMany({
      where: { IdPlanillaMensual: id, Anulado: true },
      include: { AdelantoEmpleado: { select: { Monto: true } } },
    });
    for (const application of advanceApplications) {
      const activeApplications = await tx.planillaDetalleAdelanto.aggregate({
        where: {
          IdAdelantoEmpleado: application.IdAdelantoEmpleado,
          Anulado: false,
          IdPlanillaMensual: { not: id },
        },
        _sum: { MontoAplicado: true },
      });
      const alreadyApplied = Number(activeApplications._sum.MontoAplicado ?? 0);
      const targetAmount = Number(application.MontoAplicado);
      if (alreadyApplied + targetAmount > Number(application.AdelantoEmpleado.Monto)) {
        throw new Error('No se puede restaurar la planilla porque el saldo del adelanto ya se aplicó a otra planilla');
      }
    }
    await tx.planillaDetalleAdelanto.updateMany({
      where: { IdPlanillaMensual: id, Anulado: true },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
      },
    });
    await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
      },
    });
    await tx.planillaEvento.create({
      data: {
        IdPlanillaMensual: id,
        IdUsuario: idUsuarioModificador,
        Accion: 'RESTAURAR',
      },
    });
  });

  return getPayrollById(id);
}
