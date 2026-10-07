import fs from 'fs';
import path from 'path';

import Handlebars from 'handlebars';

import type { ReportColumn, ReportColumnType } from '../../types';
import { formatCellValue } from '../format';

const TEMPLATES_ROOT = path.join(__dirname);
const PARTIALS_DIR = path.join(TEMPLATES_ROOT, 'partials');
const LAYOUTS_DIR = path.join(TEMPLATES_ROOT, 'layouts');
const STYLES_DIR = path.join(TEMPLATES_ROOT, 'styles');

export type ReportLayoutName = 'standard' | 'financial' | 'inventory-landscape';

let initialized = false;

function registerHelpers(): void {
  Handlebars.registerHelper('formatCell', (value: unknown, type: ReportColumnType) => {
    return new Handlebars.SafeString(escapeHtml(formatCellValue(value, type)));
  });

  Handlebars.registerHelper('alignClass', (column: ReportColumn) => {
    const align = column.align ?? (column.type === 'text' || column.type === 'badge' ? 'left' : 'right');
    return `align-${align}`;
  });

  Handlebars.registerHelper('initial', (value: string | undefined) => {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function registerPartials(): void {
  const files = fs.readdirSync(PARTIALS_DIR).filter((file) => file.endsWith('.hbs'));

  for (const file of files) {
    const name = path.basename(file, '.hbs');
    const content = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf-8');
    Handlebars.registerPartial(name, content);
  }
}

function ensureInitialized(): void {
  if (initialized) return;
  registerHelpers();
  registerPartials();
  initialized = true;
}

const compiledLayouts = new Map<ReportLayoutName, HandlebarsTemplateDelegate>();
const compiledStandalone = new Map<string, HandlebarsTemplateDelegate>();
let cachedCss: string | null = null;
const cachedLayoutCss = new Map<ReportLayoutName, string>();

function readCss(fileName: string): string {
  return fs.readFileSync(path.join(STYLES_DIR, fileName), 'utf-8');
}

function getBaseCss(): string {
  if (!cachedCss) {
    cachedCss = readCss('base.css');
  }
  return cachedCss;
}

function getLayoutCss(layout: ReportLayoutName): string {
  const cached = cachedLayoutCss.get(layout);
  if (cached) return cached;

  const css = `${getBaseCss()}\n${readCss(`${layout}.css`)}`;
  cachedLayoutCss.set(layout, css);
  return css;
}

function getLayoutTemplate(layout: ReportLayoutName): HandlebarsTemplateDelegate {
  ensureInitialized();

  const cached = compiledLayouts.get(layout);
  if (cached) return cached;

  const source = fs.readFileSync(path.join(LAYOUTS_DIR, `${layout}.hbs`), 'utf-8');
  const compiled = Handlebars.compile(source);
  compiledLayouts.set(layout, compiled);
  return compiled;
}

function getStandaloneTemplate(name: 'running-header' | 'running-footer'): HandlebarsTemplateDelegate {
  ensureInitialized();

  const cached = compiledStandalone.get(name);
  if (cached) return cached;

  const source = fs.readFileSync(path.join(PARTIALS_DIR, `${name}.hbs`), 'utf-8');
  const compiled = Handlebars.compile(source);
  compiledStandalone.set(name, compiled);
  return compiled;
}

export function renderReportHtml(layout: ReportLayoutName, data: Record<string, unknown>): string {
  const template = getLayoutTemplate(layout);
  return template({ ...data, css: getLayoutCss(layout) });
}

export function renderRunningHeader(data: { companyName: string; reportName: string }): string {
  return getStandaloneTemplate('running-header')(data);
}

export function renderRunningFooter(data: { companyName: string; generatedBy: string }): string {
  return getStandaloneTemplate('running-footer')(data);
}
