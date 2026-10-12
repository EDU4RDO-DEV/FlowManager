import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findFirst: vi.fn(),
    },
    configuracionComision: {
      findFirst: vi.fn(),
    },
    empleado: {
      findMany: vi.fn(),
    },
    detalleVenta: {
      findMany: vi.fn(),
    },
    reglaComision: {
      findMany: vi.fn(),
    },
    planillaMensual: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import {
  closePayroll,
  generatePayroll,
  previewPayroll,
  updatePayroll,
} from '../services/planilla-mensual.service';

describe('planilla-mensual.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula comisión sobre ventas pagadas y volumen mensual completo', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdUsuarioVinculado: 10,
        IdConfiguracionComision: 3,
        SueldoBase: 2000,
        Entidad: { NombreCompleto: 'Repartidor A' },
      },
    ]);

    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 101,
        IdVenta: 900,
        IdInventarioItem: 5,
        Cantidad: 120,
        PrecioUnitario: 10,
        Venta: {
          RutaSesion: {
            Id: 700,
            FechaSesion: new Date('2026-08-12T00:00:00.000Z'),
            IdUsuarioChofer: 10,
            IdUsuarioVendedor: 11,
          },
        },
        InventarioItem: { Nombre: 'Garrafón 18L' },
      },
      {
        Id: 102,
        IdVenta: 901,
        IdInventarioItem: 5,
        Cantidad: 80,
        PrecioUnitario: 10,
        Venta: {
          RutaSesion: {
            Id: 701,
            FechaSesion: new Date('2026-08-13T00:00:00.000Z'),
            IdUsuarioChofer: 11,
            IdUsuarioVendedor: 10,
          },
        },
        InventarioItem: { Nombre: 'Garrafón 18L' },
      },
      {
        Id: 101,
        IdVenta: 900,
        IdInventarioItem: 5,
        Cantidad: 120,
        PrecioUnitario: 10,
        Venta: {
          RutaSesion: {
            Id: 700,
            FechaSesion: new Date('2026-08-12T00:00:00.000Z'),
            IdUsuarioChofer: 10,
            IdUsuarioVendedor: 11,
          },
        },
        InventarioItem: { Nombre: 'Garrafón 18L' },
      },
    ]);

    prismaMock.reglaComision.findMany.mockResolvedValueOnce([
      {
        Id: 11,
        IdConfiguracionComision: 3,
        IdInventarioItem: 5,
        CantidadMinima: 150,
        CantidadMaxima: 500,
        TipoCalculo: 'PORCENTAJE_VENTA',
        Porcentaje: 4,
        MontoPorUnidad: null,
      },
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({
      mes: 8,
      anio: 2026,
      ajustes: [
        { tipoAjuste: 'BONO_META', descripcion: 'Meta mensual', monto: 200 },
        { tipoAjuste: 'VIATICO', descripcion: 'Alimentación', monto: 150 },
        { tipoAjuste: 'DESCUENTO', descripcion: 'Faltante', monto: 50 },
      ],
    });

    expect(result.planillas).toHaveLength(1);
    expect(result.planillas[0].totalComisiones).toBe(80);
    expect(result.planillas[0].sueldoLiquido).toBe(2380);
    expect(result.validaciones).toEqual([]);
    expect(result.planillas[0].detalleComisiones[0]).toMatchObject({
      idReglaComision: 11,
      idConfiguracionComision: 3,
      fuentes: [
        { idDetalleVenta: 101, rolAtribucion: 'CHOFER' },
        { idDetalleVenta: 102, rolAtribucion: 'VENDEDOR' },
      ],
    });
    expect(result.previewId).toHaveLength(64);
  });

  it('calcula una regla porcentual y otra por unidad sin duplicar detalles fuente', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdUsuarioVinculado: 10,
        IdConfiguracionComision: 3,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Repartidor A' },
      },
    ]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 2,
        PrecioUnitario: 50,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 10 } },
        InventarioItem: { Nombre: 'Producto A' },
      },
      {
        Id: 2,
        IdVenta: 101,
        IdInventarioItem: 6,
        Cantidad: 3,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 2, FechaSesion: new Date('2026-08-02T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto B' },
      },
    ]);
    prismaMock.reglaComision.findMany.mockResolvedValueOnce([
      {
        Id: 11,
        IdConfiguracionComision: 3,
        IdInventarioItem: 5,
        CantidadMinima: 1,
        CantidadMaxima: null,
        TipoCalculo: 'PORCENTAJE_VENTA',
        Porcentaje: 10,
        MontoPorUnidad: null,
      },
      {
        Id: 12,
        IdConfiguracionComision: 3,
        IdInventarioItem: 6,
        CantidadMinima: 1,
        CantidadMaxima: null,
        TipoCalculo: 'MONTO_POR_UNIDAD',
        Porcentaje: 0,
        MontoPorUnidad: 4,
      },
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({ mes: 8, anio: 2026 });

    expect(result.planillas[0].totalComisiones).toBe(22);
    expect(result.planillas[0].detalleComisiones).toHaveLength(2);
    expect(result.planillas[0].detalleComisiones[0].fuentes[0].rolAtribucion).toBe('AMBOS');
    expect(result.validaciones).toEqual([]);
  });

  it('devuelve validaciones individualizadas cuando faltan vínculo o configuración', async () => {
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdUsuarioVinculado: null,
        IdConfiguracionComision: 3,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Empleado sin vínculo' },
      },
      {
        Id: 2,
        IdUsuarioVinculado: 12,
        IdConfiguracionComision: null,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Empleado sin configuración' },
      },
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({ mes: 8, anio: 2026 });

    expect(result.planillas).toEqual([]);
    expect(result.validaciones.map(({ idEmpleado, codigo }) => ({ idEmpleado, codigo }))).toEqual([
      { idEmpleado: 1, codigo: 'USUARIO_VINCULADO_FALTANTE' },
      { idEmpleado: 2, codigo: 'CONFIGURACION_FALTANTE' },
    ]);
    expect(prismaMock.detalleVenta.findMany).not.toHaveBeenCalled();
  });

  it('bloquea el cálculo cuando dos reglas aplicables se solapan', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdUsuarioVinculado: 10,
        IdConfiguracionComision: 3,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Repartidor A' },
      },
    ]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 10,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto A' },
      },
    ]);
    prismaMock.reglaComision.findMany.mockResolvedValueOnce([
      {
        Id: 11,
        IdConfiguracionComision: 3,
        IdInventarioItem: 5,
        CantidadMinima: 1,
        CantidadMaxima: 10,
        TipoCalculo: 'PORCENTAJE_VENTA',
        Porcentaje: 5,
        MontoPorUnidad: null,
      },
      {
        Id: 12,
        IdConfiguracionComision: 3,
        IdInventarioItem: 5,
        CantidadMinima: 10,
        CantidadMaxima: null,
        TipoCalculo: 'MONTO_POR_UNIDAD',
        Porcentaje: 0,
        MontoPorUnidad: 2,
      },
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({ mes: 8, anio: 2026 });

    expect(result.planillas).toEqual([]);
    expect(result.validaciones).toMatchObject([
      { codigo: 'REGLAS_SOLAPADAS', idInventarioItem: 5 },
    ]);
  });

  it('señala expresamente productos sin regla activa en vez de generar comisión cero', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdUsuarioVinculado: 10,
        IdConfiguracionComision: 3,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Repartidor A' },
      },
    ]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 10,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto sin regla' },
      },
    ]);
    prismaMock.reglaComision.findMany.mockResolvedValueOnce([]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({ mes: 8, anio: 2026 });

    expect(result.planillas).toEqual([]);
    expect(result.validaciones.map(({ codigo }) => codigo)).toEqual([
      'REGLAS_NO_CONFIGURADAS',
      'REGLA_FALTANTE',
    ]);
  });

  it('vincula el borrador a la previsualización y persiste regla y fuentes de comisión', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 9 });
    prismaMock.configuracionComision.findFirst.mockResolvedValue({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValue([
      {
        Id: 1,
        IdUsuarioVinculado: 10,
        IdConfiguracionComision: 3,
        SueldoBase: 1000,
        Entidad: { NombreCompleto: 'Repartidor A' },
      },
    ]);
    prismaMock.detalleVenta.findMany.mockResolvedValue([
      {
        Id: 101,
        IdVenta: 900,
        IdInventarioItem: 5,
        Anulado: false,
        EsBonificacion: false,
        Cantidad: 2,
        PrecioUnitario: 10,
        Venta: {
          EstadoPago: 'PAGADO',
          Anulado: false,
          RutaSesion: {
            Id: 700,
            FechaSesion: new Date('2026-08-12T00:00:00.000Z'),
            Anulado: false,
            IdUsuarioChofer: 10,
            IdUsuarioVendedor: 11,
          },
        },
        InventarioItem: { Nombre: 'Producto A' },
      },
    ]);
    prismaMock.reglaComision.findMany.mockResolvedValue([
      {
        Id: 11,
        IdConfiguracionComision: 3,
        IdInventarioItem: 5,
        CantidadMinima: 1,
        CantidadMaxima: null,
        TipoCalculo: 'PORCENTAJE_VENTA',
        Porcentaje: 5,
        MontoPorUnidad: null,
      },
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValue([]);

    const preview = await previewPayroll({ mes: 8, anio: 2026 });
    await expect(generatePayroll({
      mes: 8,
      anio: 2026,
      idUsuarioGenerador: 9,
      previewId: '0'.repeat(64),
    })).rejects.toThrowError('La previsualización cambió; vuelva a previsualizar antes de generar.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    const createPayroll = vi.fn().mockResolvedValue({ Id: 501 });
    const findDuplicate = vi.fn().mockResolvedValue(null);
    const createCommission = vi.fn().mockResolvedValue({ Id: 601 });
    const createSources = vi.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      planillaMensual: { findFirst: findDuplicate, create: createPayroll },
      planillaDetalleComision: { create: createCommission },
      planillaDetalleComisionFuente: { createMany: createSources },
      planillaDetalleAjuste: { createMany: vi.fn() },
    };
    prismaMock.$transaction.mockImplementationOnce(
      (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    );

    const result = await generatePayroll({
      mes: 8,
      anio: 2026,
      idUsuarioGenerador: 9,
      previewId: preview.previewId,
    });

    expect(result.previewId).toBe(preview.previewId);
    expect(createCommission).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        IdConfiguracionComision: 3,
        IdReglaComision: 11,
        CantidadMinimaAplicada: 1,
        CantidadMaximaAplicada: null,
      }),
    }));
    expect(createSources).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        IdDetalleVenta: 101,
        IdVenta: 900,
        IdRutaSesion: 700,
        IdUsuarioAtribuido: 10,
        RolAtribucion: 'CHOFER',
        EstadoPago: 'PAGADO',
        VentaAnulada: false,
        DetalleVentaAnulado: false,
        EsBonificacion: false,
        SesionAnulada: false,
      })],
    });
  });

  it('cierra planilla en estado borrador', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce({
      Id: 21,
      Estado: 'BORRADOR',
      Anulado: false,
    });
    prismaMock.planillaMensual.update.mockResolvedValueOnce({ Id: 21 });
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce({
      Id: 21,
      IdEmpleado: 1,
      Mes: 8,
      Anio: 2026,
      Estado: 'CERRADA',
      IdUsuarioGenerador: 9,
      SueldoBase: 2000,
      TotalComisiones: 80,
      TotalBonosMetas: 0,
      TotalViaticos: 0,
      TotalDescuentos: 0,
      SueldoLiquido: 2080,
      Observaciones: null,
      FechaRegistro: null,
      IdUsuarioModificador: 9,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Empleado: {
        Id: 1,
        IdUsuarioVinculado: 10,
        Entidad: { Id: 99, NombreCompleto: 'Repartidor A' },
      },
      PlanillaDetalleComision: [],
      PlanillaDetalleAjuste: [],
    });

    const result = await closePayroll(21, 9);

    expect(prismaMock.planillaMensual.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 21 },
        data: expect.objectContaining({ Estado: 'CERRADA' }),
      }),
    );
    expect(result.estado).toBe('CERRADA');
  });

  it('rechaza edición de planilla cerrada', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce({
      Id: 50,
      IdEmpleado: 1,
      Mes: 8,
      Anio: 2026,
      Estado: 'CERRADA',
      Anulado: false,
    });

    await expect(
      updatePayroll(50, {
        idUsuarioModificador: 7,
        observaciones: 'Intento de ajuste',
      }),
    ).rejects.toThrowError('Planilla cerrada es inmutable');
  });

  it('preserva importes y ajustes al actualizar solo observaciones', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 7 });
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce({
      Id: 50,
      Estado: 'BORRADOR',
      Anulado: false,
      SueldoBase: 2000,
      TotalComisiones: 80,
      TotalBonosMetas: 100,
      TotalViaticos: 50,
      TotalDescuentos: 25,
    });
    const updatedRow = {
      Id: 50,
      IdEmpleado: 1,
      Mes: 8,
      Anio: 2026,
      Estado: 'BORRADOR',
      IdUsuarioGenerador: 7,
      SueldoBase: 2000,
      TotalComisiones: 80,
      TotalBonosMetas: 100,
      TotalViaticos: 50,
      TotalDescuentos: 25,
      SueldoLiquido: 2205,
      Observaciones: 'Ajuste administrativo',
      FechaRegistro: null,
      IdUsuarioModificador: 7,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Empleado: {
        Id: 1,
        IdUsuarioVinculado: 10,
        Entidad: { Id: 99, NombreCompleto: 'Repartidor A' },
      },
    };
    const update = vi.fn().mockResolvedValue(updatedRow);
    const updateAdjustments = vi.fn();
    const transactionClient = {
      planillaMensual: { update },
      planillaDetalleAjuste: { updateMany: updateAdjustments },
    };
    prismaMock.$transaction.mockImplementationOnce(
      (callback: (tx: typeof transactionClient) => Promise<typeof updatedRow>) => callback(transactionClient),
    );

    const result = await updatePayroll(50, {
      idUsuarioModificador: 7,
      observaciones: 'Ajuste administrativo',
    });

    expect(result.sueldoLiquido).toBe(2205);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        SueldoBase: expect.anything(),
        TotalComisiones: expect.anything(),
      }),
    }));
    expect(updateAdjustments).not.toHaveBeenCalled();
    expect(prismaMock.detalleVenta.findMany).not.toHaveBeenCalled();
  });
});
