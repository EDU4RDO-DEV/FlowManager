import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cuentaPorCobrar: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/sale.service', () => ({
  anulateSalePayment: vi.fn(),
  createSalePayment: vi.fn(),
  listSalePayments: vi.fn(),
}));

import { listCredits, listCreditsByCustomer } from '../services/credit.service';

function buildPayment(id: number, monto: number, anulado: boolean) {
  return {
    Id: id,
    Monto: monto,
    MetodoPago: 'EFECTIVO',
    NumeroReferencia: null,
    Banco: null,
    FechaPago: new Date(`2026-10-${String(id).padStart(2, '0')}`),
    RutaFirma: null,
    Observaciones: null,
    Anulado: anulado,
    FechaAnulacion: anulado ? new Date('2026-10-15') : null,
    Usuario: { Id: 2, Nombre: 'Operador', Correo: 'operador@example.test' },
  };
}

function buildCredit(pagos: ReturnType<typeof buildPayment>[]) {
  return {
    Id: 12,
    IdVenta: 45,
    IdTipoCreditoAplicado: null,
    IdClienteCondicionCreditoAplicada: null,
    TotalOriginal: 100,
    Estado: 'ACTIVO',
    FechaCreacion: new Date('2026-10-01'),
    FechaVencimiento: null,
    FechaLiquidacion: null,
    MotivoCierre: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    TipoCredito: null,
    Venta: {
      Id: 45,
      NumeroVenta: 1045,
      NumeroProForma: null,
      CondicionPago: 'CREDITO',
      EstadoPago: 'PARCIAL',
      Anulado: false,
      AutorizacionFel: null,
      NumeroFel: null,
      SerieFel: null,
      FechaEmisionFel: null,
      FechaRegistro: new Date('2026-10-01'),
      Cliente: {
        Id: 7,
        Entidad: { NombreCompleto: 'Cliente de Prueba', Nit: '1234567-8' },
      },
      PagoVenta: pagos,
    },
  };
}

describe('credit service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters the portfolio by customer, current payment state, date, and document search', async () => {
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(0);
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);

    await listCredits({
      page: 2,
      limit: 10,
      idCliente: 7,
      estadoPago: 'PARCIAL',
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31',
      busqueda: '1045',
    });

    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          Anulado: false,
          AND: expect.arrayContaining([
            expect.objectContaining({
              Venta: expect.objectContaining({
                IdCliente: 7,
                EstadoPago: 'PARCIAL',
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      expect.objectContaining({
                        FechaEmisionFel: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
                      }),
                    ]),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it('returns an auditable history while calculating balance only from active payments', async () => {
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
      buildCredit([buildPayment(10, 20, false), buildPayment(11, 5, true)]),
    ]);

    const [credit] = await listCreditsByCustomer(7);

    expect(credit.totalAbonado).toBe(20);
    expect(credit.saldo).toBe(80);
    expect(credit.pagos).toHaveLength(2);
    expect(credit.pagos.map((payment) => payment.estado)).toEqual(['REGISTRADO', 'ANULADO']);
    expect(credit.pagos[1].fechaAnulacion).toEqual(new Date('2026-10-15'));
    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Venta: { IdCliente: 7 } },
      }),
    );
  });

  it('retains annulled invoice history without counting it as an outstanding balance', async () => {
    const annulled = buildCredit([buildPayment(12, 40, true)]);
    annulled.Anulado = true;
    annulled.Estado = 'ANULADO';
    annulled.Venta.Anulado = true;
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([annulled]);

    const [credit] = await listCreditsByCustomer(7);

    expect(credit.estado).toBe('ANULADO');
    expect(credit.saldo).toBe(0);
    expect(credit.totalAbonado).toBe(0);
    expect(credit.pagos[0]).toMatchObject({ estado: 'ANULADO', anulado: true, monto: 40 });
    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { Venta: { IdCliente: 7 } } }),
    );
  });

  it('can include annulled accounts in the central portfolio query', async () => {
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(0);
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([]);

    await listCredits({ incluirAnulados: true });

    const [query] = prismaMock.cuentaPorCobrar.findMany.mock.calls[0];
    expect(query.where).not.toHaveProperty('Anulado');
    expect(query.where.Venta).not.toHaveProperty('Anulado');
  });
});
