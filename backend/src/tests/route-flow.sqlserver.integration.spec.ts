import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { prisma } from '../config/prisma';
import {
  createRouteAdjustment,
  createRouteDispatch,
  createRouteReturn,
  getRouteInventory,
} from '../services/route-inventory.service';
import { createSale, anulateSale } from '../services/sale.service';
import { createRutaSesion, updateRutaSesion } from '../services/logistics.service';
import { startProformaReservationExpiryWorker } from '../services/proforma-reservation.service';

vi.mock('../services/notification.service', () => ({
  NotificationEvents: {
    FACTURA_EMITIDA: 'FACTURA_EMITIDA',
    PEDIDO_CREADO: 'PEDIDO_CREADO',
    PEDIDO_ENTREGADO: 'PEDIDO_ENTREGADO',
    VENTA_ANULADA: 'VENTA_ANULADA',
  },
  send: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../services/fel.service', () => ({
  emitFelInvoice: vi.fn().mockRejectedValue(new Error('FEL: failure simulated for rollback test')),
  anulateFelInvoice: vi.fn().mockResolvedValue({ rutaPdfFel: null }),
}));

const integrationEnabled = process.env.ROUTE_SQLSERVER_INTEGRATION === '1';
const integrationDescribe = integrationEnabled ? describe : describe.skip;
const accessSecret = 'flowmanager-route-sqlserver-integration-secret';
const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type Credential = { userId: number; token: string; sessionId: number };

integrationDescribe('route module SQL Server integration', () => {
  let ownerId: number;
  let adminRoleId: number;
  let noLogisticsRoleId: number;
  let driverId: number;
  let sellerId: number;
  let routeId: number;
  let clientId: number;
  let providerId: number;
  const testUserIds: number[] = [];
  const testSessionIds: number[] = [];
  const testEntityIds: number[] = [];
  const testVehicleIds: number[] = [];
  const testRouteSessionIds: number[] = [];
  const testInventoryItemIds: number[] = [];
  let adminCredential: Credential;
  let deniedCredential: Credential;

  async function credentialFor(userId: number): Promise<Credential> {
    const session = await prisma.sesion.create({
      data: {
        IdUsuario: userId,
        IP: '127.0.0.1',
        NombreDispositivo: 'SQL Server integration test',
        TokenSesion: `${unique}-${userId}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 64),
        FechaExpiracionToken: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: { Id: true },
    });
    testSessionIds.push(session.Id);
    const token = jwt.sign(
      { sub: userId, sid: session.Id, tokenType: 'access', correo: 'route-test@flowmanager.test' },
      accessSecret,
      { algorithm: 'HS256', expiresIn: '30m', issuer: 'flowmanager.api', audience: 'flowmanager.web' },
    );
    return { userId, token, sessionId: session.Id };
  }

  async function makeUser(name: string, roleId: number): Promise<number> {
    const user = await prisma.usuario.create({
      data: {
        Nombre: name,
        Correo: `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${unique}@flowmanager.test`,
        Clave: 'integration-only-not-a-login-credential',
        IdRol: roleId,
      },
      select: { Id: true },
    });
    testUserIds.push(user.Id);
    return user.Id;
  }

  async function makeEntity(name: string): Promise<number> {
    const entity = await prisma.entidad.create({
      data: { IdUsuario: ownerId, NombreCompleto: `${name} ${unique}` },
      select: { Id: true },
    });
    testEntityIds.push(entity.Id);
    return entity.Id;
  }

  async function makeInventoryItem(existence = 20): Promise<number> {
    const item = await prisma.inventarioItem.create({
      data: {
        IdUsuario: ownerId,
        IdProveedor: providerId,
        Nombre: `Ruta integration product ${unique}-${testInventoryItemIds.length}`,
        Categoria: 'PRODUCTO_TERMINADO',
        EsVendible: true,
        UnidadMedida: 'unidad',
        Existencia: existence,
        CostoPromedio: 1,
        PrecioVenta: 10,
      },
      select: { Id: true },
    });
    testInventoryItemIds.push(item.Id);
    return item.Id;
  }

  async function openSession(): Promise<number> {
    const vehicle = await prisma.vehiculo.create({
      data: {
        IdUsuario: ownerId,
        Placa: `IT-${unique}-${testVehicleIds.length}`.slice(0, 50),
        Marca: 'Integration',
        Modelo: 'SQL Server',
        Estado: 'DISPONIBLE',
      },
      select: { Id: true },
    });
    testVehicleIds.push(vehicle.Id);
    const session = await createRutaSesion({
      idRuta: routeId,
      idVehiculo: vehicle.Id,
      idUsuarioChofer: driverId,
      idUsuarioVendedor: sellerId,
      fechaSesion: new Date().toISOString().slice(0, 10),
      kmInicial: 0,
      estado: 'EN_CURSO',
    });
    testRouteSessionIds.push(session.id);
    return session.id;
  }

  async function sellFromRoute(idRutaSesion: number, idInventarioItem: number, cantidad: number) {
    return createSale({
      idUsuario: ownerId,
      idCliente: clientId,
      idRutaSesion,
      tipoRegistro: 'VENTA',
      estadoEntrega: 'EN_RUTA',
      condicionPago: 'CONTADO',
      requiereFactura: false,
      detalle: [{ idInventarioItem, cantidad, precioUnitario: 10 }],
      pagoInicial: { monto: cantidad * 10, metodoPago: 'EFECTIVO' },
    });
  }

  async function reserveFromRoute(
    idRutaSesion: number,
    idInventarioItem: number,
    cantidad: number,
    expiresAt = new Date(Date.now() + 60_000),
  ) {
    return createSale({
      idUsuario: ownerId,
      idCliente: clientId,
      idRutaSesion,
      tipoRegistro: 'PROFORMA',
      fechaExpiracionProforma: expiresAt.toISOString(),
      estadoEntrega: 'PENDIENTE',
      condicionPago: 'CONTADO',
      requiereFactura: false,
      detalle: [{ idInventarioItem, cantidad, precioUnitario: 10 }],
      pagoInicial: { monto: cantidad * 10, metodoPago: 'EFECTIVO' },
    });
  }

  async function closeSession(idRutaSesion: number) {
    return updateRutaSesion(idRutaSesion, {
      estado: 'CERRADA',
      kmFinal: 1,
      idUsuarioModificador: ownerId,
    });
  }

  beforeAll(async () => {
    const database = await prisma.$queryRaw<Array<{ databaseName: string }>>`SELECT DB_NAME() AS databaseName`;
    const databaseName = database[0]?.databaseName;
    const allowFlowManager =
      databaseName === 'FlowManager' && process.env.FLOWMANAGER_SQLSERVER_INTEGRATION === '1';
    if (databaseName !== 'FlowManager_Test' && !allowFlowManager) {
      throw new Error('Las pruebas de integración requieren FlowManager_Test o el permiso explícito para FlowManager');
    }
    process.env.JWT_SECRET = accessSecret;

    let owner: { Id: number; IdRol: number } | null = null;
    if (databaseName === 'FlowManager_Test') {
      owner = await prisma.usuario.findFirst({
        where: { Correo: 'sqlserver-integration@flowmanager.test' },
        select: { Id: true, IdRol: true },
      });
    } else {
      const adminRole = await prisma.rol.findFirst({
        where: { Nombre: 'Administrador', Anulado: false },
        select: { Id: true },
      });
      owner = adminRole
        ? await prisma.usuario.findFirst({
            where: { IdRol: adminRole.Id, Anulado: false },
            select: { Id: true, IdRol: true },
          })
        : null;
    }
    if (!owner?.IdRol) throw new Error('Falta el usuario administrador del seed de integración');
    ownerId = owner.Id;
    adminRoleId = owner.IdRol;

    const auxiliaryRole = await prisma.rol.findFirst({
      where: { Nombre: 'Auxiliar de Planta', Anulado: false },
      select: { Id: true },
    });
    if (!auxiliaryRole) throw new Error('Falta el rol Auxiliar de Planta del seed');
    noLogisticsRoleId = auxiliaryRole.Id;
    const route = await prisma.ruta.create({
      data: { IdUsuario: ownerId, Nombre: `SQL Server route ${unique}` },
      select: { Id: true },
    });
    routeId = route.Id;

    driverId = await makeUser('Integration driver', adminRoleId);
    sellerId = await makeUser('Integration seller', adminRoleId);
    const [driverEntityId, sellerEntityId, providerEntityId, clientEntityId] = await Promise.all([
      makeEntity('Integration driver'),
      makeEntity('Integration seller'),
      makeEntity('Integration provider'),
      makeEntity('Integration customer'),
    ]);
    await prisma.empleado.create({
      data: {
        IdEntidad: driverEntityId,
        IdUsuario: ownerId,
        IdUsuarioVinculado: driverId,
        PuestoTrabajo: 'Chofer',
        FechaContratacion: new Date(),
        SueldoBase: 1,
      },
    });
    await prisma.empleado.create({
      data: {
        IdEntidad: sellerEntityId,
        IdUsuario: ownerId,
        IdUsuarioVinculado: sellerId,
        PuestoTrabajo: 'Vendedor',
        FechaContratacion: new Date(),
        SueldoBase: 1,
      },
    });
    const provider = await prisma.proveedor.create({
      data: { IdEntidad: providerEntityId, IdUsuario: ownerId },
      select: { Id: true },
    });
    providerId = provider.Id;
    const client = await prisma.cliente.create({
      data: { IdEntidad: clientEntityId, IdUsuario: ownerId },
      select: { Id: true },
    });
    clientId = client.Id;

    const deniedUserId = await makeUser('Integration no logistics', noLogisticsRoleId);
    [adminCredential, deniedCredential] = await Promise.all([
      credentialFor(ownerId),
      credentialFor(deniedUserId),
    ]);
  }, 60_000);

  afterAll(async () => {
    if (!ownerId) return;
    const routeSessionFilter = { IdRutaSesion: { in: testRouteSessionIds } };
    await prisma.ajusteRuta.deleteMany({ where: routeSessionFilter });
    await prisma.devolucionRutaDetalle.deleteMany({ where: { DevolucionRuta: routeSessionFilter } });
    await prisma.devolucionRuta.deleteMany({ where: routeSessionFilter });
    await prisma.despachoRutaDetalle.deleteMany({ where: { DespachoRuta: routeSessionFilter } });
    await prisma.despachoRuta.deleteMany({ where: routeSessionFilter });
    await prisma.pagoVenta.deleteMany({ where: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } });
    await prisma.reservaProformaDetalle.deleteMany({
      where: { ReservaProforma: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } },
    });
    await prisma.reservaProforma.deleteMany({ where: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } });
    await prisma.devolucionComercialDetalle.deleteMany({
      where: { DevolucionComercial: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } },
    });
    await prisma.devolucionComercial.deleteMany({
      where: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } },
    });
    await prisma.detalleVenta.deleteMany({ where: { Venta: { IdRutaSesion: { in: testRouteSessionIds } } } });
    await prisma.venta.deleteMany({ where: { IdRutaSesion: { in: testRouteSessionIds } } });
    await prisma.rutaSesion.deleteMany({ where: { Id: { in: testRouteSessionIds } } });
    await prisma.bitacoraInventario.deleteMany({ where: { IdInventarioItem: { in: testInventoryItemIds } } });
    await prisma.inventarioItem.deleteMany({ where: { Id: { in: testInventoryItemIds } } });
    await prisma.vehiculo.deleteMany({ where: { Id: { in: testVehicleIds } } });
    if (clientId) await prisma.cliente.deleteMany({ where: { Id: clientId } });
    if (providerId) await prisma.proveedor.deleteMany({ where: { Id: providerId } });
    await prisma.empleado.deleteMany({ where: { IdUsuarioVinculado: { in: [driverId, sellerId] } } });
    await prisma.ruta.deleteMany({ where: { Id: routeId } });
    await prisma.sesion.deleteMany({ where: { Id: { in: testSessionIds } } });
    await prisma.entidad.deleteMany({ where: { Id: { in: testEntityIds } } });
    await prisma.usuario.deleteMany({ where: { Id: { in: testUserIds } } });
    await prisma.$disconnect();
  }, 60_000);

  it('opens a route through the endpoint and enforces authentication and persisted permissions', async () => {
    const vehicle = await prisma.vehiculo.create({
      data: {
        IdUsuario: ownerId,
        Placa: `IT-AUTH-${unique}`.slice(0, 50),
        Marca: 'Integration',
        Modelo: 'SQL Server',
        Estado: 'DISPONIBLE',
      },
      select: { Id: true },
    });
    testVehicleIds.push(vehicle.Id);

    const body = {
      idRuta: routeId,
      idVehiculo: vehicle.Id,
      idUsuarioChofer: driverId,
      idUsuarioVendedor: sellerId,
      fechaSesion: new Date().toISOString().slice(0, 10),
      kmInicial: 0,
      estado: 'EN_CURSO',
    };
    const app = createApp();
    const noToken = await request(app).post('/api/logistics/rutas/sesiones').send(body);
    expect(noToken.status).toBe(401);

    const denied = await request(app)
      .post('/api/logistics/rutas/sesiones')
      .set('Authorization', `Bearer ${deniedCredential.token}`)
      .send(body);
    expect(denied.status).toBe(403);

    const opened = await request(app)
      .post('/api/logistics/rutas/sesiones')
      .set('Authorization', `Bearer ${adminCredential.token}`)
      .send(body);
    if (opened.body?.data?.id) testRouteSessionIds.push(opened.body.data.id);
    expect(opened.status).toBe(201);
    expect(opened.body.data).toMatchObject({
      idRuta: routeId,
      idVehiculo: vehicle.Id,
      idUsuarioChofer: driverId,
      idUsuarioVendedor: sellerId,
      estado: 'EN_CURSO',
    });
  });

  it('serializes competing dispatches, rejects insufficient plant stock, and records one plant movement', async () => {
    const itemId = await makeInventoryItem(10);
    const sessionId = await openSession();
    const app = createApp();
    const dispatch = () =>
      request(app)
        .post(`/api/logistics/rutas/sesiones/${sessionId}/despacho`)
        .set('Authorization', `Bearer ${adminCredential.token}`)
        .send({ detalle: [{ idInventarioItem: itemId, cantidad: 6 }] });

    const responses = await Promise.all([dispatch(), dispatch()]);
    expect(responses.map((response) => ({ status: response.status, message: response.body.message }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 201 }),
        expect.objectContaining({ status: 409 }),
      ]),
    );

    const anotherSessionId = await openSession();
    await expect(
      createRouteDispatch(anotherSessionId, ownerId, {
        detalle: [{ idInventarioItem: itemId, cantidad: 5 }],
      }),
    ).rejects.toThrow(/Stock insuficiente/);

    const [item, movements, dispatches] = await Promise.all([
      prisma.inventarioItem.findUnique({ where: { Id: itemId }, select: { Existencia: true } }),
      prisma.bitacoraInventario.findMany({
        where: { IdInventarioItem: itemId, TipoDocumento: 'DES' },
      }),
      prisma.despachoRuta.count({ where: { IdRutaSesion: sessionId } }),
    ]);
    expect(item?.Existencia).toBe(4);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      TipoMovimiento: false,
      Cantidad: 6,
      ExistenciaAnterior: 10,
      NuevaExistencia: 4,
    });
    expect(dispatches).toBe(1);
  }, 30_000);

  it('consumes route stock once, atomically rolls back failed sales, and arbitrates sale/annulment races', async () => {
    const itemId = await makeInventoryItem(12);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 6 }],
    });
    const plantStockAfterDispatch = (await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia;

    await expect(
      createSale({
        idUsuario: ownerId,
        idCliente: clientId,
        idRutaSesion: sessionId,
        tipoRegistro: 'VENTA',
        estadoEntrega: 'EN_RUTA',
        condicionPago: 'CONTADO',
        requiereFactura: true,
        detalle: [{ idInventarioItem: itemId, cantidad: 1, precioUnitario: 10 }],
        pagoInicial: { monto: 10, metodoPago: 'EFECTIVO' },
      }),
    ).rejects.toThrow(/FEL:/);
    expect(await prisma.venta.count({ where: { IdRutaSesion: sessionId } })).toBe(0);
    expect((await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia).toBe(plantStockAfterDispatch);

    const competingSales = await Promise.allSettled([
      sellFromRoute(sessionId, itemId, 4),
      sellFromRoute(sessionId, itemId, 4),
    ]);
    expect(competingSales.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const activeSale = await prisma.venta.findFirstOrThrow({
      where: { IdRutaSesion: sessionId, Anulado: false },
      select: { Id: true },
    });

    const race = await Promise.allSettled([
      anulateSale(activeSale.Id, ownerId),
      sellFromRoute(sessionId, itemId, 2),
    ]);
    expect(race.some((result) => result.status === 'fulfilled')).toBe(true);
    const [remaining, stock, movements] = await Promise.all([
      prisma.venta.findMany({
        where: { IdRutaSesion: sessionId, Anulado: false, TipoRegistro: 'VENTA' },
        select: { DetalleVenta: { where: { Anulado: false }, select: { Cantidad: true } } },
      }),
      prisma.inventarioItem.findUniqueOrThrow({ where: { Id: itemId }, select: { Existencia: true } }),
      prisma.bitacoraInventario.findMany({ where: { IdInventarioItem: itemId } }),
    ]);
    const activeQuantity = remaining.flatMap((sale) => sale.DetalleVenta).reduce((sum, line) => sum + line.Cantidad, 0);
    expect(activeQuantity).toBeLessThanOrEqual(6);
    expect(stock.Existencia).toBe(plantStockAfterDispatch);
    expect(movements).toHaveLength(1);
  }, 30_000);

  it('reserves truck stock concurrently, converts once without a second plant deduction, and releases on cancellation or expiry', async () => {
    const itemId = await makeInventoryItem(12);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 6 }],
    });
    const plantStockAfterDispatch = (await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia;

    const app = createApp();
    const missingExpiration = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${adminCredential.token}`)
      .send({
        idUsuario: ownerId,
        idCliente: clientId,
        idRutaSesion: sessionId,
        tipoRegistro: 'PROFORMA',
        condicionPago: 'CONTADO',
        requiereFactura: false,
        detalle: [{ idInventarioItem: itemId, cantidad: 1, precioUnitario: 10 }],
        pagoInicial: { monto: 10, metodoPago: 'EFECTIVO' },
      });
    expect(missingExpiration.status).toBe(400);

    const concurrentReservations = await Promise.allSettled([
      reserveFromRoute(sessionId, itemId, 4),
      reserveFromRoute(sessionId, itemId, 4),
    ]);
    expect(concurrentReservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const activeReservationSale = await prisma.venta.findFirstOrThrow({
      where: { IdRutaSesion: sessionId, TipoRegistro: 'PROFORMA', Anulado: false },
      select: { Id: true },
    });
    const inventoryWithReservation = await getRouteInventory(sessionId);
    expect(inventoryWithReservation.productos[0]).toMatchObject({
      reservado: 4,
      disponible: 2,
      pendienteConciliacion: 6,
    });
    expect((await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia).toBe(plantStockAfterDispatch);

    const deniedConfirmation = await request(app)
    .post(`/api/ventas/${activeReservationSale.Id}/confirmar-proforma`)
    .set('Authorization', `Bearer ${deniedCredential.token}`);
    expect(deniedConfirmation.status).toBe(403);

    const conversions = await Promise.all([
      request(app)
        .post(`/api/ventas/${activeReservationSale.Id}/confirmar-proforma`)
        .set('Authorization', `Bearer ${adminCredential.token}`),
      request(app)
        .post(`/api/ventas/${activeReservationSale.Id}/confirmar-proforma`)
        .set('Authorization', `Bearer ${adminCredential.token}`),
    ]);
    expect(conversions.map((response) => response.status).sort()).toEqual([200, 409]);
    const converted = conversions.find((response) => response.status === 200);
    expect(converted?.body.data).toMatchObject({
      tipoRegistro: 'VENTA',
      reservaProforma: { estado: 'CONSUMIDA' },
    });

    const [convertedReservation, afterConversion, movements] = await Promise.all([
      prisma.reservaProforma.findUniqueOrThrow({ where: { IdVenta: activeReservationSale.Id } }),
      getRouteInventory(sessionId),
      prisma.bitacoraInventario.findMany({ where: { IdInventarioItem: itemId } }),
    ]);
    expect(convertedReservation.Estado).toBe('CONSUMIDA');
    expect(afterConversion.productos[0]).toMatchObject({ reservado: 0, vendido: 4, disponible: 2 });
    expect(movements.map((movement) => movement.TipoDocumento)).toEqual(['DES']);
    expect((await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia).toBe(plantStockAfterDispatch);

    const cancellationSession = await openSession();
    await createRouteDispatch(cancellationSession, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 3 }],
    });
    const cancellableProforma = await reserveFromRoute(cancellationSession, itemId, 2);
    await anulateSale(cancellableProforma.id, ownerId);
    expect((await prisma.reservaProforma.findUniqueOrThrow({
      where: { IdVenta: cancellableProforma.id },
    })).Estado).toBe('LIBERADA');
    expect((await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia).toBe(plantStockAfterDispatch - 3);

    const expirySession = await openSession();
    await createRouteDispatch(expirySession, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 2 }],
    });
    const expiringProforma = await reserveFromRoute(
      expirySession,
      itemId,
      1,
      new Date(Date.now() + 1_500),
    );
    const stopExpiryWorker = startProformaReservationExpiryWorker(25);
    try {
      const deadline = Date.now() + 5_000;
      let state = 'ACTIVA';
      while (Date.now() < deadline && state === 'ACTIVA') {
        await new Promise((resolve) => setTimeout(resolve, 25));
        const reservation = await prisma.reservaProforma.findUniqueOrThrow({
          where: { IdVenta: expiringProforma.id },
          select: { Estado: true },
        });
        state = reservation.Estado;
      }
      expect(state).toBe('VENCIDA');
    } finally {
      stopExpiryWorker();
    }
    const afterExpiry = await getRouteInventory(expirySession);
    expect(afterExpiry.productos[0]).toMatchObject({ reservado: 0, disponible: 2 });
  }, 60_000);

  it('blocks route closure while an active proforma reservation is unconverted', async () => {
    const itemId = await makeInventoryItem(8);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 3 }],
    });
    await reserveFromRoute(sessionId, itemId, 3);

    await expect(closeSession(sessionId)).rejects.toThrow(/proformas sin confirmar/);
  }, 30_000);

  it('reconciles sellable and damaged returns, records authorized differences, and closes only a reconciled route', async () => {
    const itemId = await makeInventoryItem(15);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 6 }],
    });
    await sellFromRoute(sessionId, itemId, 2);

    await expect(closeSession(sessionId)).rejects.toThrow(/pendientes/);
    await createRouteReturn(sessionId, ownerId, {
      detalle: [{
        idInventarioItem: itemId,
        cantidadRecibida: 4,
        cantidadDanada: 1,
        ubicacionDanada: 'Área no vendible de planta',
      }],
    });
    const afterReturn = await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    });
    expect(afterReturn.Existencia).toBe(9);

    await closeSession(sessionId);
    const [afterClose, returnDetail, returnMovements] = await Promise.all([
      prisma.inventarioItem.findUniqueOrThrow({ where: { Id: itemId }, select: { Existencia: true } }),
      prisma.devolucionRutaDetalle.findFirstOrThrow({
        where: { DevolucionRuta: { IdRutaSesion: sessionId } },
        select: { UbicacionDanada: true },
      }),
      prisma.bitacoraInventario.findMany({
        where: { TipoDocumento: 'DEV', Documento: { not: null }, IdInventarioItem: itemId },
      }),
    ]);
    expect(afterClose.Existencia).toBe(12);
    expect(returnDetail.UbicacionDanada).toBe('Área no vendible de planta');
    expect(returnMovements.filter((movement) => movement.Documento !== null)).toHaveLength(1);
    await expect(sellFromRoute(sessionId, itemId, 1)).rejects.toThrow(/cerrada/i);
    await expect(
      createRouteReturn(sessionId, ownerId, { detalle: [] }),
    ).rejects.toThrow(/EN_CURSO/);

    const adjustmentSessionId = await openSession();
    await createRouteDispatch(adjustmentSessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 3 }],
    });
    await createRouteReturn(adjustmentSessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidadRecibida: 2, cantidadDanada: 0 }],
    });
    await createRouteAdjustment(adjustmentSessionId, ownerId, {
      idInventarioItem: itemId,
      clasificacion: 'FALTANTE',
      cantidad: 1,
      motivo: 'Diferencia confirmada durante prueba de integración',
    });
    await closeSession(adjustmentSessionId);
    const adjustment = await prisma.ajusteRuta.findFirstOrThrow({
      where: { IdRutaSesion: adjustmentSessionId },
    });
    expect(adjustment).toMatchObject({ Clasificacion: 'FALTANTE', Cantidad: 1, IdUsuario: ownerId });
  }, 30_000);

  it('authorizes partial commercial returns, supports resale, and transfers only verified sellable stock at closure', async () => {
    const itemId = await makeInventoryItem(20);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 10 }],
    });
    await sellFromRoute(sessionId, itemId, 6);

    const sale = await prisma.venta.findFirstOrThrow({
      where: { IdRutaSesion: sessionId, TipoRegistro: 'VENTA', Anulado: false },
      select: {
        Id: true,
        DetalleVenta: { where: { Anulado: false }, select: { Id: true } },
      },
    });
    const saleLineId = sale.DetalleVenta[0]!.Id;
    const app = createApp();
    const vendibleKey = randomUUID();
    const sellableReturn = {
      detalle: [{
        idDetalleVenta: saleLineId,
        cantidad: 1,
        motivo: 'Empaque intacto y aceptado para reventa',
        condicionFisica: 'VENDIBLE',
      }],
    };

    const denied = await request(app)
      .post(`/api/ventas/${sale.Id}/devoluciones-comerciales`)
      .set('Authorization', `Bearer ${deniedCredential.token}`)
      .set('Idempotency-Key', vendibleKey)
      .send(sellableReturn);
    expect(denied.status).toBe(403);

    const repeatedRequests = await Promise.all([0, 1].map(() =>
      request(app)
        .post(`/api/ventas/${sale.Id}/devoluciones-comerciales`)
        .set('Authorization', `Bearer ${adminCredential.token}`)
        .set('Idempotency-Key', vendibleKey)
        .send(sellableReturn),
    ));
    expect(repeatedRequests.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(repeatedRequests[0]?.body.data.id).toBe(repeatedRequests[1]?.body.data.id);

    const damagedReturn = await request(app)
      .post(`/api/ventas/${sale.Id}/devoluciones-comerciales`)
      .set('Authorization', `Bearer ${adminCredential.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        detalle: [{
          idDetalleVenta: saleLineId,
          cantidad: 1,
          motivo: 'Empaque dañado',
          condicionFisica: 'DANADO',
          ubicacionNoVendible: 'Compartimento segregado del vehículo',
        }],
      });
    expect(damagedReturn.status).toBe(201);

    const competingReturns = await Promise.all([0, 1].map(() =>
      request(app)
        .post(`/api/ventas/${sale.Id}/devoluciones-comerciales`)
        .set('Authorization', `Bearer ${adminCredential.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          detalle: [{
            idDetalleVenta: saleLineId,
            cantidad: 3,
            motivo: 'Devolución parcial concurrente',
            condicionFisica: 'VENDIBLE',
          }],
        }),
    ));
    expect(competingReturns.map((response) => response.status).sort()).toEqual([201, 409]);

    const returnedInventory = await getRouteInventory(sessionId);
    expect(returnedInventory.productos[0]).toMatchObject({
      vendido: 6,
      devolucionComercial: 5,
      noVendibleComercial: 1,
      pendienteConciliacion: 9,
      disponible: 8,
    });
    expect((await prisma.inventarioItem.findUniqueOrThrow({
      where: { Id: itemId },
      select: { Existencia: true },
    })).Existencia).toBe(10);
    expect(await prisma.pagoVenta.count({ where: { IdVenta: sale.Id, Anulado: false } })).toBe(1);
    expect(await prisma.cuentaPorCobrar.count({ where: { IdVenta: sale.Id } })).toBe(0);

    const excessReturn = await request(app)
      .post(`/api/ventas/${sale.Id}/devoluciones-comerciales`)
      .set('Authorization', `Bearer ${adminCredential.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        detalle: [{
          idDetalleVenta: saleLineId,
          cantidad: 2,
          motivo: 'Intento de exceder cantidad',
          condicionFisica: 'VENDIBLE',
        }],
      });
    expect(excessReturn.status).toBe(409);

    await sellFromRoute(sessionId, itemId, 1);
    await expect(anulateSale(sale.Id, ownerId)).rejects.toThrow(
      'No se puede anular una venta que tiene devoluciones comerciales autorizadas',
    );
    await createRouteReturn(sessionId, ownerId, {
      detalle: [{
        idInventarioItem: itemId,
        cantidadRecibida: 8,
        cantidadDanada: 1,
        ubicacionDanada: 'Área no vendible de planta',
      }],
    });
    await closeSession(sessionId);

    const [plantInventory, commercialDetails, returnMovements] = await Promise.all([
      prisma.inventarioItem.findUniqueOrThrow({
        where: { Id: itemId },
        select: { Existencia: true },
      }),
      prisma.devolucionComercialDetalle.findMany({
        where: { DevolucionComercial: { IdVenta: sale.Id } },
        select: { CondicionFisica: true, Cantidad: true, UbicacionNoVendible: true },
      }),
      prisma.bitacoraInventario.findMany({
        where: { TipoDocumento: 'DEV', IdInventarioItem: itemId },
        select: { Cantidad: true, TipoMovimiento: true },
      }),
    ]);
    expect(plantInventory.Existencia).toBe(17);
    expect(commercialDetails).toHaveLength(3);
    expect(commercialDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({ CondicionFisica: 'VENDIBLE', Cantidad: 1, UbicacionNoVendible: null }),
      expect.objectContaining({
        CondicionFisica: 'DANADO',
        Cantidad: 1,
        UbicacionNoVendible: 'Compartimento segregado del vehículo',
      }),
      expect.objectContaining({ CondicionFisica: 'VENDIBLE', Cantidad: 3, UbicacionNoVendible: null }),
    ]));
    expect(returnMovements).toEqual([{ Cantidad: 7, TipoMovimiento: true }]);
  }, 60_000);

  it('races a physical return against route closure and rejects duplicate closures', async () => {
    const itemId = await makeInventoryItem(9);
    const sessionId = await openSession();
    await createRouteDispatch(sessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 3 }],
    });
    const race = await Promise.allSettled([
      createRouteReturn(sessionId, ownerId, {
        detalle: [{ idInventarioItem: itemId, cantidadRecibida: 3, cantidadDanada: 0 }],
      }),
      closeSession(sessionId),
    ]);
    expect(race.some((result) => result.status === 'fulfilled')).toBe(true);
    const current = await prisma.rutaSesion.findUniqueOrThrow({
      where: { Id: sessionId },
      select: { Estado: true, DevolucionRuta: { select: { Id: true } } },
    });
    expect(current.DevolucionRuta).not.toBeNull();
    if (current.Estado !== 'CERRADA') await closeSession(sessionId);
    expect(await prisma.bitacoraInventario.count({
      where: { TipoDocumento: 'DEV', IdInventarioItem: itemId },
    })).toBe(1);

    const doubleCloseSessionId = await openSession();
    await createRouteDispatch(doubleCloseSessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidad: 2 }],
    });
    await createRouteReturn(doubleCloseSessionId, ownerId, {
      detalle: [{ idInventarioItem: itemId, cantidadRecibida: 2, cantidadDanada: 0 }],
    });
    const closeResults = await Promise.allSettled([
      closeSession(doubleCloseSessionId),
      closeSession(doubleCloseSessionId),
    ]);
    expect(closeResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.bitacoraInventario.count({
      where: { TipoDocumento: 'DEV', IdInventarioItem: itemId },
    })).toBe(2);
    const closed = await prisma.rutaSesion.findUniqueOrThrow({
      where: { Id: doubleCloseSessionId },
      select: { Estado: true, FechaCierre: true, IdUsuarioCierre: true },
    });
    expect(closed).toMatchObject({ Estado: 'CERRADA', IdUsuarioCierre: ownerId });
    expect(closed.FechaCierre).toBeInstanceOf(Date);
  });
});
