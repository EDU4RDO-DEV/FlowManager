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
  idInventarioItem: number;
  nombreProducto: string;
  cantidad: number;
  baseCalculo: number;
  tipoCalculo: TipoCalculoRegla;
  valorAplicado: number;
  montoComision: number;
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

async function getReglaAplicable(
  idConfiguracionComision: number,
  idInventarioItem: number,
  cantidadTotal: number,
) {
  const reglas = await prisma.reglaComision.findMany({
    where: {
      IdConfiguracionComision: idConfiguracionComision,
      IdInventarioItem: idInventarioItem,
      Anulado: false,
    },
    orderBy: [{ CantidadMinima: 'desc' }, { Id: 'desc' }],
  });

  const regla = reglas.find((item) => {
    const max = item.CantidadMaxima ?? Number.POSITIVE_INFINITY;
    return cantidadTotal >= item.CantidadMinima && cantidadTotal <= max;
  });

  if (!regla) {
    return null;
  }

  const tipo = normalizeEstado(regla.TipoCalculo) as TipoCalculoRegla;

  return {
    tipoCalculo: tipo,
    porcentaje: Number(regla.Porcentaje),
    montoPorUnidad: regla.MontoPorUnidad === null ? null : Number(regla.MontoPorUnidad),
  };
}

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
): Promise<EmployeeComputation> {
  const idUsuarioVinculado = employee.IdUsuarioVinculado;
  if (!idUsuarioVinculado) {
    throw new Error(`Empleado ${employee.Id} no tiene usuario vinculado`);
  }

  if (!employee.IdConfiguracionComision) {
    throw new Error(`Empleado ${employee.Id} no tiene configuración de comisión`);
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
      IdInventarioItem: true,
      Cantidad: true,
      PrecioUnitario: true,
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
    }
  >();

  for (const detalle of detalles) {
    const actual = grouped.get(detalle.IdInventarioItem);
    const subtotal = Number(detalle.PrecioUnitario) * detalle.Cantidad;
    if (!actual) {
      grouped.set(detalle.IdInventarioItem, {
        nombre: detalle.InventarioItem.Nombre,
        cantidad: detalle.Cantidad,
        baseCalculo: subtotal,
      });
      continue;
    }

    actual.cantidad += detalle.Cantidad;
    actual.baseCalculo += subtotal;
  }

  const detalleComisiones: CalculatedCommissionRow[] = [];
  let totalComisiones = 0;

  for (const [idInventarioItem, item] of grouped.entries()) {
    const regla = await getReglaAplicable(
      employee.IdConfiguracionComision,
      idInventarioItem,
      item.cantidad,
    );

    if (!regla) {
      continue;
    }

    let montoComision = 0;
    let valorAplicado = 0;

    if (regla.tipoCalculo === 'MONTO_POR_UNIDAD') {
      const montoUnidad = regla.montoPorUnidad ?? 0;
      valorAplicado = montoUnidad;
      montoComision = item.cantidad * montoUnidad;
    } else {
      valorAplicado = regla.porcentaje;
      montoComision = item.baseCalculo * (regla.porcentaje / 100);
    }

    const montoComisionRounded = toMoney(montoComision);
    totalComisiones += montoComisionRounded;

    detalleComisiones.push({
      idInventarioItem,
      nombreProducto: item.nombre,
      cantidad: toMoney(item.cantidad),
      baseCalculo: toMoney(item.baseCalculo),
      tipoCalculo: regla.tipoCalculo,
      valorAplicado: toMoney(valorAplicado),
      montoComision: montoComisionRounded,
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

  const sueldoBase = Number(employee.SueldoBase);
  const sueldoLiquido = toMoney(
    sueldoBase + totalComisiones + totalBonosMetas + totalViaticos - totalDescuentos,
  );

  return {
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

  const computed = await Promise.all(
    empleados.map((empleado) => calculateEmployeePayroll(empleado, range, input.ajustes ?? [])),
  );

  return {
    mes: input.mes,
    anio: input.anio,
    planillas: computed,
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
        await tx.planillaDetalleComision.createMany({
          data: row.detalleComisiones.map((item) => ({
            IdPlanillaMensual: planilla.Id,
            IdInventarioItem: item.idInventarioItem,
            Cantidad: item.cantidad,
            BaseCalculo: item.baseCalculo,
            TipoCalculo: item.tipoCalculo,
            ValorAplicado: item.valorAplicado,
            MontoComision: item.montoComision,
            Anulado: false,
          })),
        });
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
      nombreProducto: item.InventarioItem.Nombre,
      cantidad: item.Cantidad,
      baseCalculo: Number(item.BaseCalculo),
      tipoCalculo: item.TipoCalculo,
      valorAplicado: Number(item.ValorAplicado),
      montoComision: Number(item.MontoComision),
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
  validateAjustes(input.ajustes);
  await validateUsuarioExists(input.idUsuarioModificador);

  const existing = await prisma.planillaMensual.findFirst({
    where: { Id: id },
    select: {
      Id: true,
      IdEmpleado: true,
      Mes: true,
      Anio: true,
      Estado: true,
      Anulado: true,
    },
  });

  if (!existing) {
    throw new Error('Planilla no existe');
  }

  assertEditablePayrollState(existing.Estado, existing.Anulado);

  const preview = await previewPayroll({
    mes: existing.Mes,
    anio: existing.Anio,
    idEmpleado: existing.IdEmpleado,
    ajustes: input.ajustes,
  });

  const recomputed = preview.planillas[0];

  const updated = await prisma.$transaction(async (tx) => {
    const planilla = await tx.planillaMensual.update({
      where: { Id: id },
      data: {
        SueldoBase: recomputed.sueldoBase,
        TotalComisiones: recomputed.totalComisiones,
        TotalBonosMetas: recomputed.totalBonosMetas,
        TotalViaticos: recomputed.totalViaticos,
        TotalDescuentos: recomputed.totalDescuentos,
        SueldoLiquido: recomputed.sueldoLiquido,
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

    await tx.planillaDetalleComision.updateMany({
      where: { IdPlanillaMensual: id, Anulado: false },
      data: {
        Anulado: true,
        IdUsuarioAnulador: input.idUsuarioModificador,
        FechaAnulacion: new Date(),
      },
    });

    await tx.planillaDetalleAjuste.updateMany({
      where: { IdPlanillaMensual: id, Anulado: false },
      data: {
        Anulado: true,
        IdUsuarioAnulador: input.idUsuarioModificador,
        FechaAnulacion: new Date(),
      },
    });

    if (recomputed.detalleComisiones.length > 0) {
      await tx.planillaDetalleComision.createMany({
        data: recomputed.detalleComisiones.map((item) => ({
          IdPlanillaMensual: id,
          IdInventarioItem: item.idInventarioItem,
          Cantidad: item.cantidad,
          BaseCalculo: item.baseCalculo,
          TipoCalculo: item.tipoCalculo,
          ValorAplicado: item.valorAplicado,
          MontoComision: item.montoComision,
          Anulado: false,
        })),
      });
    }

    if (recomputed.detalleAjustes.length > 0) {
      await tx.planillaDetalleAjuste.createMany({
        data: recomputed.detalleAjustes.map((item) => ({
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
