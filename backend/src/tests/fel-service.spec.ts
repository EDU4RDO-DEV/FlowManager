import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    empresa: { findFirst: vi.fn() },
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { anulateFelInvoice, emitFelInvoice } from '../services/fel.service';

let server: Server | undefined;
let originalEnvironment: Record<string, string | undefined>;

const felEnvironmentKeys = [
  'FEL_ENVIRONMENT',
  'FEL_BASE_URL_SANDBOX',
  'FEL_CLIENTE_SANDBOX',
  'FEL_USUARIO_SANDBOX',
  'FEL_CLAVE_SANDBOX',
  'FEL_NIT_EMISOR_SANDBOX',
  'FEL_USE_MOCK_SANDBOX',
  'FEL_ALLOW_FALLBACK_SANDBOX',
  'FEL_VALIDATE_NIT_BEFORE_EMIT_SANDBOX',
];

function buildInput() {
  return {
    idVenta: 7,
    numeroVenta: 1007,
    nitFacturado: 'CF',
    nombreClienteFacturado: 'Cliente de prueba',
    items: [{ nombre: 'Producto', cantidad: 1, precioUnitario: 10, esBonificacion: false }],
    total: 10,
    fechaEmision: new Date('2026-10-15T12:00:00.000Z'),
  };
}

async function listenLocalServer(handler: Parameters<typeof createServer>[0]): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

beforeEach(() => {
  originalEnvironment = Object.fromEntries(felEnvironmentKeys.map((key) => [key, process.env[key]]));
  process.env.FEL_ENVIRONMENT = 'sandbox';
  process.env.FEL_CLIENTE_SANDBOX = 'cliente';
  process.env.FEL_USUARIO_SANDBOX = 'usuario';
  process.env.FEL_CLAVE_SANDBOX = 'secret';
  process.env.FEL_NIT_EMISOR_SANDBOX = '1234567';
  process.env.FEL_USE_MOCK_SANDBOX = 'false';
  process.env.FEL_ALLOW_FALLBACK_SANDBOX = 'false';
  process.env.FEL_VALIDATE_NIT_BEFORE_EMIT_SANDBOX = 'true';
  prismaMock.empresa.findFirst.mockResolvedValue({
    Nit: '1234567',
    NombreComercial: 'Empresa prueba',
    Nombre: 'Empresa prueba',
  });
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = undefined;
  for (const key of felEnvironmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.restoreAllMocks();
});

describe('FEL provider response handling', () => {
  it('requires an explicit environment instead of silently selecting sandbox', async () => {
    delete process.env.FEL_ENVIRONMENT;

    await expect(emitFelInvoice(buildInput())).rejects.toThrow(
      'FEL: FEL_ENVIRONMENT debe ser production o sandbox',
    );
  });

  it('accepts an emission only when provider authorization and certification date are valid', async () => {
    let requestBody = '';
    const baseUrl = await listenLocalServer((request, response) => {
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        requestBody += chunk;
      });
      request.on('end', () => {
        response.writeHead(200, { 'Content-Type': 'text/xml' });
        response.end(
          '<Respuesta><DTE NumeroAutorizacion="123e4567-e89b-12d3-a456-426614174000" Serie="FEL" Numero="42" FechaCertificacion="2026-10-15T12:34:56-06:00"/></Respuesta>',
        );
      });
    });
    process.env.FEL_BASE_URL_SANDBOX = baseUrl;
    process.env.FEL_CLAVE_SANDBOX = 'secret<&>';

    const result = await emitFelInvoice(buildInput());

    expect(result).toMatchObject({
      autorizacionFel: '123e4567-e89b-12d3-a456-426614174000',
      serieFel: 'FEL',
      numeroFel: '42',
    });
    expect(result.fechaEmisionFel.toISOString()).toBe('2026-10-15T18:34:56.000Z');
    expect(requestBody).toContain('<Clave>secret&lt;&amp;&gt;</Clave>');
  });

  it('rejects incomplete provider responses instead of falling back to a simulated invoice', async () => {
    const baseUrl = await listenLocalServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/xml' });
      response.end(
        '<Respuesta><DTE NumeroAutorizacion="123e4567-e89b-12d3-a456-426614174000" Serie="FEL" Numero="42"/></Respuesta>',
      );
    });
    process.env.FEL_BASE_URL_SANDBOX = baseUrl;
    process.env.FEL_ALLOW_FALLBACK_SANDBOX = 'true';

    await expect(emitFelInvoice(buildInput())).rejects.toThrow(
      'FEL: Respuesta de emisión sin datos de autorización',
    );
  });

  it('returns annulment confirmation only after a valid provider cancellation date', async () => {
    let requestPath = '';
    const baseUrl = await listenLocalServer((request, response) => {
      requestPath = request.url ?? '';
      response.writeHead(200, { 'Content-Type': 'text/xml' });
      response.end('<Respuesta><DTE FechaAnulacion="2026-10-15T12:34:56-06:00"/></Respuesta>');
    });
    process.env.FEL_BASE_URL_SANDBOX = baseUrl;

    const result = await anulateFelInvoice({
      idVenta: 7,
      numeroVenta: 1007,
      autorizacionFel: '123e4567-e89b-12d3-a456-426614174000',
      serieFel: 'FEL',
      numeroFel: '42',
      motivo: 'ANULACION VENTA 1007',
      fechaAnulacion: new Date('2026-10-15T12:00:00.000Z'),
    });

    expect(result.confirmada).toBe(true);
    expect(requestPath).toBe('/fel/aanulacion');
    expect(result.fechaAnulacionFel?.toISOString()).toBe('2026-10-15T18:34:56.000Z');
  });
});
