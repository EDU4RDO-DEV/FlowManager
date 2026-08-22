import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
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
  previewPayroll,
  updatePayroll,
} from '../services/planilla-mensual.service';

describe('planilla-mensual.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula comisión sobre ventas pagadas y volumen mensual completo', async () => {
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
        IdInventarioItem: 5,
        Cantidad: 120,
        PrecioUnitario: 10,
        InventarioItem: { Nombre: 'Garrafón 18L' },
      },
      {
        IdInventarioItem: 5,
        Cantidad: 80,
        PrecioUnitario: 10,
        InventarioItem: { Nombre: 'Garrafón 18L' },
      },
    ]);

    prismaMock.reglaComision.findMany.mockResolvedValueOnce([
      {
        Id: 11,
        CantidadMinima: 150,
        CantidadMaxima: 500,
        TipoCalculo: 'PORCENTAJE_VENTA',
        Porcentaje: 4,
        MontoPorUnidad: null,
      },
    ]);

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
});
