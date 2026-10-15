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

const PAID_STATES = ['PAGADO', 'PAGADA'];

function normalizeEstado(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
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
  baseCategoriaAplicada?: number;
  categoriaComisionSnapshot?: string;
  idConfiguracionComision: number;
  cantidadMinimaAplicada: number;
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
    idRutaSesion: number;
    fechaSesion: Date;
    sesionAnulada: boolean;
    estadoPago: string;
    ventaAnulada: boolean;
    detalleVentaAnulado: boolean;
    esBonificacion: boolean;
    idUsuarioChofer: number;
    idUsuarioVendedor: number;
    idUsuarioAtribuido: number;
    rolAtribucion: 'CHOFER' | 'VENDEDOR' | 'AMBOS';
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
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  diasTrabajados: number;
  tarifaViaticoAplicada: number | null;
  sueldoLiquido: number;
  detalleComisiones: CalculatedCommissionRow[];
  detalleAjustes: AdjustmentDetailInput[];
  adelantoIds: number[];
  faltanteIds: number[];
};

type PayrollValidation = {
  idEmpleado: number;
  nombreEmpleado: string;
  codigo: 'USUARIO_VINCULADO_FALTANTE' | 'CONFIGURACION_FALTANTE' |
    'CONFIGURACION_NO_DISPONIBLE' | 'REGLAS_NO_CONFIGURADAS' |
    'REGLA_FALTANTE' | 'REGLAS_SOLAPADAS' | 'DATOS_CALCULO_INVALIDOS' |
    'PLANILLA_EXISTENTE' | 'TIPO_TRABAJADOR_FALTANTE' |
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
  if (!isPlantWorker && !idUsuarioVinculado) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'USUARIO_VINCULADO_FALTANTE',
        mensaje: 'Vincule una cuenta de usuario al empleado antes de calcular.',
      }],
    };
  }

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

  const sueldoBase = Number(employee.SueldoBase);
  if (!Number.isFinite(sueldoBase) || sueldoBase < 0) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'DATOS_CALCULO_INVALIDOS',
        mensaje: 'El sueldo base debe ser un importe finito y no negativo.',
      }],
    };
  }

  const detalles = isPlantWorker ? [] : await prisma.detalleVenta.findMany({
    where: {
      Anulado: false,
      EsBonificacion: false,
      Venta: {
        Anulado: false,
        EstadoPago: {
          in: PAID_STATES,
        },
        RutaSesion: {
          Anulado: false,
          FechaSesion: {
            gte: range.start,
            lte: range.end,
          },
          OR: [
            { IdUsuarioChofer: idUsuarioVinculado ?? 0 },
            { IdUsuarioVendedor: idUsuarioVinculado ?? 0 },
          ],
        },
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
    if (!sesion) {
      continue;
    }

    const esChofer = sesion.IdUsuarioChofer === idUsuarioVinculado;
    const esVendedor = sesion.IdUsuarioVendedor === idUsuarioVinculado;
    const rolAtribucion = esChofer && esVendedor
      ? 'AMBOS'
      : esChofer
        ? 'CHOFER'
        : 'VENDEDOR';
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
      idRutaSesion: sesion.Id,
      fechaSesion: sesion.FechaSesion,
      sesionAnulada: sesion.Anulado,
      estadoPago: detalle.Venta.EstadoPago,
      ventaAnulada: detalle.Venta.Anulado,
      detalleVentaAnulado: detalle.Anulado,
      esBonificacion: detalle.EsBonificacion,
      idUsuarioChofer: sesion.IdUsuarioChofer,
      idUsuarioVendedor: sesion.IdUsuarioVendedor,
      idUsuarioAtribuido: idUsuarioVinculado ?? 0,
      rolAtribucion,
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
        Fecha: { gte: range.start, lte: range.end },
      },
      select: { Id: true, Monto: true, Fecha: true, Observacion: true },
      orderBy: { Id: 'asc' },
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
  const totalDescuentos = toMoney(
    adelantos.reduce((sum, item) => sum + Number(item.Monto), 0) +
    faltantes.reduce((sum, item) => sum + Number(item.Monto), 0),
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
        ...adelantos.map((item) => ({
          tipoAjuste: 'ADELANTO' as const,
          descripcion: `Adelanto #${item.Id}${item.Observacion ? ` - ${item.Observacion}` : ''}`,
          monto: Number(item.Monto),
        })),
        ...faltantes.map((item) => ({
          tipoAjuste: 'FALTANTE' as const,
          descripcion: `Faltante aprobado #${item.Id}${item.Observacion ? ` - ${item.Observacion}` : ''}`,
          monto: Number(item.Monto),
        })),
      ],
      adelantoIds: adelantos.map((item) => item.Id),
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
      IdTipoTrabajador: true,
      TipoTrabajador: {
        select: { Clave: true },
      },
      HistorialSueldos: {
        where: {
          FechaInicioVigencia: { lte: range.end },
          OR: [
            { FechaFinVigencia: null },
            { FechaFinVigencia: { gte: range.end } },
          ],
        },
        orderBy: { FechaInicioVigencia: 'desc' },
        take: 1,
        select: { SueldoBase: true },
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
      {
        ...empleado,
        SueldoBase: empleado.HistorialSueldos[0]?.SueldoBase ?? empleado.SueldoBase,
      },
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

      if (row.adelantoIds.length > 0) {
        const linked = await tx.adelantoEmpleado.updateMany({
          where: {
            Id: { in: row.adelantoIds },
            IdPlanillaMensual: null,
            Anulado: false,
          },
          data: { IdPlanillaMensual: planilla.Id },
        });
        if (linked.count !== row.adelantoIds.length) {
          throw new Error('Los adelantos cambiaron durante la generación; vuelva a previsualizar.');
        }
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
