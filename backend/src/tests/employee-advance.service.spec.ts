import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    adelantoEmpleado: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    empleado: { findFirst: vi.fn() },
    cajaSesion: { findFirst: vi.fn() },
    movimientoCaja: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  createEmployeeAdvance,
  listEmployeeAdvances,
} from '../services/employee-advance.service';

describe('employee advance service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an idempotent advance and records its cash disbursement', async () => {
    const tx = {
      adelantoEmpleado: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          Id: 41,
          Monto: { toString: () => '75.00' },
          Fecha: new Date('2026-10-31T00:00:00.000Z'),
        }),
      },
      empleado: { findFirst: vi.fn().mockResolvedValue({ Id: 8 }) },
      cajaSesion: { findFirst: vi.fn().mockResolvedValue({ Id: 12 }) },
      movimientoCaja: { create: vi.fn().mockResolvedValue({ Id: 90 }) },
    };
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    prismaMock.adelantoEmpleado.findMany.mockResolvedValue([]);

    const result = await createEmployeeAdvance(2, {
      idEmpleado: 8,
      monto: 75,
      fecha: '2026-10-31',
      metodoPago: 'EFECTIVO',
    }, 'advance-key-41');

    expect(result.replayed).toBe(false);
    expect(tx.adelantoEmpleado.create).toHaveBeenCalledOnce();
    expect(tx.movimientoCaja.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        IdCajaSesion: 12,
        IdAdelantoEmpleado: 41,
        Tipo: 'EGRESO',
        MetodoPago: 'EFECTIVO',
      }),
    }));
  });

  it('carries advance balances forward and reports partial applications', async () => {
    prismaMock.adelantoEmpleado.findMany.mockResolvedValue([{
      Id: 41,
      IdEmpleado: 8,
      Fecha: new Date('2026-08-01T00:00:00Z'),
      Monto: { toString: () => '100.00' },
      MetodoPago: 'EFECTIVO',
      NumeroReferencia: null,
      Banco: null,
      Observacion: null,
      Empleado: { Entidad: { NombreCompleto: 'Empleado' } },
      Usuario: { Nombre: 'Admin' },
      Aplicaciones: [{
        Id: 99,
        IdPlanillaMensual: 6,
        MontoAplicado: { toString: () => '35.00' },
        FechaAplicacion: new Date('2026-09-01T00:00:00Z'),
        Anulado: false,
        PlanillaMensual: { Mes: 9, Anio: 2026, Estado: 'CERRADA', Anulado: false },
      }],
    }]);

    const advances = await listEmployeeAdvances(8);

    expect(advances[0]).toMatchObject({
      monto: 100,
      montoAplicado: 35,
      saldoPendiente: 65,
      aplicaciones: [{ vigente: true, monto: 35 }],
    });
  });
});
