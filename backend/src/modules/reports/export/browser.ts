// Puppeteer/Chromium es costoso de arrancar (~cientos de ms); se reutiliza una sola
// instancia de navegador para todas las exportaciones PDF del proceso, abriendo una
// pestaña (page) nueva por reporte y cerrándola al terminar.
// Import dinámico: puppeteer@25 se publica como ESM puro y este backend es CommonJS.
// El tipo `Browser` se deriva por inferencia (Awaited<ReturnType<...>>) en vez de
// escribir `import('puppeteer').Browser`, porque TypeScript (Node16) rechaza cualquier
// referencia estática —incluso de tipo— a un paquete ESM-only desde un módulo CJS.
async function importPuppeteer() {
  return import('puppeteer');
}

type Browser = Awaited<ReturnType<Awaited<ReturnType<typeof importPuppeteer>>['default']['launch']>>;

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const { default: puppeteer } = await importPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  browser.on('disconnected', () => {
    browserPromise = null;
  });

  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }

  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

export type PdfPaperFormat = 'letter' | 'a4' | 'legal';

export type RenderHtmlToPdfOptions = {
  format: PdfPaperFormat;
  landscape: boolean;
  headerTemplate: string;
  footerTemplate: string;
  margin: { top: string; bottom: string; left: string; right: string };
};

// Renderiza HTML+CSS ya compuesto a un PDF usando Chromium headless.
// `headerTemplate`/`footerTemplate` siguen las reglas de Puppeteer: HTML autocontenido
// con estilos inline (no pueden referenciar la hoja de estilos de la página) y aceptan
// las clases especiales `date`, `title`, `pageNumber`, `totalPages`.
export async function renderHtmlToPdf(html: string, options: RenderHtmlToPdfOptions): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: options.format,
      landscape: options.landscape,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      margin: options.margin,
      preferCSSPageSize: false,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}
