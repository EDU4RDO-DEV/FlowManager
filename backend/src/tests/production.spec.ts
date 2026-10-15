import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { roleHasModulePermission } from '../middlewares/auth.middleware';
import {
  calculateProductionRequirements,
  confirmProductionOrder,
  getProductionOrder,
  cancelProductionOrder,
  listProductionOrders,
} from '../services/production.service';
import {
  createProductionOrderSchema,
  listProductionOrdersQuerySchema,
} from '../validators/production.validators';
import { rolePermissionEntrySchema } from '../validators/role-permission.validators';

const accessSecret = 'production-test-access-secret';
const sessionId = 84101;

function mockProductionTransaction(
  componentStock: number,
  serializeTransactions = false,
  envaseConfigured = false,
) {
  const order = {
    Id: 41,
    IdProductoTerminado: 20,
    NombreProductoTerminadoSnapshot: 'Producto terminado',
    CantidadProducir: 2,
    UnidadMedidaSnapshot: 'unidad',
    Estado: 'PENDIENTE',
    Anulado: false,
    InventarioItem: { Id: 20, Nombre: 'Producto terminado', UnidadMedida: 'unidad' },
    Detalles: [{
      Id: 1,
      IdOrdenProduccion: 41,
      IdInventarioItem: 10,
      CantidadPorUnidad: 1,
      CantidadTotal: 2,
      UnidadMedidaSnapshot: 'kg',
      InventarioItem: {
        Id: 10,
        Nombre: 'Materia prima',
        Categoria: 'MATERIA_PRIMA',
        UnidadMedida: 'kg',
        Existencia: componentStock,
        Anulado: false,
      },
    }],
  };
  const stock = new Map([
    [10, componentStock],
    [20, 5],
    [30, 25],
  ]);
  const physicalBuckets = new Map([
    ['30|PLANTA|VACIO', 4],
    ['30|PLANTA|LLENO', 0],
  ]);
  const movements: Array<Record<string, unknown>> = [];
  let transactionQueue: Promise<unknown> = Promise.resolve();
  const tx = {
    ordenProduccion: {
      findUnique: vi.fn(async () => order),
      updateMany: vi.fn(async () => {
        if (order.Estado !== 'PENDIENTE' || order.Anulado) return { count: 0 };
        order.Estado = 'FABRICADA';
        return { count: 1 };
      }),
    },
    inventarioItem: {
      findFirst: vi.fn(async (input: { where: { Id: number } }) => input.where.Id === 30
        ? { Id: 30, Nombre: 'Garrafón', EsEnvaseRetornable: true }
        : {
            Id: 20,
            Nombre: 'Producto terminado',
            Existencia: stock.get(20) ?? 0,
            UnidadMedida: 'unidad',
            IdEnvasePresentacion: envaseConfigured ? 30 : null,
            UnidadesEnvasePorUnidad: envaseConfigured ? 1 : null,
          }),
      update: vi.fn(async (input: { where: { Id: number }; data: { Existencia: number } }) => {
        stock.set(input.where.Id, input.data.Existencia);
      }),
    },
    bitacoraInventario: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async (input: { where: { IdInventarioItem: number; UbicacionEnvase?: string; EstadoEnvase?: string } }) => {
        if (!input.where.UbicacionEnvase || !input.where.EstadoEnvase) return null;
        const key = `${input.where.IdInventarioItem}|${input.where.UbicacionEnvase}|${input.where.EstadoEnvase}`;
        return { NuevaExistencia: physicalBuckets.get(key) ?? 0 };
      }),
      create: vi.fn(async (input: { data: Record<string, unknown> }) => {
        movements.push(input.data);
        if (input.data.UbicacionEnvase && input.data.EstadoEnvase) {
          const key = `${input.data.IdInventarioItem}|${input.data.UbicacionEnvase}|${input.data.EstadoEnvase}`;
          physicalBuckets.set(key, Number(input.data.NuevaExistencia));
        }
      }),
    },
  };

  vi.spyOn(prisma, '$transaction').mockImplementation((async (callback: unknown) => {
    if (typeof callback !== 'function') {
      throw new Error('Se esperaba una transacción interactiva');
    }
    const operation = callback as (client: Prisma.TransactionClient) => Promise<unknown>;
    const runOperation = () => operation(tx as unknown as Prisma.TransactionClient);
    if (!serializeTransactions) return runOperation();
    const current = transactionQueue.then(runOperation, runOperation);
    transactionQueue = current.then(() => undefined, () => undefined);
    return current;
  }) as never);

  return { order, stock, movements, physicalBuckets, tx };
}

function buildToken() {
  return jwt.sign(
    {
      sub: 101,
      sid: sessionId,
      correo: 'production-test@example.test',
      idRol: 99,
      nombreRol: 'Auxiliar de Planta',
      nombre: 'Production Test',
      tokenType: 'access',
    },
    accessSecret,
    {
      algorithm: 'HS256',
      expiresIn: 60,
      issuer: 'flowmanager.api',
      audience: 'flowmanager.web',
    },
  );
}

describe('Production module', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requires authentication for a direct production API request', async () => {
    process.env.JWT_SECRET = accessSecret;
    const response = await request(createApp()).get('/api/production/orders');

    expect(response.status).toBe(401);
    expect(response.body.ok).toBe(false);
  });

  it('denies a direct production API request without the module permission', async () => {
    process.env.JWT_SECRET = accessSecret;
    vi.spyOn(prisma.sesion, 'findFirst').mockResolvedValue({ Id: sessionId } as never);
    vi.spyOn(prisma.usuario, 'findFirst').mockResolvedValue({ Id: 101, IdRol: 99 } as never);
    vi.spyOn(prisma.rol, 'findFirst').mockResolvedValue({ Id: 99 } as never);
    vi.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ total: 3 }] as never)
      .mockResolvedValueOnce([{ total: 1 }] as never)
      .mockResolvedValueOnce([{ total: 0 }] as never);

    const response = await request(createApp())
      .get('/api/production/orders')
      .set('Authorization', `Bearer ${buildToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  it('protects order creation, confirmation, and cancellation with their respective permissions', async () => {
    process.env.JWT_SECRET = accessSecret;
    vi.spyOn(prisma.sesion, 'findFirst').mockResolvedValue({ Id: sessionId } as never);
    vi.spyOn(prisma.usuario, 'findFirst').mockResolvedValue({ Id: 101, IdRol: 99 } as never);
    vi.spyOn(prisma.rol, 'findFirst').mockResolvedValue({ Id: 99 } as never);
    const queryResults = Array.from({ length: 3 }, () => [
      [{ total: 3 }],
      [{ total: 1 }],
      [{ total: 0 }],
    ]).flat();
    vi.spyOn(prisma, '$queryRaw').mockImplementation(async () => queryResults.shift() as never);

    const app = createApp();
    const authorization = `Bearer ${buildToken()}`;
    const requests = [
      request(app).post('/api/production/orders').set('Authorization', authorization).send({}),
      request(app).post('/api/production/orders/1/confirm').set('Authorization', authorization),
      request(app).patch('/api/production/orders/1/cancel').set('Authorization', authorization),
    ];
    const responses = [];
    for (const pendingRequest of requests) {
      responses.push(await pendingRequest);
    }

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
  });

  it('does not grant negative-stock permission when no persisted role grant exists', async () => {
    vi.spyOn(prisma.rol, 'findFirst').mockResolvedValue({ Id: 99 } as never);
    vi.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ total: 3 }] as never)
      .mockResolvedValueOnce([{ total: 1 }] as never)
      .mockResolvedValueOnce([{ total: 0 }] as never);

    await expect(roleHasModulePermission(99, 'produccion', 'allow-negative-stock')).resolves.toBe(false);
  });

  it('rejects non-positive production quantities', () => {
    expect(() => createProductionOrderSchema.parse({
      idProductoTerminado: 1,
      cantidadProducir: 0,
    })).toThrow();
    expect(() => createProductionOrderSchema.parse({
      idProductoTerminado: 1,
      cantidadProducir: Number.POSITIVE_INFINITY,
    })).toThrow();
  });

  it('validates production order status filters', () => {
    expect(listProductionOrdersQuerySchema.safeParse({ estado: 'PENDIENTE' }).success).toBe(true);
    expect(listProductionOrdersQuerySchema.safeParse({ estado: 'DESCONOCIDO' }).success).toBe(false);
  });

  it('applies status and search filters to the production order query', async () => {
    const count = vi.spyOn(prisma.ordenProduccion, 'count').mockResolvedValue(0);
    const findMany = vi.spyOn(prisma.ordenProduccion, 'findMany').mockResolvedValue([] as never);

    await listProductionOrders({
      page: 1,
      limit: 20,
      busqueda: '41',
      estado: 'PENDIENTE',
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        Estado: 'PENDIENTE',
        OR: [
          { Id: 41 },
          { InventarioItem: { Nombre: { contains: '41' } } },
        ],
      },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ Estado: 'PENDIENTE' }),
    }));
  });

  it('scopes the negative-stock permission to the production module', () => {
    expect(rolePermissionEntrySchema.safeParse({
      moduleKey: 'produccion',
      action: 'allow-negative-stock',
      permitido: true,
    }).success).toBe(true);
    expect(rolePermissionEntrySchema.safeParse({
      moduleKey: 'inventario',
      action: 'allow-negative-stock',
      permitido: true,
    }).success).toBe(false);
  });

  it('calculates recipe consumption directly in each component unit without conversion', () => {
    const requirements = calculateProductionRequirements(2.5, [
      {
        idInventarioItem: 10,
        nombre: 'Materia prima',
        cantidadPorUnidad: 0.4,
        unidadMedida: 'kg',
        existencia: 2,
      },
    ]);

    expect(requirements).toEqual([
      expect.objectContaining({
        cantidadRequerida: 1,
        saldoProyectado: 1,
        unidadMedida: 'kg',
      }),
    ]);
  });

  it('requires a non-empty recipe for theoretical consumption', () => {
    expect(() => calculateProductionRequirements(1, [])).toThrow('El producto no tiene una receta activa');
  });

  it('records ingredient consumption and finished-goods entry together, only once', async () => {
    const { order, stock, movements } = mockProductionTransaction(5);

    await confirmProductionOrder(41, 101, false);
    await expect(confirmProductionOrder(41, 101, false)).rejects.toThrow('La orden ya fue confirmada o cancelada');

    expect(order.Estado).toBe('FABRICADA');
    expect(stock.get(10)).toBe(3);
    expect(stock.get(20)).toBe(7);
    expect(movements).toHaveLength(2);
    expect(movements.map((movement) => movement.TipoMovimiento)).toEqual([false, true]);
  });

  it('keeps water production independent from the physical container ledger', async () => {
    const { stock, movements, physicalBuckets } = mockProductionTransaction(5, false, true);

    await confirmProductionOrder(41, 101, false);

    expect(stock.get(20)).toBe(7);
    expect(physicalBuckets.get('30|PLANTA|VACIO')).toBe(4);
    expect(physicalBuckets.get('30|PLANTA|LLENO')).toBe(0);
    expect(movements.filter((movement) => movement.UbicacionEnvase)).toHaveLength(0);
  });

  it('returns inventory movements in the production order detail', async () => {
    const { order } = mockProductionTransaction(5);
    vi.spyOn(prisma.ordenProduccion, 'findUnique').mockResolvedValue(order as never);
    vi.spyOn(prisma.bitacoraInventario, 'findMany').mockResolvedValue([{
      Id: 71,
      IdInventarioItem: 10,
      Nombre: 'Consumo producción orden #41 - Materia prima',
      TipoMovimiento: false,
      ExistenciaAnterior: 5,
      Cantidad: 2,
      NuevaExistencia: 3,
      FechaRegistro: new Date('2026-10-12T12:00:00.000Z'),
      Anulado: false,
    }] as never);

    const detail = await getProductionOrder(41);

    expect(detail.movimientos).toEqual([
      expect.objectContaining({
        id: 71,
        tipo: 'CONSUMO',
        cantidad: 2,
        unidadMedida: 'kg',
      }),
    ]);
  });

  it('does not cancel an order that already has inventory movements', async () => {
    const { tx } = mockProductionTransaction(5);
    tx.bitacoraInventario.count.mockResolvedValue(1);

    await expect(cancelProductionOrder(41, 101)).rejects.toThrow(
      'No se puede cancelar una orden con movimientos de inventario asociados',
    );

    expect(tx.ordenProduccion.updateMany).not.toHaveBeenCalled();
  });

  it('does not confirm a pending order again when inventory movements already exist', async () => {
    const { tx, movements } = mockProductionTransaction(5);
    tx.bitacoraInventario.count.mockResolvedValue(1);

    await expect(confirmProductionOrder(41, 101, false)).rejects.toThrow(
      'La orden ya tiene movimientos de inventario asociados',
    );

    expect(tx.inventarioItem.update).not.toHaveBeenCalled();
    expect(movements).toHaveLength(0);
  });

  it('serializes concurrent confirmations so only one can apply movements', async () => {
    const { movements } = mockProductionTransaction(5, true);

    const results = await Promise.allSettled([
      confirmProductionOrder(41, 101, false),
      confirmProductionOrder(41, 101, false),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(movements).toHaveLength(2);
  });

  it('rejects insufficient raw material before writing any inventory movement', async () => {
    const { stock, movements, tx } = mockProductionTransaction(1);

    await expect(confirmProductionOrder(41, 101, false)).rejects.toThrow('Existencia insuficiente');

    expect(tx.inventarioItem.update).not.toHaveBeenCalled();
    expect(movements).toHaveLength(0);
    expect(stock.get(10)).toBe(1);
  });

  it('allows a negative projected ingredient balance only when the dedicated permission is passed', async () => {
    const { stock, movements } = mockProductionTransaction(1);

    await confirmProductionOrder(41, 101, true);

    expect(stock.get(10)).toBe(-1);
    expect(movements[0]?.NuevaExistencia).toBe(-1);
  });
});
