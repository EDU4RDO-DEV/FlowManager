import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';

type FelIssueItemInput = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  esBonificacion: boolean;
};

type IssueFelInput = {
  idVenta: number;
  numeroVenta: number;
  nitFacturado: string;
  nombreClienteFacturado: string;
  direccionClienteFacturado?: string | null;
  items: FelIssueItemInput[];
  total: number;
  fechaEmision: Date;
};

type AnulateFelInput = {
  idVenta: number;
  numeroVenta: number;
  serieFel: string;
  numeroFel: string;
  motivo: string;
  fechaAnulacion: Date;
};

type FelIssueResult = {
  autorizacionFel: string;
  numeroFel: string;
  serieFel: string;
  qrFel: string;
  fechaEmisionFel: Date;
};

type ActiveFelConfig = {
  servidor: string;
  usuario: string;
  contrasena: string;
  nombreEmpresa: string;
  nitEmpresa: string;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'si', 'on'].includes(value.toLowerCase());
}

function shouldUseMockByDefault(serverUrl: string): boolean {
  if (process.env.FEL_FORCE_REAL !== undefined) {
    return !isTruthy(process.env.FEL_FORCE_REAL);
  }

  const env = (process.env.FEL_ENV ?? 'test').toLowerCase();
  if (env !== 'prod') {
    return true;
  }

  return /pruebas|test/.test(serverUrl.toLowerCase());
}

function getEmitPath() {
  return process.env.FEL_EMIT_PATH ?? '/api/fel/emitir';
}

function getAnulatePath() {
  return process.env.FEL_ANULATE_PATH ?? '/api/fel/anular';
}

function normalizeUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatFelDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

function buildFacturaXml(input: IssueFelInput, config: ActiveFelConfig): string {
  const itemsXml = input.items
    .map((item, index) => {
      const subtotal = Number((item.cantidad * item.precioUnitario).toFixed(2));

      return `
        <Item NumeroLinea="${index + 1}" BienOServicio="B">
          <Cantidad>${item.cantidad.toFixed(2)}</Cantidad>
          <UnidadMedida>UNI</UnidadMedida>
          <Descripcion>${escapeXml(item.nombre)}${item.esBonificacion ? ' (BONIFICACION)' : ''}</Descripcion>
          <PrecioUnitario>${item.precioUnitario.toFixed(2)}</PrecioUnitario>
          <Precio>${subtotal.toFixed(2)}</Precio>
          <Descuento>0.00</Descuento>
          <Total>${subtotal.toFixed(2)}</Total>
        </Item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<GTDocumento Version="0.1" xmlns="http://www.sat.gob.gt/dte/fel/0.2.0">
  <SAT ClaseDocumento="dte">
    <DTE ID="DatosCertificados">
      <DatosEmision ID="DatosEmision">
        <DatosGenerales Tipo="FACT" FechaHoraEmision="${formatFelDate(input.fechaEmision)}" Moneda="GTQ" />
        <Emisor NITEmisor="${escapeXml(config.nitEmpresa)}" NombreEmisor="${escapeXml(config.nombreEmpresa)}" CodigoEstablecimiento="1" NombreComercial="${escapeXml(config.nombreEmpresa)}" AfiliacionIVA="GEN" />
        <Receptor IDReceptor="${escapeXml(input.nitFacturado)}" NombreReceptor="${escapeXml(input.nombreClienteFacturado)}" Direccion="${escapeXml(input.direccionClienteFacturado ?? 'CIUDAD')}" />
        <Items>${itemsXml}
        </Items>
        <Totales>
          <GranTotal>${input.total.toFixed(2)}</GranTotal>
        </Totales>
      </DatosEmision>
    </DTE>
  </SAT>
</GTDocumento>`;
}

function parseFelIssueResponse(payload: unknown): FelIssueResult | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const autorizacionFel = String(
    source.autorizacionFel ?? source.autorizacion ?? source.Autorizacion ?? '',
  ).trim();
  const numeroFel = String(source.numeroFel ?? source.numero ?? source.Numero ?? '').trim();
  const serieFel = String(source.serieFel ?? source.serie ?? source.Serie ?? '').trim();
  const qrFel = String(source.qrFel ?? source.qr ?? source.QR ?? '').trim();
  const fecha = String(
    source.fechaEmisionFel ?? source.fechaEmision ?? source.FechaEmision ?? '',
  ).trim();

  if (!autorizacionFel || !numeroFel || !serieFel) {
    return null;
  }

  const fechaEmisionFel = fecha ? new Date(fecha) : new Date();

  return {
    autorizacionFel,
    numeroFel,
    serieFel,
    qrFel,
    fechaEmisionFel: Number.isNaN(fechaEmisionFel.getTime()) ? new Date() : fechaEmisionFel,
  };
}

function buildMockIssueResult(input: IssueFelInput): FelIssueResult {
  const suffix = `${input.idVenta}-${Date.now()}`;

  return {
    autorizacionFel: `PRUEBA-AUT-${suffix}`,
    numeroFel: `PRUEBA-NUM-${suffix}`,
    serieFel: 'PRUEBA',
    qrFel: `https://pruebasecofactura.com/qr/${suffix}`,
    fechaEmisionFel: new Date(),
  };
}

async function getActiveFelConfig(tx?: Prisma.TransactionClient): Promise<ActiveFelConfig> {
  const db = tx ?? prisma;

  const empresa = await db.empresa.findFirst({
    where: {
      Anulado: false,
    },
    orderBy: { Id: 'asc' },
    select: {
      ServidorFel: true,
      UsuarioFel: true,
      ContrasenaFel: true,
      NombreComercial: true,
      Nombre: true,
      Nit: true,
    },
  });

  if (!empresa) {
    throw new Error('FEL: No existe configuración de empresa activa');
  }

  const servidor = (empresa.ServidorFel ?? '').trim();
  const usuario = (empresa.UsuarioFel ?? '').trim();
  const contrasena = (empresa.ContrasenaFel ?? '').trim();

  if (!servidor || !usuario || !contrasena) {
    throw new Error('FEL: Configuración incompleta (ServidorFel, UsuarioFel, ContrasenaFel)');
  }

  return {
    servidor,
    usuario,
    contrasena,
    nombreEmpresa: empresa.NombreComercial || empresa.Nombre,
    nitEmpresa: empresa.Nit,
  };
}

export async function emitFelInvoice(input: IssueFelInput, tx?: Prisma.TransactionClient): Promise<FelIssueResult> {
  const config = await getActiveFelConfig(tx);
  const shouldMock = shouldUseMockByDefault(config.servidor);

  const xml = buildFacturaXml(input, config);

  if (shouldMock) {
    return buildMockIssueResult(input);
  }

  const endpoint = normalizeUrl(config.servidor, getEmitPath());

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usuario: config.usuario,
        contrasena: config.contrasena,
        xml,
        idVenta: input.idVenta,
        numeroVenta: input.numeroVenta,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    const parsed = parseFelIssueResponse(data);
    if (!parsed) {
      throw new Error('respuesta sin campos esperados');
    }

    return parsed;
  } catch (error) {
    if (!isTruthy(process.env.FEL_ALLOW_FALLBACK)) {
      const message = error instanceof Error ? error.message : 'falló conexión';
      throw new Error(`FEL: Error al emitir documento (${message})`);
    }

    return buildMockIssueResult(input);
  }
}

export async function anulateFelInvoice(input: AnulateFelInput, tx?: Prisma.TransactionClient): Promise<void> {
  const config = await getActiveFelConfig(tx);
  const shouldMock = shouldUseMockByDefault(config.servidor);

  if (shouldMock) {
    return;
  }

  const endpoint = normalizeUrl(config.servidor, getAnulatePath());

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        usuario: config.usuario,
        contrasena: config.contrasena,
        serie: input.serieFel,
        numero: input.numeroFel,
        motivo: input.motivo,
        fechaAnulacion: input.fechaAnulacion.toISOString(),
        idVenta: input.idVenta,
        numeroVenta: input.numeroVenta,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'falló conexión';
    throw new Error(`FEL: Error al anular documento (${message})`);
  }
}
