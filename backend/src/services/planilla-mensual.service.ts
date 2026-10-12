import { createHash } from 'node:crypto';
import { prisma } from '../config/prisma';

type AjusteTipo = 'BONO_META' | 'VIATICO' | 'DESCUENTO';
type EstadoPlanilla = 'BORRADOR' | 'CERRADA';
type TipoCalculoRegla = 'PORCENTAJE_VENTA' | 'MONTO_POR_UNIDAD';

type AjusteInput = {
  tipoAjuste: AjusteTipo;
  descripcion: string;
  monto: number;
};

type GeneratePayrollInput = {
  mes: number;
  anio: number;
  idUsuarioGenerador: number;
  previewId: string;
  idEmpleado?: number;
  observaciones?: string;
  ajustes?: AjusteInput[];
};

type PreviewPayrollInput = {
  mes: number;
  anio: number;
  idEmpleado?: number;
  ajustes?: AjusteInput[];
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
  idReglaComision: number;
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
  idUsuarioVinculado: number;
  sueldoBase: number;
  totalComisiones: number;
  totalBonosMetas: number;
  totalViaticos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  detalleComisiones: CalculatedCommissionRow[];
  detalleAjustes: AjusteInput[];
};

type PayrollValidation = {
  idEmpleado: number;
  nombreEmpleado: string;
  codigo: 'USUARIO_VINCULADO_FALTANTE' | 'CONFIGURACION_FALTANTE' |
    'CONFIGURACION_NO_DISPONIBLE' | 'REGLAS_NO_CONFIGURADAS' |
    'REGLA_FALTANTE' | 'REGLAS_SOLAPADAS' | 'DATOS_CALCULO_INVALIDOS' |
    'PLANILLA_EXISTENTE';
  mensaje: string;
  idInventarioItem?: number;
  nombreProducto?: string;
};

async function calculateEmployeePayroll(
  employee: {
    Id: number;
    IdUsuarioVinculado: number | null;
    IdConfiguracionComision: number | null;
    SueldoBase: unknown;
    Entidad: { NombreCompleto: string };
  },
  range: { start: Date; end: Date },
  ajustes: AjusteInput[],
): Promise<{ planilla?: EmployeeComputation; validaciones: PayrollValidation[] }> {
  const validaciones: PayrollValidation[] = [];
  const idUsuarioVinculado = employee.IdUsuarioVinculado;
  if (!idUsuarioVinculado) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'USUARIO_VINCULADO_FALTANTE',
        mensaje: 'Vincule una cuenta de usuario al empleado antes de calcular.',
      }],
    };
  }

  if (!employee.IdConfiguracionComision) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'CONFIGURACION_FALTANTE',
        mensaje: 'Asigne una configuración de comisión antes de calcular.',
      }],
    };
  }

  const configuracion = await prisma.configuracionComision.findFirst({
    where: { Id: employee.IdConfiguracionComision, Anulado: false },
    select: { Id: true },
  });

  if (!configuracion) {
    return {
      validaciones: [{
        idEmpleado: employee.Id,
        nombreEmpleado: employee.Entidad.NombreCompleto,
        codigo: 'CONFIGURACION_NO_DISPONIBLE',
        mensaje: 'La configuración asignada no existe o está anulada.',
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

  const detalles = await prisma.detalleVenta.findMany({
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
            { IdUsuarioChofer: idUsuarioVinculado },
            { IdUsuarioVendedor: idUsuarioVinculado },
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
        },
      },
    },
  });

  const grouped = new Map<
    number,
    {
      nombre: string;
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
      idUsuarioAtribuido: idUsuarioVinculado,
      rolAtribucion,
      cantidad: detalle.Cantidad,
      precioUnitario,
      baseCalculo: toMoney(subtotal),
    };
    const actual = grouped.get(detalle.IdInventarioItem);
    if (!actual) {
      grouped.set(detalle.IdInventarioItem, {
        nombre: detalle.InventarioItem.Nombre,
        cantidad: detalle.Cantidad,
        baseCalculo: subtotal,
        fuentes: [fuente],
      });
      continue;
    }

    actual.cantidad += detalle.Cantidad;
    actual.baseCalculo += subtotal;
    actual.fuentes.push(fuente);
  }

  const reglas = await prisma.reglaComision.findMany({
    where: {
      IdConfiguracionComision: configuracion.Id,
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

  if (reglas.length === 0) {
    validaciones.push({
      idEmpleado: employee.Id,
      nombreEmpleado: employee.Entidad.NombreCompleto,
      codigo: 'REGLAS_NO_CONFIGURADAS',
      mensaje: 'La configuración no contiene reglas activas.',
    });
  }

  for (const [idInventarioItem, item] of grouped.entries()) {
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

  if (validaciones.length > 0) {
    return { validaciones };
  }

  const detalleComisiones: CalculatedCommissionRow[] = [];
  let totalComisiones = 0;

  for (const [idInventarioItem, item] of grouped.entries()) {
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

  const totalBonosMetas = toMoney(
    ajustes
      .filter((item) => item.tipoAjuste === 'BONO_META')
      .reduce((acc, item) => acc + item.monto, 0),
  );
  const totalViaticos = toMoney(
    ajustes
      .filter((item) => item.tipoAjuste === 'VIATICO')
      .reduce((acc, item) => acc + item.monto, 0),
  );
  const totalDescuentos = toMoney(
    ajustes
      .filter((item) => item.tipoAjuste === 'DESCUENTO')
      .reduce((acc, item) => acc + item.monto, 0),
  );

  const sueldoLiquido = toMoney(
    sueldoBase + totalComisiones + totalBonosMetas + totalViaticos - totalDescuentos,
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
      totalComisiones: toMoney(totalComisiones),
      totalBonosMetas,
      totalViaticos,
      totalDescuentos,
      sueldoLiquido,
      detalleComisiones,
      detalleAjustes: ajustes,
    },
    validaciones,
  };
}

export async function previewPayroll(input: PreviewPayrollInput) {
  validatePeriod(input.mes, input.anio);
  validateAjustes(input.ajustes);

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

  const range = {
    start: startOfMonthUtc(input.mes, input.anio),
    end: endOfMonthUtc(input.mes, input.anio),
  };

  const calculated = await Promise.all(
    empleados.map((empleado) => calculateEmployeePayroll(empleado, range, input.ajustes ?? [])),
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
      ajustes: input.ajustes ?? [],
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
  validateAjustes(input.ajustes);
  await validateUsuarioExists(input.idUsuarioGenerador);

  const preview = await previewPayroll({
    mes: input.mes,
    anio: input.anio,
    idEmpleado: input.idEmpleado,
    ajustes: input.ajustes,
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
          Observaciones: input.observaciones,
          Anulado: false,
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
      cantidadMinimaAplicada: item.CantidadMinimaAplicada,
      cantidadMaximaAplicada: item.CantidadMaximaAplicada,
      nombreProducto: item.InventarioItem.Nombre,
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
  const totalViaticos = ajustes === undefined
    ? Number(existing.TotalViaticos)
    : toMoney(ajustes
      .filter((item) => item.tipoAjuste === 'VIATICO')
      .reduce((total, item) => total + item.monto, 0));
  const totalDescuentos = ajustes === undefined
    ? Number(existing.TotalDescuentos)
    : toMoney(ajustes
      .filter((item) => item.tipoAjuste === 'DESCUENTO')
      .reduce((total, item) => total + item.monto, 0));
  const sueldoLiquido = toMoney(
    Number(existing.SueldoBase) + Number(existing.TotalComisiones) +
    totalBonosMetas + totalViaticos - totalDescuentos,
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
        where: { IdPlanillaMensual: id, Anulado: false },
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

  await prisma.planillaMensual.update({
    where: { Id: id },
    data: {
      Estado: 'CERRADA',
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
    },
  });

  return getPayrollById(id);
}

export async function deletePayroll(id: number, idUsuarioAnulador: number) {
  await validateUsuarioExists(idUsuarioAnulador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Planilla no existe');
  }

  await prisma.planillaMensual.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
      Estado: 'BORRADOR',
    },
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

  await prisma.planillaMensual.update({
    where: { Id: id },
    data: {
      Anulado: false,
      Estado: 'BORRADOR',
      IdUsuarioModificador: idUsuarioModificador,
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
  });

  return getPayrollById(id);
}
