import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '../config/prisma';
import { createSalePayment } from '../services/sale.service';

vi.mock('../services/notification.service', () => ({
  NotificationEvents: { PAGO_RECIBIDO: 'PAGO_RECIBIDO' },
  send: vi.fn().mockResolvedValue({ ok: true }),
}));

const integrationEnabled = process.env.ROUTE_SQLSERVER_INTEGRATION === '1';
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('sale payment SQL Server rollback integration', () => {
  let ownerId: number;
  let clientId: number;
  let providerId: number;
  let saleId: number;
  let itemId: number;
  const entityIds: number[] = [];

  beforeAll(async () => {
    const database = await prisma.$queryRaw<Array<{ databaseName: string }>>`SELECT DB_NAME() AS databaseName`;
    const databaseName = database[0]?.databaseName;
    const allowFlowManager =
      databaseName === 'FlowManager' && process.env.FLOWMANAGER_SQLSERVER_INTEGRATION === '1';
    if (databaseName !== 'FlowManager_Test' && !allowFlowManager) {
      throw new Error('Las pruebas de integración requieren FlowManager_Test o el permiso explícito para FlowManager');
    }

    let owner: { Id: number } | null = null;
    if (databaseName === 'FlowManager_Test') {
      owner = await prisma.usuario.findFirst({
        where: { Correo: 'sqlserver-integration@flowmanager.test', Anulado: false },
        select: { Id: true },
      });
    } else {
      const adminRole = await prisma.rol.findFirst({
        where: { Nombre: 'Administrador', Anulado: false },
        select: { Id: true },
      });
      owner = adminRole
        ? await prisma.usuario.findFirst({
            where: { IdRol: adminRole.Id, Anulado: false },
            select: { Id: true },
          })
        : null;
    }
    if (!owner) throw new Error('Falta el usuario inicial del seed de integración');
    ownerId = owner.Id;

    const clientEntity = await prisma.entidad.create({
      data: { IdUsuario: ownerId, NombreCompleto: `Payment integration customer ${Date.now()}` },
      select: { Id: true },
    });
    entityIds.push(clientEntity.Id);
    const client = await prisma.cliente.create({
      data: { IdEntidad: clientEntity.Id, IdUsuario: ownerId },
      select: { Id: true },
    });
    clientId = client.Id;

    const providerEntity = await prisma.entidad.create({
      data: { IdUsuario: ownerId, NombreCompleto: `Payment integration provider ${Date.now()}` },
      select: { Id: true },
    });
    entityIds.push(providerEntity.Id);
    const provider = await prisma.proveedor.create({
      data: { IdEntidad: providerEntity.Id, IdUsuario: ownerId },
      select: { Id: true },
    });
    providerId = provider.Id;

    const item = await prisma.inventarioItem.create({
      data: {
        IdUsuario: ownerId,
        IdProveedor: providerId,
        Nombre: `Payment integration product ${Date.now()}`,
        Categoria: 'PRODUCTO_TERMINADO',
        UnidadMedida: 'unidad',
        Existencia: 10,
        CostoPromedio: 1,
        PrecioVenta: 10,
      },
      select: { Id: true },
    });
    itemId = item.Id;

    const sale = await prisma.$transaction(async (tx) => {
      const lastSale = await tx.venta.findFirst({
        orderBy: { NumeroVenta: 'desc' },
        select: { NumeroVenta: true },
      });
      return tx.venta.create({
        data: {
          IdCliente: clientId,
          IdUsuario: ownerId,
          NumeroVenta: (lastSale?.NumeroVenta ?? 0) + 1,
          TipoRegistro: 'VENTA',
          EstadoEntrega: 'PENDIENTE',
          CondicionPago: 'CREDITO',
          EstadoPago: 'PENDIENTE',
          RequiereFactura: false,
        },
        select: { Id: true },
      });
    }, { isolationLevel: 'Serializable' });
    saleId = sale.Id;
    await prisma.detalleVenta.create({
      data: {
        IdVenta: saleId,
        IdInventarioItem: itemId,
        Nombre: 'Payment integration product',
        Cantidad: 1,
        PrecioUnitario: 10,
      },
    });
    await prisma.cuentaPorCobrar.create({
      data: {
        IdVenta: saleId,
        IdUsuarioCreacion: ownerId,
        TotalOriginal: 10,
        Estado: 'ACTIVO',
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (saleId) {
      await prisma.solicitudPagoIdempotente.deleteMany({ where: { IdVenta: saleId } });
      await prisma.pagoVenta.deleteMany({ where: { IdVenta: saleId } });
      await prisma.cuentaPorCobrar.deleteMany({ where: { IdVenta: saleId } });
      await prisma.detalleVenta.deleteMany({ where: { IdVenta: saleId } });
      await prisma.venta.deleteMany({ where: { Id: saleId } });
    }
    if (itemId) await prisma.inventarioItem.deleteMany({ where: { Id: itemId } });
    if (clientId) await prisma.cliente.deleteMany({ where: { Id: clientId } });
    if (providerId) await prisma.proveedor.deleteMany({ where: { Id: providerId } });
    if (entityIds.length) await prisma.entidad.deleteMany({ where: { Id: { in: entityIds } } });
    await prisma.$disconnect();
  }, 30_000);

  it('keeps concurrent credit payments within the balance and replays an idempotent request once', async () => {
    const competing = await Promise.allSettled([
      createSalePayment(saleId, { idUsuario: ownerId, monto: 7, metodoPago: 'EFECTIVO' }, `payment-a-${Date.now()}`),
      createSalePayment(saleId, { idUsuario: ownerId, monto: 7, metodoPago: 'EFECTIVO' }, `payment-b-${Date.now()}`),
    ]);
    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    const idempotencyKey = `payment-replay-${Date.now()}`;
    const replayInput = { idUsuario: ownerId, monto: 1, metodoPago: 'EFECTIVO' as const };
    const [firstReplay, secondReplay] = await Promise.all([
      createSalePayment(saleId, replayInput, idempotencyKey),
      createSalePayment(saleId, replayInput, idempotencyKey),
    ]);
    expect(secondReplay.id).toBe(firstReplay.id);

    const [payments, requests, account, sale] = await Promise.all([
      prisma.pagoVenta.findMany({ where: { IdVenta: saleId, Anulado: false } }),
      prisma.solicitudPagoIdempotente.findMany({ where: { IdVenta: saleId } }),
      prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { IdVenta: saleId } }),
      prisma.venta.findUniqueOrThrow({ where: { Id: saleId }, select: { EstadoPago: true } }),
    ]);
    expect(payments).toHaveLength(2);
    expect(payments.reduce((sum, payment) => sum + Number(payment.Monto), 0)).toBe(8);
    expect(requests).toHaveLength(2);
    expect(account.Estado).toBe('ACTIVO');
    expect(sale.EstadoPago).toBe('PARCIAL');
  }, 30_000);
});
