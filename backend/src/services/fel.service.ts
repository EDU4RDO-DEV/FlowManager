import fs from 'fs';
import path from 'path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from 'node:https';
import type { IncomingMessage } from 'node:http';

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
  environment: 'production' | 'sandbox';
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
  emitPath: string;
  anulatePath: string;
  validateNitPath: string;
  soapActionDocument: string;
  soapActionAnulate: string;
  soapActionValidateNit: string;
  requireSsl: boolean;
  pfx: Buffer | null;
  pfxPassword: string | null;
  timeoutMs: number;
};

function getFelEnvironment(): ActiveFelConfig['environment'] {
  const environment = (process.env.FEL_ENVIRONMENT ?? 'sandbox').trim().toLowerCase();
  if (environment === 'production' || environment === 'sandbox') {
    return environment;
  }

  throw new Error('FEL: FEL_ENVIRONMENT debe ser production o sandbox');
}

function getFelEnvironmentValue(name: string): string | undefined {
  const environment = getFelEnvironment();
  const suffix = environment === 'production' ? 'PROD' : 'SANDBOX';
  const modeValue = process.env[`FEL_${name}_${suffix}`];

  if (modeValue !== undefined) {
    return modeValue;
  }

  return environment === 'sandbox' ? process.env[`FEL_${name}`] : undefined;
}

function getFelBoolean(name: string, defaultValue: boolean): boolean {
  const value = getFelEnvironmentValue(name);
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'si', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`FEL: FEL_${name} tiene un valor booleano inválido`);
}

function shouldUseMockByDefault(): boolean {
  const environment = getFelEnvironment();
  const useMock = getFelBoolean('USE_MOCK', false);

  if (environment === 'production' && useMock) {
    throw new Error('FEL: FEL_USE_MOCK_PROD no puede estar habilitado en producción');
  }

  return useMock;
}

function shouldAllowFelFallback(): boolean {
  return getFelEnvironment() === 'sandbox' && getFelBoolean('ALLOW_FALLBACK', false);
}

function getEmitPath(): string {
  return getFelEnvironmentValue('EMIT_PATH') ??
    (getFelEnvironment() === 'production' ? '/adocumento' : '/fel/adocumento');
}

function getAnulatePath(): string {
  return getFelEnvironmentValue('ANULATE_PATH') ??
    (getFelEnvironment() === 'production' ? '/aanulacion' : '/fel/aanulacion');
}

function getValidateNitPath(): string {
  return getFelEnvironmentValue('VALIDATE_NIT_PATH') ??
    (getFelEnvironment() === 'production' ? '/areceptorinfo' : '/fel/areceptorinfo');
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
    getFelEnvironmentValue('QR_BASE_URL') ??
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
    console.error('[FEL] No se pudo guardar el PDF recibido del proveedor');
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
  return getFelBoolean('VALIDATE_NIT_BEFORE_EMIT', true);
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

export async function postFelSoap(
  endpoint: string,
  soapAction: string,
  envelope: string,
  config: Pick<ActiveFelConfig, 'requireSsl' | 'pfx' | 'pfxPassword' | 'timeoutMs'>,
): Promise<string> {
  const url = new URL(endpoint);
  if (config.requireSsl && url.protocol !== 'https:') {
    throw new Error('FEL: La configuración requiere un endpoint HTTPS');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('FEL: Protocolo de endpoint no permitido');
  }
  if (config.pfx && url.protocol !== 'https:') {
    throw new Error('FEL: El certificado cliente requiere un endpoint HTTPS');
  }

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    SOAPAction: soapAction,
    'Content-Length': Buffer.byteLength(envelope, 'utf8'),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const handleResponse = (response: IncomingMessage) => {
      const chunks: Buffer[] = [];
      let responseBytes = 0;

      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        responseBytes += buffer.length;
        if (responseBytes > 10 * 1024 * 1024) {
          response.destroy(new Error('FEL: La respuesta del proveedor excede el límite permitido'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('error', fail);
      response.on('end', () => {
        if (settled) {
          return;
        }
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          fail(new Error(`HTTP ${statusCode}`));
          return;
        }
        settled = true;
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    };

    const options = {
      method: 'POST',
      headers,
      timeout: config.timeoutMs,
    };

    const request = url.protocol === 'https:'
      ? httpsRequest(
          url,
          {
            ...options,
            rejectUnauthorized: true,
            ...(config.pfx
              ? {
                  pfx: config.pfx,
                  passphrase: config.pfxPassword ?? undefined,
                }
              : {}),
          } satisfies HttpsRequestOptions,
          handleResponse,
        )
      : httpRequest(url, options, handleResponse);

    request.on('timeout', () => request.destroy(new Error('FEL: Tiempo de espera agotado al contactar al proveedor')));
    request.on('error', fail);
    request.end(envelope, 'utf8');
  });
}

async function fetchReceptorInfoRaw(nitReceptor: string, config: ActiveFelConfig): Promise<string> {
  const endpoint = normalizeUrl(config.servidor, config.validateNitPath);

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

  return postFelSoap(endpoint, config.soapActionValidateNit, envelope, config);
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
    const mayContinueWithoutValidation =
      getFelEnvironment() === 'sandbox' && getFelBoolean('ALLOW_NIT_VALIDATION_FALLBACK', true);
    if (mayContinueWithoutValidation) {
      return;
    }

    throw error instanceof Error ? error : new Error('FEL: Error al validar NIT receptor');
  }
}

async function getActiveFelConfig(tx?: Prisma.TransactionClient): Promise<ActiveFelConfig> {
  const db = tx ?? prisma;
  const environment = getFelEnvironment();

  const empresa = await db.empresa.findFirst({
    where: {
      Anulado: false,
    },
    orderBy: { Id: 'asc' },
    select: {
      Nit: true,
      NombreComercial: true,
      Nombre: true,
    },
  });

  if (!empresa) {
    throw new Error('FEL: No existe configuración de empresa activa');
  }

  const servidor = (getFelEnvironmentValue('BASE_URL') ?? '').trim();
  const usuario = (getFelEnvironmentValue('USUARIO') ?? '').trim();
  const clave = (getFelEnvironmentValue('CLAVE') ?? '').trim();

  const cliente = (getFelEnvironmentValue('CLIENTE') ?? (environment === 'sandbox' ? empresa.Nit : '')).trim();
  const nitEmisor = (getFelEnvironmentValue('NIT_EMISOR') ?? (environment === 'sandbox' ? empresa.Nit : '')).trim();
  const afiliacionIva = (getFelEnvironmentValue('AFILIACION_IVA') ?? 'PEQ').trim();
  const establecimiento = Number(getFelEnvironmentValue('ESTABLECIMIENTO') ?? '1');
  const formato = (getFelEnvironmentValue('FORMAT') ?? 'STD_TWS').trim().toUpperCase();
  const tipoDocumento = (
    getFelEnvironmentValue('TIPO_DOCUMENTO') ?? resolveDefaultTipoDocumento(afiliacionIva)
  ).trim();

  if (!servidor || !usuario || !clave) {
    throw new Error(`FEL: Configuración incompleta para el entorno ${environment}`);
  }

  if (!cliente || !nitEmisor) {
    throw new Error(`FEL: Cliente o NIT emisor no configurado para el entorno ${environment}`);
  }

  if (!Number.isFinite(establecimiento) || establecimiento <= 0) {
    throw new Error(`FEL: Establecimiento inválido para el entorno ${environment}`);
  }

  if (formato !== 'STD_TWS') {
    throw new Error('FEL: El formato configurado no es compatible con el generador STD_TWS');
  }

  const emitPath = getEmitPath();
  const anulatePath = getAnulatePath();
  const validateNitPath = getValidateNitPath();
  const soapActionDocument =
    getFelEnvironmentValue('SOAP_ACTION_DOCUMENTO') ?? 'FELaction/ADOCUMENTO.Execute';
  const soapActionAnulate =
    getFelEnvironmentValue('SOAP_ACTION_ANULACION') ?? 'FELaction/AANULACION.Execute';
  const soapActionValidateNit =
    getFelEnvironmentValue('SOAP_ACTION_VALIDAR_NIT') ?? 'FELaction/ARECEPTORINFO.Execute';
  const requireSsl = getFelBoolean('REQUIRE_SSL', environment === 'production');
  const useClientCertificate = getFelBoolean(
    'USE_CLIENT_CERTIFICATE',
    environment === 'production',
  );
  const timeoutSeconds = Number(getFelEnvironmentValue('HTTP_TIMEOUT_SECONDS') ?? '60');

  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 300) {
    throw new Error('FEL: El timeout HTTP debe estar entre 1 y 300 segundos');
  }

  let pfx: Buffer | null = null;
  let pfxPassword: string | null = null;
  if (environment === 'production') {
    let baseUrl: URL;
    try {
      baseUrl = new URL(servidor);
    } catch {
      throw new Error('FEL: URL base de producción inválida');
    }

    if (
      baseUrl.protocol !== 'https:' ||
      !['www.facturaenlineagt.com', 'facturaenlineagt.com'].includes(baseUrl.hostname.toLowerCase())
    ) {
      throw new Error('FEL: Producción requiere el endpoint HTTPS oficial de Factura en Línea GT');
    }

    if (!requireSsl || !useClientCertificate) {
      throw new Error('FEL: Producción requiere TLS y certificado cliente');
    }
    if (
      getFelBoolean('ALLOW_FALLBACK', false) ||
      getFelBoolean('ALLOW_NIT_VALIDATION_FALLBACK', false) ||
      !getFelBoolean('VALIDATE_NIT_BEFORE_EMIT', true)
    ) {
      throw new Error('FEL: Producción requiere validación de NIT y no permite continuar con fallback');
    }

    const pfxPath = getFelEnvironmentValue('PFX_PATH')?.trim();
    pfxPassword = getFelEnvironmentValue('PFX_PASSWORD') ?? '';
    if (!pfxPath || !pfxPassword) {
      throw new Error('FEL: Configure FEL_PFX_PATH_PROD y FEL_PFX_PASSWORD_PROD antes de emitir');
    }

    try {
      const absolutePfxPath = path.resolve(process.cwd(), pfxPath);
      const certificate = fs.statSync(absolutePfxPath);
      if (!certificate.isFile() || certificate.size === 0 || certificate.size > 10 * 1024 * 1024) {
        throw new Error('invalid certificate size');
      }
      pfx = fs.readFileSync(absolutePfxPath);
    } catch {
      throw new Error('FEL: No se pudo cargar el certificado cliente configurado');
    }
  } else if (useClientCertificate) {
    const pfxPath = getFelEnvironmentValue('PFX_PATH')?.trim();
    pfxPassword = getFelEnvironmentValue('PFX_PASSWORD') ?? '';
    if (!pfxPath || !pfxPassword) {
      throw new Error('FEL: Configure la ruta y contraseña del certificado cliente');
    }
    try {
      pfx = fs.readFileSync(path.resolve(process.cwd(), pfxPath));
    } catch {
      throw new Error('FEL: No se pudo cargar el certificado cliente configurado');
    }
  }

  if (environment === 'production' && shouldUseMockByDefault()) {
    throw new Error('FEL: El modo simulado no está permitido en producción');
  }

  return {
    environment,
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
    emitPath,
    anulatePath,
    validateNitPath,
    soapActionDocument,
    soapActionAnulate,
    soapActionValidateNit,
    requireSsl,
    pfx,
    pfxPassword,
    timeoutMs: timeoutSeconds * 1000,
  };
}

async function fetchDocumentoRaw(xmldoc: string, config: ActiveFelConfig): Promise<string> {
  const endpoint = normalizeUrl(config.servidor, config.emitPath);

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

  return postFelSoap(endpoint, config.soapActionDocument, envelope, config);
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
    if (!shouldAllowFelFallback()) {
      if (error instanceof Error && error.message.startsWith('FEL:')) {
        throw error;
      }
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
  const endpoint = normalizeUrl(config.servidor, config.anulatePath);

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

  return postFelSoap(endpoint, config.soapActionAnulate, envelope, config);
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
  modoFel: 'production' | 'sandbox';
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
    modoFel: config.environment,
    servidor: config.servidor,
    endpointDocumento: normalizeUrl(config.servidor, config.emitPath),
    endpointAnulacion: normalizeUrl(config.servidor, config.anulatePath),
    endpointValidarNit: normalizeUrl(config.servidor, config.validateNitPath),
    nitValidado: Boolean(validarNit && nitReceptor),
  };
}
