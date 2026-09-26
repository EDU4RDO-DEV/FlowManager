import fs from 'fs';
import path from 'path';

import type { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { uploadsRootPath } from '../utils/paths';

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
  autorizacionFel: string;
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
  rutaPdfFel: string | null;
};

type ActiveFelConfig = {
  servidor: string;
  cliente: string;
  usuario: string;
  clave: string;
  nitEmisor: string;
  afiliacionIva: string;
  establecimiento: number;
  formato: string;
  tipoDocumento: string;
  nombreEmpresa: string;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'si', 'on'].includes(value.toLowerCase());
}

function shouldUseMockByDefault(): boolean {
  if (process.env.FEL_USE_MOCK !== undefined) {
    return isTruthy(process.env.FEL_USE_MOCK);
  }

  return false;
}

function getEmitPath() {
  return process.env.FEL_EMIT_PATH ?? '/fel/adocumento';
}

function getAnulatePath() {
  return process.env.FEL_ANULATE_PATH ?? '/fel/aanulacion';
}

function getValidateNitPath() {
  return process.env.FEL_VALIDATE_NIT_PATH ?? '/fel/areceptorinfo';
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

function toFechaGT(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Cada afiliación de IVA solo puede emitir ciertos tipos de DTE (ver manual Ecofactura "Tipos de DTE por afiliación").
function resolveDefaultTipoDocumento(afiliacionIva: string): string {
  const mapa: Record<string, string> = {
    GEN: 'FACT',
    PEQ: 'FPEQ',
    PEE: 'FAPE',
    AGR: 'FACA',
    AGE: 'FAAE',
  };

  return mapa[afiliacionIva.trim().toUpperCase()] ?? 'FACT';
}

function normalizeReceptorId(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'CF' || trimmed === 'C/F' || trimmed === 'CONSUMIDORFINAL') {
    return 'CF';
  }

  return trimmed.replace(/[^A-Z0-9]/g, '');
}

function buildFacturaXml(input: IssueFelInput, config: ActiveFelConfig): string {
  const receptorId = normalizeReceptorId(input.nitFacturado);
  const isConsumidorFinal = receptorId === 'CF';
  const direccion = input.direccionClienteFacturado?.trim();

  const itemsXml = input.items
    .map((item, index) => {
      // Las bonificaciones se facturan con valor mínimo positivo y 100% de descuento (neto Q0.00),
      // porque el esquema stdTWS exige TrnVUn > 0.
      const valorUnitario = item.esBonificacion ? 0.01 : item.precioUnitario;
      const descuento = item.esBonificacion ? Number((valorUnitario * item.cantidad).toFixed(2)) : 0;

      return `
    <stdTWS.stdTWSCIt.stdTWSDIt>
      <TrnLiNum>${index + 1}</TrnLiNum>
      <TrnArtNom>${escapeXml(item.nombre)}${item.esBonificacion ? ' (BONIFICACION)' : ''}</TrnArtNom>
      <TrnCan>${item.cantidad.toFixed(6)}</TrnCan>
      <TrnVUn>${valorUnitario.toFixed(6)}</TrnVUn>
      <TrnUniMed>UNI</TrnUniMed>
      <TrnVDes>${descuento.toFixed(2)}</TrnVDes>
      <TrnArtBienSer>B</TrnArtBienSer>
      <TrnArtImpAdiCod>0</TrnArtImpAdiCod>
      <TrnArtImpAdiUniGrav>0</TrnArtImpAdiUniGrav>
    </stdTWS.stdTWSCIt.stdTWSDIt>`;
    })
    .join('');

  const nombreClienteXml =
    isConsumidorFinal && input.nombreClienteFacturado
      ? `\n    <TrnEFACECliNom>${escapeXml(input.nombreClienteFacturado)}</TrnEFACECliNom>`
      : '';
  const direccionClienteXml = direccion ? `\n    <TrnEFACECliDir>${escapeXml(direccion)}</TrnEFACECliDir>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<stdTWS xmlns="FEL">
    <TrnEstNum>${config.establecimiento}</TrnEstNum>
    <TipTrnCod>${escapeXml(config.tipoDocumento)}</TipTrnCod>
    <TrnNum>${input.numeroVenta}</TrnNum>
    <TrnFec>${toFechaGT(input.fechaEmision)}</TrnFec>
    <MonCod>GTQ</MonCod>
    <TrnBenConNIT>${escapeXml(receptorId)}</TrnBenConNIT>${nombreClienteXml}${direccionClienteXml}
    <stdTWSD>${itemsXml}
    </stdTWSD>
</stdTWS>`;
}

function extractXmlAttributeValue(xml: string, tag: string, attribute: string): string | null {
  const tagMatch = xml.match(new RegExp(`<${tag}\\b[^>]*>`, 'i'));
  if (!tagMatch) {
    return null;
  }

  const attrMatch = tagMatch[0].match(new RegExp(`${attribute}="([^"]*)"`, 'i'));
  return attrMatch ? attrMatch[1] : null;
}

function getQrBaseUrl(): string {
  return (
    process.env.FEL_QR_BASE_URL ??
    'https://felpub.c.sat.gob.gt/verificador-web/publico/vistas/verificacionDte.jsp'
  ).trim();
}

function buildQrUrl(numeroAutorizacion: string): string {
  const base = getQrBaseUrl();
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}tipo=autorizacion&numero=${encodeURIComponent(numeroAutorizacion)}`;
}

function savePdfFile(pdfBase64: string | null, fileName: string): string | null {
  if (!pdfBase64) {
    return null;
  }

  try {
    const dir = path.join(uploadsRootPath, 'sales', 'fel');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, Buffer.from(pdfBase64, 'base64'));

    return `/uploads/sales/fel/${fileName}`;
  } catch {
    return null;
  }
}

type ParsedFelIssueResponse = Omit<FelIssueResult, 'rutaPdfFel'> & { pdfBase64: string | null };

function parseFelIssueResponse(rawResponse: string): ParsedFelIssueResponse {
  const decoded = decodeXmlEntities(rawResponse);

  const fatalErrorMatch = decoded.match(/<Errores>[\s\S]*?<\/Errores>/i);
  if (fatalErrorMatch) {
    const errorTag = fatalErrorMatch[0].match(/<Error(?:\s+Codigo="(\d+)")?\s*>([^<]*)<\/Error>/i);
    const mensaje = errorTag?.[2]?.trim() || 'Error al emitir documento';
    throw new Error(`FEL: ${mensaje}`);
  }

  const numeroAutorizacion = extractXmlAttributeValue(decoded, 'DTE', 'NumeroAutorizacion');
  const serie = extractXmlAttributeValue(decoded, 'DTE', 'Serie');
  const numero = extractXmlAttributeValue(decoded, 'DTE', 'Numero');
  const fechaCertificacion = extractXmlAttributeValue(decoded, 'DTE', 'FechaCertificacion');
  const pdfBase64 = extractXmlTagValue(decoded, 'Pdf');

  if (!numeroAutorizacion || !serie || !numero) {
    throw new Error('FEL: Respuesta de emisión sin datos de autorización');
  }

  const fechaEmisionFel = fechaCertificacion ? new Date(fechaCertificacion) : new Date();

  return {
    autorizacionFel: numeroAutorizacion,
    numeroFel: numero,
    serieFel: serie,
    qrFel: buildQrUrl(numeroAutorizacion),
    fechaEmisionFel: Number.isNaN(fechaEmisionFel.getTime()) ? new Date() : fechaEmisionFel,
    pdfBase64,
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
    rutaPdfFel: null,
  };
}

function shouldValidateNitBeforeEmit(): boolean {
  if (process.env.FEL_VALIDATE_NIT_BEFORE_EMIT !== undefined) {
    return isTruthy(process.env.FEL_VALIDATE_NIT_BEFORE_EMIT);
  }

  return true;
}

function isConsumidorFinalNit(nit: string): boolean {
  const normalized = nit.trim().toUpperCase();
  return normalized === 'CF' || normalized === 'C/F' || normalized === 'CONSUMIDORFINAL';
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractXmlTagValue(xml: string, tag: string): string | null {
  if (new RegExp(`<${tag}\\s*/>`, 'i').test(xml)) {
    return null;
  }

  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

type ReceptorInfoResult = {
  nit: string;
  nombre: string;
  direccion: string | null;
};

function parseReceptorInfoResponse(rawResponse: string): ReceptorInfoResult {
  const decoded = decodeXmlEntities(rawResponse);

  const errorMatch = decoded.match(/<Error(?:\s+Codigo="(\d+)")?\s*>([^<]*)<\/Error>/i);
  if (errorMatch) {
    const codigo = errorMatch[1];
    const mensaje = errorMatch[2].trim() || 'Error al consultar NIT';

    if (codigo === '1050') {
      throw new Error(`FEL: NIT inválido (${mensaje})`);
    }

    if (codigo === '1051') {
      throw new Error(`FEL: NIT válido pero no registrado en Ecofactura (${mensaje})`);
    }

    throw new Error(`FEL: ${mensaje}`);
  }

  const nit = extractXmlTagValue(decoded, 'NIT');
  const nombre = extractXmlTagValue(decoded, 'NOMBRE');
  const direccion = extractXmlTagValue(decoded, 'DIRECCION');

  if (!nit || !nombre) {
    throw new Error('FEL: Respuesta de consulta de NIT sin datos de receptor');
  }

  return { nit, nombre, direccion: direccion || null };
}

async function fetchReceptorInfoRaw(nitReceptor: string, config: ActiveFelConfig): Promise<string> {
  const endpoint = normalizeUrl(config.servidor, getValidateNitPath());

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReceptorInfo.Execute xmlns="FEL">
      <Cliente>${escapeXml(config.cliente)}</Cliente>
      <Usuario>${escapeXml(config.usuario)}</Usuario>
      <Clave>${escapeXml(config.clave)}</Clave>
      <Receptorid>${escapeXml(nitReceptor)}</Receptorid>
    </ReceptorInfo.Execute>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'FELaction/ARECEPTORINFO.Execute',
    },
    body: envelope,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

export async function getReceptorInfo(nitReceptor: string): Promise<ReceptorInfoResult> {
  const config = await getActiveFelConfig();

  if (shouldUseMockByDefault()) {
    return {
      nit: nitReceptor,
      nombre: 'CONSUMIDOR DE PRUEBA',
      direccion: 'CIUDAD',
    };
  }

  try {
    const raw = await fetchReceptorInfoRaw(nitReceptor, config);
    return parseReceptorInfoResponse(raw);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('FEL:')) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'falló conexión';
    throw new Error(`FEL: Error al consultar receptor (${message})`);
  }
}

async function validateReceiverNit(nitReceptor: string, config: ActiveFelConfig): Promise<void> {
  if (!shouldValidateNitBeforeEmit()) {
    return;
  }

  if (isConsumidorFinalNit(nitReceptor)) {
    return;
  }

  if (shouldUseMockByDefault()) {
    return;
  }

  try {
    await getReceptorInfo(nitReceptor);
  } catch (error) {
    if (isTruthy(process.env.FEL_ALLOW_NIT_VALIDATION_FALLBACK ?? 'true')) {
      return;
    }

    throw error instanceof Error ? error : new Error('FEL: Error al validar NIT receptor');
  }
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
      Nit: true,
      NombreComercial: true,
      Nombre: true,
    },
  });

  if (!empresa) {
    throw new Error('FEL: No existe configuración de empresa activa');
  }

  const servidor = (process.env.FEL_BASE_URL ?? empresa.ServidorFel ?? '').trim();
  const usuario = (process.env.FEL_USUARIO ?? empresa.UsuarioFel ?? '').trim();
  const clave = (process.env.FEL_CLAVE ?? empresa.ContrasenaFel ?? '').trim();

  const cliente = (process.env.FEL_CLIENTE ?? empresa.Nit ?? '').trim();
  const nitEmisor = (process.env.FEL_NIT_EMISOR ?? empresa.Nit ?? '').trim();
  const afiliacionIva = (process.env.FEL_AFILIACION_IVA ?? 'PEQ').trim();
  const establecimiento = Number(process.env.FEL_ESTABLECIMIENTO ?? '1');
  const formato = (process.env.FEL_FORMAT ?? 'STD_TWS').trim();
  const tipoDocumento = (process.env.FEL_TIPO_DOCUMENTO ?? resolveDefaultTipoDocumento(afiliacionIva)).trim();

  if (!servidor || !usuario || !clave) {
    throw new Error('FEL: Configuración incompleta (ServidorFel, UsuarioFel, ContrasenaFel)');
  }

  if (!cliente || !nitEmisor) {
    throw new Error('FEL: Configuración incompleta (cliente/nit emisor)');
  }

  if (!Number.isFinite(establecimiento) || establecimiento <= 0) {
    throw new Error('FEL: FEL_ESTABLECIMIENTO inválido');
  }

  return {
    servidor,
    cliente,
    usuario,
    clave,
    nitEmisor,
    afiliacionIva,
    establecimiento,
    formato,
    tipoDocumento,
    nombreEmpresa: empresa.NombreComercial || empresa.Nombre,
  };
}

async function fetchDocumentoRaw(xmldoc: string, config: ActiveFelConfig): Promise<string> {
  const endpoint = normalizeUrl(config.servidor, getEmitPath());

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Documento.Execute xmlns="FEL">
      <Cliente>${escapeXml(config.cliente)}</Cliente>
      <Usuario>${escapeXml(config.usuario)}</Usuario>
      <Clave>${escapeXml(config.clave)}</Clave>
      <Nitemisor>${escapeXml(config.nitEmisor)}</Nitemisor>
      <Xmldoc>${escapeXml(xmldoc)}</Xmldoc>
    </Documento.Execute>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'FELaction/ADOCUMENTO.Execute',
    },
    body: envelope,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

export async function emitFelInvoice(input: IssueFelInput, tx?: Prisma.TransactionClient): Promise<FelIssueResult> {
  const config = await getActiveFelConfig(tx);
  const shouldMock = shouldUseMockByDefault();

  await validateReceiverNit(input.nitFacturado, config);

  const xml = buildFacturaXml(input, config);

  if (shouldMock) {
    return buildMockIssueResult(input);
  }

  try {
    const raw = await fetchDocumentoRaw(xml, config);
    const parsed = parseFelIssueResponse(raw);
    const rutaPdfFel = savePdfFile(parsed.pdfBase64, `venta-${input.idVenta}-${parsed.serieFel}-${parsed.numeroFel}.pdf`);

    return {
      autorizacionFel: parsed.autorizacionFel,
      numeroFel: parsed.numeroFel,
      serieFel: parsed.serieFel,
      qrFel: parsed.qrFel,
      fechaEmisionFel: parsed.fechaEmisionFel,
      rutaPdfFel,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('FEL:') && !isTruthy(process.env.FEL_ALLOW_FALLBACK)) {
      throw error;
    }

    if (!isTruthy(process.env.FEL_ALLOW_FALLBACK)) {
      const message = error instanceof Error ? error.message : 'falló conexión';
      throw new Error(`FEL: Error al emitir documento (${message})`);
    }

    return buildMockIssueResult(input);
  }
}

function parseFelAnulateResponse(rawResponse: string): { pdfBase64: string | null } {
  const decoded = decodeXmlEntities(rawResponse);

  const fatalErrorMatch = decoded.match(/<Errores>[\s\S]*?<\/Errores>/i);
  if (fatalErrorMatch) {
    const errorTag = fatalErrorMatch[0].match(/<Error(?:\s+Codigo="(\d+)")?\s*>([^<]*)<\/Error>/i);
    const mensaje = errorTag?.[2]?.trim() || 'Error al anular documento';
    throw new Error(`FEL: ${mensaje}`);
  }

  const fechaAnulacion = extractXmlAttributeValue(decoded, 'DTE', 'FechaAnulacion');
  if (!fechaAnulacion) {
    throw new Error('FEL: Respuesta de anulación sin confirmación');
  }

  return { pdfBase64: extractXmlTagValue(decoded, 'Pdf') };
}

async function fetchAnulacionRaw(
  numeroAutorizacion: string,
  motivo: string,
  config: ActiveFelConfig,
): Promise<string> {
  const endpoint = normalizeUrl(config.servidor, getAnulatePath());

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Anulacion.Execute xmlns="FEL">
      <Cliente>${escapeXml(config.cliente)}</Cliente>
      <Usuario>${escapeXml(config.usuario)}</Usuario>
      <Clave>${escapeXml(config.clave)}</Clave>
      <Nitemisor>${escapeXml(config.nitEmisor)}</Nitemisor>
      <Numautorizacionuuid>${escapeXml(numeroAutorizacion)}</Numautorizacionuuid>
      <Motivoanulacion>${escapeXml(motivo)}</Motivoanulacion>
    </Anulacion.Execute>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'FELaction/AANULACION.Execute',
    },
    body: envelope,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

export async function anulateFelInvoice(
  input: AnulateFelInput,
  tx?: Prisma.TransactionClient,
): Promise<{ rutaPdfFel: string | null }> {
  const config = await getActiveFelConfig(tx);
  const shouldMock = shouldUseMockByDefault();

  if (shouldMock) {
    return { rutaPdfFel: null };
  }

  try {
    const raw = await fetchAnulacionRaw(input.autorizacionFel, input.motivo, config);
    const { pdfBase64 } = parseFelAnulateResponse(raw);
    const rutaPdfFel = savePdfFile(
      pdfBase64,
      `venta-${input.idVenta}-${input.serieFel}-${input.numeroFel}-anulado.pdf`,
    );

    return { rutaPdfFel };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('FEL:')) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'falló conexión';
    throw new Error(`FEL: Error al anular documento (${message})`);
  }
}

export async function pingFelProvider(input?: {
  nitReceptor?: string;
  validarNit?: boolean;
}): Promise<{
  ok: boolean;
  entorno: 'mock' | 'real';
  servidor: string;
  endpointDocumento: string;
  endpointAnulacion: string;
  endpointValidarNit: string;
  nitValidado: boolean;
}> {
  const config = await getActiveFelConfig();
  const mock = shouldUseMockByDefault();

  const nitReceptor = input?.nitReceptor?.trim();
  const validarNit = input?.validarNit ?? true;

  if (validarNit && nitReceptor) {
    await validateReceiverNit(nitReceptor, config);
  }

  return {
    ok: true,
    entorno: mock ? 'mock' : 'real',
    servidor: config.servidor,
    endpointDocumento: normalizeUrl(config.servidor, getEmitPath()),
    endpointAnulacion: normalizeUrl(config.servidor, getAnulatePath()),
    endpointValidarNit: normalizeUrl(config.servidor, getValidateNitPath()),
    nitValidado: Boolean(validarNit && nitReceptor),
  };
}
