import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, renderHtmlToPdfMock } = vi.hoisted(() => ({
  renderHtmlToPdfMock: vi.fn(),
  prismaMock: {
    usuario: {
      findFirst: vi.fn(),
    },
    configuracionComision: {
      findFirst: vi.fn(),
    },
    empleado: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    detalleVenta: {
      findMany: vi.fn(),
    },
    reglaComision: {
      findMany: vi.fn(),
    },
    reglaComisionCategoria: {
      findMany: vi.fn(),
    },
    tarifaViatico: {
      findFirst: vi.fn(),
    },
    adelantoEmpleado: {
      findMany: vi.fn(),
    },
    faltanteEmpleado: {
      findMany: vi.fn(),
    },
    planillaMensual: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    planillaEvento: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../modules/reports/export/browser', () => ({
  renderHtmlToPdf: renderHtmlToPdfMock,
}));

import {
  closePayroll,
  generatePayroll,
  getMyPayrollById,
  getPayrollById,
  previewPayroll,
  updatePayroll,
} from '../services/planilla-mensual.service';
import { createComisionConfig } from '../services/planilla-comision.service';
import { renderPayrollReceipt } from '../services/payroll-receipt.service';

function routeEmployee(
  id: number,
  idUsuarioVinculado: number | null,
  nombre: string,
  sueldoBase = 1000,
  idConfiguracionComision: number | null = 3,
) {
  return {
    Id: id,
    IdUsuarioVinculado: idUsuarioVinculado,
    IdConfiguracionComision: idConfiguracionComision,
    IdTipoTrabajador: 1,
    TipoTrabajador: { Clave: 'RUTA' },
    SueldoBase: sueldoBase,
    HistorialSueldos: [],
    Entidad: { NombreCompleto: nombre },
  };
}

describe('planilla-mensual.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.tarifaViatico.findFirst.mockResolvedValue(null);
    prismaMock.reglaComisionCategoria.findMany.mockResolvedValue([]);
    prismaMock.adelantoEmpleado.findMany.mockResolvedValue([]);
    prismaMock.faltanteEmpleado.findMany.mockResolvedValue([]);
  });

  it('inicializa las tasas convenidas para garrafones y otros', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.configuracionComision.findFirst.mockResolvedValue(null);
    const createCategoryRules = vi.fn().mockResolvedValue({ count: 14 });
    const transactionClient = {
      configuracionComision: {
        create: vi.fn().mockResolvedValue({
          Id: 3,
          IdUsuario: 9,
          Nombre: 'General',
          EsGeneral: true,
          FechaRegistro: null,
          IdUsuarioModificador: null,
          FechaModificacion: null,
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        }),
      },
      categoriaComision: {
        findMany: vi.fn().mockResolvedValue([
          { Id: 1, Clave: 'GARRAFONES' },
          { Id: 2, Clave: 'OTROS' },
        ]),
      },
      reglaComisionCategoria: { createMany: createCategoryRules },
    };
    prismaMock.$transaction.mockImplementationOnce(
      (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    );

    await createComisionConfig({
      idUsuario: 9,
      nombre: 'General',
      esGeneral: true,
      fechaInicioVigencia: '2026-01-01',
    });

    const rows = createCategoryRules.mock.calls[0][0].data as Array<{
      IdCategoriaComision: number;
      MontoMinimoVenta: number;
      Porcentaje: number;
    }>;
    const garrafones = rows.filter((row) => row.IdCategoriaComision === 1);
    const otros = rows.filter((row) => row.IdCategoriaComision === 2);
    expect(garrafones).toEqual([
      expect.objectContaining({ MontoMinimoVenta: 0, Porcentaje: 3 }),
    ]);
    expect(otros.map(({ MontoMinimoVenta, Porcentaje }) => [MontoMinimoVenta, Porcentaje])).toEqual([
      [0, 3.09],
      [30000, 3.1],
      ...Array.from({ length: 12 }, (_, index) => [35000 + index * 5000, Number((3.11 + index * 0.01).toFixed(2))]),
    ]);
  });

  it('conserva snapshots al leer nómina y excluye los viáticos del líquido del recibo', async () => {
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce({
      Id: 77,
      IdEmpleado: 5,
      Mes: 8,
      Anio: 2026,
      Estado: 'CERRADA',
      IdUsuarioGenerador: 9,
      SueldoBase: 1000,
      TotalComisiones: 100,
      TotalBonosMetas: 50,
      TotalViaticos: 120,
      TotalDescuentos: 50,
      SueldoLiquido: 1100,
      Observaciones: null,
      FechaRegistro: new Date('2026-09-01T00:00:00.000Z'),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      DiasTrabajados: 4,
      TarifaViaticoAplicada: 30,
      Empleado: {
        Id: 5,
        IdUsuarioVinculado: 10,
        Entidad: { Id: 55, NombreCompleto: 'Trabajador histórico' },
      },
      PlanillaDetalleComision: [{
        Id: 1,
        IdInventarioItem: 25,
        IdConfiguracionComision: 3,
        IdReglaComision: null,
        IdReglaComisionCategoria: 4,
        IdCategoriaComision: 2,
        BaseCategoriaAplicada: 30000,
        CategoriaComisionSnapshot: 'Otros histórico',
        NombreProductoSnapshot: 'Producto histórico',
        CantidadMinimaAplicada: 0,
        CantidadMaximaAplicada: null,
        Cantidad: 1,
        BaseCalculo: 30000,
        TipoCalculo: 'PORCENTAJE_VENTA',
        ValorAplicado: 3.1,
        MontoComision: 100,
        InventarioItem: { Id: 25, Nombre: 'Nombre de producto modificado' },
        Fuentes: [{
          IdDetalleVenta: 8,
          IdVenta: 9,
          IdRutaSesion: 10,
          FechaSesion: new Date('2026-08-10T00:00:00.000Z'),
          SesionAnulada: false,
          EstadoPago: 'PAGADO',
          VentaAnulada: false,
          DetalleVentaAnulado: false,
          EsBonificacion: false,
          IdUsuarioChofer: 10,
          IdUsuarioVendedor: 11,
          IdUsuarioAtribuido: 10,
          RolAtribucion: 'CHOFER',
          Cantidad: 1,
          PrecioUnitario: 30000,
          BaseCalculo: 30000,
        }],
      }],
      PlanillaDetalleAjuste: [{
        Id: 1,
        TipoAjuste: 'ADELANTO',
        Descripcion: 'Adelanto snapshot',
        Monto: 50,
      }],
    });
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from('PDF'));

    const payroll = await getPayrollById(77);
    const pdf = await renderPayrollReceipt(payroll);
    const html = renderHtmlToPdfMock.mock.calls[0][0] as string;

    expect(payroll.sueldoBase).toBe(1000);
    expect(payroll.detalleComisiones[0].nombreProducto).toBe('Producto histórico');
    expect(payroll.detalleComisiones[0].categoriaComisionSnapshot).toBe('Otros histórico');
    expect(payroll.detalleComisiones[0].fuentes[0].precioUnitario).toBe(30000);
    expect(payroll.detalleAjustes[0].descripcion).toBe('Adelanto snapshot');
    expect(html).toContain('Q1100.00');
    expect(html).toContain('Total de viáticos');
    expect(html).toContain('Q120.00');
    expect(html).toContain('no se incluyen en el líquido');
    expect(html).not.toContain('Q1220.00');
    expect(pdf).toEqual(Buffer.from('PDF'));
  });

  it('impide descargar un recibo perteneciente a otro empleado', async () => {
    prismaMock.empleado.findFirst.mockResolvedValueOnce({ Id: 5 });
    prismaMock.planillaMensual.findFirst.mockResolvedValueOnce(null);

    await expect(getMyPayrollById(99, 77)).rejects.toThrowError('Planilla no existe');
    expect(prismaMock.planillaMensual.findFirst).toHaveBeenCalledWith({
      where: { Id: 77, IdEmpleado: 5, Anulado: false },
      select: { Id: true },
    });
  });

  it('calcula comisión sobre ventas pagadas y volumen mensual completo', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValue({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      routeEmployee(1, 10, 'Repartidor A', 2000),
      routeEmployee(2, 11, 'Vendedor B', 2000),
    ]);
    prismaMock.tarifaViatico.findFirst.mockResolvedValue({ TarifaDiaria: 30 });
    prismaMock.faltanteEmpleado.findMany.mockResolvedValue([{ Id: 1, Monto: 50, Observacion: 'Faltante' }]);

    prismaMock.detalleVenta.findMany.mockResolvedValue([
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
        InventarioItem: { Nombre: 'Garrafón 18L', IdCategoriaComision: null, CategoriaComision: null },
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
        InventarioItem: { Nombre: 'Garrafón 18L', IdCategoriaComision: null, CategoriaComision: null },
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
        InventarioItem: { Nombre: 'Garrafón 18L', IdCategoriaComision: null, CategoriaComision: null },
      },
    ]);

    prismaMock.reglaComision.findMany.mockResolvedValue([
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
      empleados: [
        {
          idEmpleado: 1,
          diasTrabajados: 5,
          ajustes: [{ tipoAjuste: 'BONO_META', descripcion: 'Meta mensual', monto: 200 }],
        },
        {
          idEmpleado: 2,
          diasTrabajados: 5,
          ajustes: [{ tipoAjuste: 'BONO_META', descripcion: 'Meta mensual', monto: 200 }],
        },
      ],
    });

    expect(result.planillas).toHaveLength(2);
    expect(result.planillas[0].totalComisiones).toBe(80);
    expect(result.planillas[0].sueldoLiquido).toBe(2230);
    expect(result.planillas.map((payroll) => payroll.totalBonosMetas)).toEqual([200, 200]);
    expect(result.planillas.map((payroll) => payroll.totalViaticos)).toEqual([150, 150]);
    expect(result.planillas.map((payroll) => payroll.totalDescuentos)).toEqual([50, 50]);
    expect(result.planillas.reduce((total, payroll) => total + payroll.totalBonosMetas, 0)).toBe(400);
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

  it('aplica tasas por categoría inclusivas al total y reconcilia los redondeos', async () => {
    const tiers = [
      { montoMinimoVenta: 0, porcentaje: 3.09 },
      { montoMinimoVenta: 30000, porcentaje: 3.1 },
      ...Array.from({ length: 12 }, (_, index) => ({
        montoMinimoVenta: 35000 + index * 5000,
        porcentaje: Number((3.11 + index * 0.01).toFixed(2)),
      })),
    ];
    const employees = tiers.map((tier, index) =>
      routeEmployee(index + 1, 100 + index, `Ruta ${index + 1}`),
    );
    employees.push(routeEmployee(100, 500, 'Ruta garrafones'));
    employees.push(routeEmployee(101, 501, 'Ruta redondeo'));
    const saleByUser = new Map<number, Array<{
      Id: number;
      IdVenta: number;
      IdInventarioItem: number;
      Cantidad: number;
      PrecioUnitario: number;
      Venta: { RutaSesion: {
        Id: number;
        FechaSesion: Date;
        IdUsuarioChofer: number;
        IdUsuarioVendedor: number;
      } };
      InventarioItem: {
        Nombre: string;
        IdCategoriaComision: number;
        CategoriaComision: { Nombre: string };
      };
    }>>();
    const addSale = (
      userId: number,
      detailId: number,
      productId: number,
      price: number,
      categoryId: number,
      categoryName: string,
    ) => {
      const details = saleByUser.get(userId) ?? [];
      details.push({
        Id: detailId,
        IdVenta: detailId + 1000,
        IdInventarioItem: productId,
        Cantidad: 1,
        PrecioUnitario: price,
        Venta: {
          RutaSesion: {
            Id: detailId + 2000,
            FechaSesion: new Date('2026-08-12T00:00:00.000Z'),
            IdUsuarioChofer: userId,
            IdUsuarioVendedor: userId + 1000,
          },
        },
        InventarioItem: {
          Nombre: `Producto ${productId}`,
          IdCategoriaComision: categoryId,
          CategoriaComision: { Nombre: categoryName },
        },
      });
      saleByUser.set(userId, details);
    };

    tiers.forEach((tier, index) => {
      addSale(
        100 + index,
        300 + index,
        100 + index,
        tier.montoMinimoVenta || 1000,
        2,
        'Otros',
      );
    });
    addSale(500, 600, 600, 1000, 1, 'Garrafones');
    addSale(501, 601, 601, 0.1, 2, 'Otros');
    addSale(501, 602, 602, 0.1, 2, 'Otros');

    prismaMock.configuracionComision.findFirst.mockResolvedValue({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce(employees);
    prismaMock.detalleVenta.findMany.mockImplementation(async (args: {
      where: { Venta: { RutaSesion: { OR: Array<{ IdUsuarioChofer: number }> } } };
    }) => {
      const userId = args.where.Venta.RutaSesion.OR[0].IdUsuarioChofer;
      return saleByUser.get(userId) ?? [];
    });
    prismaMock.reglaComisionCategoria.findMany.mockResolvedValue([
      {
        Id: 100,
        IdCategoriaComision: 1,
        MontoMinimoVenta: 0,
        Porcentaje: 3,
        FechaInicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
        FechaFinVigencia: null,
      },
      ...tiers.map((tier, index) => ({
        Id: 200 + index,
        IdCategoriaComision: 2,
        MontoMinimoVenta: tier.montoMinimoVenta,
        Porcentaje: tier.porcentaje,
        FechaInicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
        FechaFinVigencia: null,
      })),
    ]);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({ mes: 8, anio: 2026 });

    for (const [index, tier] of tiers.entries()) {
      const row = result.planillas.find((item) => item.idEmpleado === index + 1);
      const base = tier.montoMinimoVenta || 1000;
      expect(row?.detalleComisiones[0]).toMatchObject({
        baseCategoriaAplicada: base,
        valorAplicado: tier.montoMinimoVenta === 0 ? 3.09 : tier.porcentaje,
        montoComision: Number((base * (tier.montoMinimoVenta === 0 ? 3.09 : tier.porcentaje) / 100).toFixed(2)),
      });
    }
    expect(result.planillas.find((item) => item.idEmpleado === 2)?.totalComisiones).toBe(930);
    expect(result.planillas.find((item) => item.idEmpleado === 3)?.totalComisiones).toBe(1088.5);

    const garrafones = result.planillas.find((item) => item.idEmpleado === 100);
    expect(garrafones?.detalleComisiones[0]).toMatchObject({
      baseCategoriaAplicada: 1000,
      valorAplicado: 3,
      montoComision: 30,
    });
    const roundingCase = result.planillas.find((item) => item.idEmpleado === 101);
    expect(roundingCase?.totalComisiones).toBe(0.01);
    expect(roundingCase?.detalleComisiones.reduce((total, item) => total + item.montoComision, 0)).toBe(0.01);
    expect(result.validaciones).toEqual([]);
  });

  it('atribuye deducciones y bonos por empleado y separa viáticos solo para ruta', async () => {
    const routeA = routeEmployee(1, 10, 'Ruta A', 1000);
    const routeB = routeEmployee(2, 20, 'Ruta B', 2000);
    const plant = {
      ...routeEmployee(3, 30, 'Planta', 3000, null),
      IdTipoTrabajador: 2,
      TipoTrabajador: { Clave: 'PLANTA' },
    };
    prismaMock.configuracionComision.findFirst.mockResolvedValue({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([routeA, routeB, plant]);
    prismaMock.tarifaViatico.findFirst.mockResolvedValue({ TarifaDiaria: 30 });
    prismaMock.detalleVenta.findMany.mockImplementation(async (args: {
      where: { Venta: { RutaSesion: { OR: Array<{ IdUsuarioChofer: number }> } } };
    }) => {
      const userId = args.where.Venta.RutaSesion.OR[0].IdUsuarioChofer;
      return userId === 30 ? [{
        Id: 99,
        IdVenta: 199,
        IdInventarioItem: 999,
        Cantidad: 1,
        PrecioUnitario: 100,
        Venta: {
          RutaSesion: {
            Id: 299,
            FechaSesion: new Date('2026-08-12T00:00:00.000Z'),
            IdUsuarioChofer: 30,
            IdUsuarioVendedor: 31,
          },
        },
        InventarioItem: {
          Nombre: 'Producto de planta',
          IdCategoriaComision: null,
          CategoriaComision: null,
        },
      }] : [];
    });
    prismaMock.adelantoEmpleado.findMany.mockImplementation(async (args: {
      where: { IdEmpleado: number };
    }) => args.where.IdEmpleado === 1
      ? [{ Id: 11, Monto: 100, Observacion: 'Adelanto A' }]
      : args.where.IdEmpleado === 2
        ? [{ Id: 22, Monto: 50, Observacion: 'Adelanto B' }]
        : []);
    prismaMock.faltanteEmpleado.findMany.mockImplementation(async (args: {
      where: { IdEmpleado: number };
    }) => args.where.IdEmpleado === 1
      ? [{ Id: 31, Monto: 30, Observacion: 'Faltante A' }]
      : args.where.IdEmpleado === 2
        ? [{ Id: 42, Monto: 70, Observacion: 'Faltante B' }]
        : []);
    prismaMock.planillaMensual.findMany.mockResolvedValueOnce([]);

    const result = await previewPayroll({
      mes: 8,
      anio: 2026,
      empleados: [
        { idEmpleado: 1, diasTrabajados: 4, ajustes: [{ tipoAjuste: 'BONO_META', descripcion: 'Bono A', monto: 5 }] },
        { idEmpleado: 2, diasTrabajados: 1, ajustes: [{ tipoAjuste: 'BONO_META', descripcion: 'Bono B', monto: 9 }] },
        { idEmpleado: 3, diasTrabajados: 10, ajustes: [{ tipoAjuste: 'BONO_META', descripcion: 'Bono planta', monto: 12 }] },
      ],
    });

    expect(result.planillas).toMatchObject([
      { idEmpleado: 1, totalBonosMetas: 5, totalDescuentos: 130, diasTrabajados: 4, tarifaViaticoAplicada: 30, totalViaticos: 120, sueldoLiquido: 875 },
      { idEmpleado: 2, totalBonosMetas: 9, totalDescuentos: 120, diasTrabajados: 1, tarifaViaticoAplicada: 30, totalViaticos: 30, sueldoLiquido: 1889 },
      { idEmpleado: 3, totalBonosMetas: 12, totalDescuentos: 0, diasTrabajados: 0, tarifaViaticoAplicada: null, totalViaticos: 0, totalComisiones: 0, sueldoLiquido: 3012, detalleComisiones: [] },
    ]);
    expect(result.planillas[0].detalleAjustes.map((item) => item.descripcion)).toEqual([
      'Bono A',
      'Adelanto #11 - Adelanto A',
      'Faltante aprobado #31 - Faltante A',
    ]);
    expect(result.planillas[1].detalleAjustes.map((item) => item.descripcion)).toEqual([
      'Bono B',
      'Adelanto #22 - Adelanto B',
      'Faltante aprobado #42 - Faltante B',
    ]);
    expect(result.planillas[2].detalleAjustes.map((item) => item.descripcion)).toEqual(['Bono planta']);
    expect(prismaMock.detalleVenta.findMany).toHaveBeenCalledTimes(2);
    expect(result.validaciones).toEqual([]);
  });

  it('calcula una regla porcentual y otra por unidad sin duplicar detalles fuente', async () => {
    prismaMock.configuracionComision.findFirst.mockResolvedValueOnce({ Id: 3 });
    prismaMock.empleado.findMany.mockResolvedValueOnce([routeEmployee(1, 10, 'Repartidor A')]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 2,
        PrecioUnitario: 50,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 10 } },
        InventarioItem: { Nombre: 'Producto A', IdCategoriaComision: null, CategoriaComision: null },
      },
      {
        Id: 2,
        IdVenta: 101,
        IdInventarioItem: 6,
        Cantidad: 3,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 2, FechaSesion: new Date('2026-08-02T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto B', IdCategoriaComision: null, CategoriaComision: null },
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
      routeEmployee(1, null, 'Empleado sin vínculo'),
      routeEmployee(2, 12, 'Empleado sin configuración', 1000, null),
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
    prismaMock.empleado.findMany.mockResolvedValueOnce([routeEmployee(1, 10, 'Repartidor A')]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 10,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto A', IdCategoriaComision: null, CategoriaComision: null },
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
    prismaMock.empleado.findMany.mockResolvedValueOnce([routeEmployee(1, 10, 'Repartidor A')]);
    prismaMock.detalleVenta.findMany.mockResolvedValueOnce([
      {
        Id: 1,
        IdVenta: 100,
        IdInventarioItem: 5,
        Cantidad: 10,
        PrecioUnitario: 10,
        Venta: { RutaSesion: { Id: 1, FechaSesion: new Date('2026-08-01T00:00:00Z'), IdUsuarioChofer: 10, IdUsuarioVendedor: 11 } },
        InventarioItem: { Nombre: 'Producto sin regla', IdCategoriaComision: null, CategoriaComision: null },
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
    prismaMock.empleado.findMany.mockResolvedValue([routeEmployee(1, 10, 'Repartidor A')]);
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
        InventarioItem: { Nombre: 'Producto A', IdCategoriaComision: null, CategoriaComision: null },
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
      planillaEvento: { create: vi.fn() },
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
    const transactionClient = {
      planillaMensual: { update: vi.fn().mockResolvedValue({ Id: 21 }) },
      planillaEvento: { create: vi.fn().mockResolvedValue({ Id: 1 }) },
    };
    prismaMock.$transaction.mockImplementationOnce(
      (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    );
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

    expect(transactionClient.planillaMensual.update).toHaveBeenCalledWith(
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
