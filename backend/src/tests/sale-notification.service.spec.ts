import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('../services/notification.service', () => ({
  NotificationEvents: {
    PEDIDO_CREADO: 'PEDIDO_CREADO',
    PAGO_RECIBIDO: 'PAGO_RECIBIDO',
    VENTA_ANULADA: 'VENTA_ANULADA',
    FACTURA_EMITIDA: 'FACTURA_EMITIDA',
    PEDIDO_ENTREGADO: 'PEDIDO_ENTREGADO',
  },
  send: sendMock,
}));

// sale.service.ts importa prisma a nivel de módulo; no se usa en estas pruebas
// (solo se ejercitan las funciones puras/plumbing de notificación), pero debe
// mockearse para poder importar el archivo sin una conexión real a SQL Server.
vi.mock('../config/prisma', () => ({
  prisma: {},
}));

import {
  buildPedidoCreadoDatos,
  notifyPedidoCreado,
  buildPagoRecibidoDatos,
  notifyPagoRecibido,
  buildVentaAnuladaDatos,
  notifyVentaAnulada,
  buildFacturaEmitidaDatos,
  notifyFacturaEmitida,
  buildPedidoEntregadoDatos,
  notifyPedidoEntregado,
} from '../services/sale.service';

function buildSaleDto() {
  return {
    id: 42,
    numeroVenta: 1007,
    idUsuario: 9,
    total: 150.5,
    condicionPago: 'CONTADO',
    estadoPago: 'PAGADO',
    fechaRegistro: new Date('2026-10-03T12:00:00.000Z'),
    cliente: { id: 3, nombre: 'Cliente de Prueba' },
    detalle: [
      { idInventarioItem: 1, cantidad: 2 },
      { idInventarioItem: 2, cantidad: 1 },
    ],
  } as unknown as Parameters<typeof buildPedidoCreadoDatos>[0];
}

describe('Fase 21 - datos del evento PEDIDO_CREADO', () => {
  it('construye "datos" con id=numeroVenta y los campos reales de la venta', () => {
    const datos = buildPedidoCreadoDatos(buildSaleDto());

    expect(datos).toEqual({
      id: 1007,
      cliente: 'Cliente de Prueba',
      productos: 2,
      total: 150.5,
      pago: 'CONTADO',
      estado: 'PAGADO',
    });
  });
});

describe('Fase 21 - notifyPedidoCreado (fire-and-forget)', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invoca send(PEDIDO_CREADO, datos) exactamente una vez con los datos de la venta', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    notifyPedidoCreado(buildSaleDto());
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      'PEDIDO_CREADO',
      expect.objectContaining({ id: 1007, cliente: 'Cliente de Prueba' }),
    );
  });

  it('no lanza excepción cuando n8n responde con un fallo clasificado (http_server_error)', async () => {
    sendMock.mockResolvedValueOnce({
      ok: false,
      reason: 'http_server_error',
      status: 503,
      message: 'n8n respondió HTTP 503',
    });

    expect(() => notifyPedidoCreado(buildSaleDto())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('venta #1007'),
    );
  });

  it('no lanza excepción cuando send rechaza inesperadamente (defensa adicional)', async () => {
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado'));

    expect(() => notifyPedidoCreado(buildSaleDto())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalled();
  });

  it('nunca incluye el secreto del webhook en el log de error', async () => {
    sendMock.mockResolvedValueOnce({
      ok: false,
      reason: 'network_error',
      message: 'ECONNREFUSED',
    });

    notifyPedidoCreado(buildSaleDto());
    await Promise.resolve();
    await Promise.resolve();

    const loggedArgs = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ');
    expect(loggedArgs).not.toMatch(/secret|webhook-secret/i);
  });
});

function buildPagoDto() {
  return {
    numeroVenta: 1007,
    cliente: 'Cliente de Prueba',
    monto: 500,
    metodoPago: 'EFECTIVO',
    estadoPago: 'PARCIAL',
    saldo: 1200,
  };
}

describe('Fase 23 - datos y notificación del evento PAGO_RECIBIDO', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construye "datos" con los campos reales del pago', () => {
    expect(buildPagoRecibidoDatos(buildPagoDto())).toEqual(buildPagoDto());
  });

  it('invoca send(PAGO_RECIBIDO, datos) exactamente una vez', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    notifyPagoRecibido(buildPagoDto());
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('PAGO_RECIBIDO', buildPagoDto());
  });

  it('no lanza excepción cuando send falla (fire-and-forget)', async () => {
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado'));

    expect(() => notifyPagoRecibido(buildPagoDto())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalled();
  });
});

function buildVentaAnuladaDto() {
  return { numeroVenta: 1007, cliente: 'Cliente de Prueba' };
}

describe('Fase 23 - datos y notificación del evento VENTA_ANULADA', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construye "datos" con numeroVenta y cliente', () => {
    expect(buildVentaAnuladaDatos(buildVentaAnuladaDto())).toEqual(buildVentaAnuladaDto());
  });

  it('invoca send(VENTA_ANULADA, datos) exactamente una vez', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    notifyVentaAnulada(buildVentaAnuladaDto());
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('VENTA_ANULADA', buildVentaAnuladaDto());
  });

  it('no lanza excepción cuando send falla (fire-and-forget)', async () => {
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado'));

    expect(() => notifyVentaAnulada(buildVentaAnuladaDto())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalled();
  });
});

function buildSaleDtoConFel() {
  return {
    ...buildSaleDto(),
    autorizacionFel: 'AUTH-123',
    numeroFel: 'FEL-456',
    serieFel: 'A',
  } as unknown as Parameters<typeof buildFacturaEmitidaDatos>[0];
}

describe('Fase 23 - datos y notificación del evento FACTURA_EMITIDA', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construye "datos" con los campos FEL reales del DTO de la venta', () => {
    const datos = buildFacturaEmitidaDatos(buildSaleDtoConFel());

    expect(datos).toEqual({
      numeroVenta: 1007,
      cliente: 'Cliente de Prueba',
      autorizacionFel: 'AUTH-123',
      numeroFel: 'FEL-456',
      serieFel: 'A',
      total: 150.5,
    });
  });

  it('invoca send(FACTURA_EMITIDA, datos) exactamente una vez', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    notifyFacturaEmitida(buildSaleDtoConFel());
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      'FACTURA_EMITIDA',
      expect.objectContaining({ numeroVenta: 1007, autorizacionFel: 'AUTH-123' }),
    );
  });

  it('no lanza excepción cuando send falla (fire-and-forget)', async () => {
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado'));

    expect(() => notifyFacturaEmitida(buildSaleDtoConFel())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalled();
  });
});

describe('Fase 23 - datos y notificación del evento PEDIDO_ENTREGADO', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('construye "datos" con numeroVenta y cliente', () => {
    const datos = buildPedidoEntregadoDatos(buildSaleDto());

    expect(datos).toEqual({ numeroVenta: 1007, cliente: 'Cliente de Prueba' });
  });

  it('invoca send(PEDIDO_ENTREGADO, datos) exactamente una vez', async () => {
    sendMock.mockResolvedValueOnce({ ok: true, status: 200 });

    notifyPedidoEntregado(buildSaleDto());
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('PEDIDO_ENTREGADO', { numeroVenta: 1007, cliente: 'Cliente de Prueba' });
  });

  it('no lanza excepción cuando send falla (fire-and-forget)', async () => {
    sendMock.mockRejectedValueOnce(new Error('fallo inesperado'));

    expect(() => notifyPedidoEntregado(buildSaleDto())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(console.error).toHaveBeenCalled();
  });
});
