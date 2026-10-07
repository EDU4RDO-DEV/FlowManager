import ExcelJS from 'exceljs';
import type { Response } from 'express';

import type { ReportColumn, ReportResult } from '../types';
import type { CompanyInfo } from './company-info';

export type RenderExcelInput = {
  reportNombre: string;
  reportDescripcion: string;
  categoriaLabel: string;
  parametrosResumen: string[];
  result: ReportResult;
  company: CompanyInfo;
  generatedByName: string;
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function excelNumberFormat(column: ReportColumn): string | undefined {
  switch (column.type) {
    case 'currency':
      return '"Q" #,##0.00';
    case 'percent':
      return '0.00"%"';
    case 'number':
      return '#,##0.00';
    case 'date':
      return 'dd/mm/yyyy';
    default:
      return undefined;
  }
}

function cellValue(value: unknown, column: ReportColumn): unknown {
  if (value === null || value === undefined) {
    return column.type === 'number' || column.type === 'currency' || column.type === 'percent' ? null : '';
  }

  if (column.type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date;
  }

  if (column.type === 'number' || column.type === 'currency' || column.type === 'percent') {
    return Number(value);
  }

  return String(value);
}

export async function streamReportExcel(res: Response, input: RenderExcelInput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.company.nombreComercial;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(input.reportNombre.slice(0, 31) || 'Reporte');

  sheet.mergeCells('A1', 'B1');
  sheet.getCell('A1').value = input.company.nombreComercial;
  sheet.getCell('A1').font = { bold: true, size: 14 };

  sheet.mergeCells('A2', 'D2');
  sheet.getCell('A2').value = input.reportNombre;
  sheet.getCell('A2').font = { bold: true, size: 12 };

  if (input.reportDescripcion) {
    sheet.mergeCells('A3', 'D3');
    sheet.getCell('A3').value = input.reportDescripcion;
    sheet.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  }

  sheet.mergeCells('A4', 'D4');
  sheet.getCell('A4').value = `Categoría: ${input.categoriaLabel}`;
  sheet.getCell('A4').font = { size: 9 };

  let nextRow = 5;
  if (input.parametrosResumen.length > 0) {
    sheet.mergeCells(`A${nextRow}`, `D${nextRow}`);
    sheet.getCell(`A${nextRow}`).value = `Parámetros: ${input.parametrosResumen.join(' · ')}`;
    sheet.getCell(`A${nextRow}`).font = { size: 9 };
    nextRow += 1;
  }

  sheet.mergeCells(`A${nextRow}`, `D${nextRow}`);
  sheet.getCell(`A${nextRow}`).value = `Generado por ${input.generatedByName} el ${new Date().toLocaleString('es-GT')}`;
  sheet.getCell(`A${nextRow}`).font = { size: 8, color: { argb: 'FF64748B' } };
  nextRow += 2;

  if (input.result.indicators && input.result.indicators.length > 0) {
    input.result.indicators.forEach((indicator, index) => {
      const row = nextRow + index;
      sheet.getCell(`A${row}`).value = indicator.label;
      sheet.getCell(`A${row}`).font = { bold: true, size: 9 };
      sheet.getCell(`B${row}`).value = indicator.value;
    });
    nextRow += input.result.indicators.length + 1;
  }

  const headerRowNumber = nextRow;
  const headerRow = sheet.getRow(headerRowNumber);
  input.result.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { horizontal: column.type === 'text' ? 'left' : 'right' };
  });
  headerRow.commit();

  let currentRow = headerRowNumber + 1;

  const writeDataRow = (row: Record<string, unknown>, shaded: boolean) => {
    const excelRow = sheet.getRow(currentRow);
    input.result.columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      cell.value = cellValue(row[column.key], column) as ExcelJS.CellValue;
      const numFmt = excelNumberFormat(column);
      if (numFmt) {
        cell.numFmt = numFmt;
      }
      cell.alignment = { horizontal: column.type === 'text' ? 'left' : 'right' };
      if (shaded) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
    excelRow.commit();
    currentRow += 1;
  };

  const writeSubtotalRow = (subtotals: Record<string, number>, label: string) => {
    const excelRow = sheet.getRow(currentRow);
    input.result.columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      if (index === 0) {
        cell.value = label;
      } else if (column.key in subtotals) {
        cell.value = subtotals[column.key];
        const numFmt = excelNumberFormat(column);
        if (numFmt) cell.numFmt = numFmt;
      }
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.alignment = { horizontal: column.type === 'text' ? 'left' : 'right' };
    });
    excelRow.commit();
    currentRow += 1;
  };

  if (input.result.groups && input.result.groups.length > 0) {
    input.result.groups.forEach((group) => {
      const groupRow = sheet.getRow(currentRow);
      groupRow.getCell(1).value = group.label;
      groupRow.getCell(1).font = { bold: true };
      groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      groupRow.commit();
      currentRow += 1;

      group.rows.forEach((row, index) => writeDataRow(row, index % 2 === 1));

      if (group.subtotals) {
        writeSubtotalRow(group.subtotals, 'Subtotal');
      }
    });
  } else {
    input.result.rows.forEach((row, index) => writeDataRow(row, index % 2 === 1));
  }

  if (input.result.totals) {
    writeSubtotalRow(input.result.totals, 'TOTAL GENERAL');
  }

  sheet.columns.forEach((column, index) => {
    const reportColumn = input.result.columns[index];
    column.width = reportColumn?.type === 'text' ? 28 : 16;
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${slugify(input.reportNombre)}.xlsx"`);

  await workbook.xlsx.write(res);
}
