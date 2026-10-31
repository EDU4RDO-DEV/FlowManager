import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';

import { payrollPaymentsDir } from '../middlewares/upload.middleware';

function matchesFileSignature(mimeType: string, header: Buffer): boolean {
  if (mimeType === 'application/pdf') return header.subarray(0, 5).toString() === '%PDF-';
  if (mimeType === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimeType === 'image/png') {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
  }
  return false;
}

export async function uploadPayrollPaymentReceiptController(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Adjunta un comprobante en el campo file' });
  }

  const filePath = path.join(payrollPaymentsDir, req.file.filename);
  try {
    const handle = await fs.open(filePath, 'r');
    let header: Buffer;
    try {
      const readBuffer = Buffer.alloc(12);
      const { bytesRead } = await handle.read(readBuffer, 0, readBuffer.length, 0);
      header = readBuffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }

    if (!matchesFileSignature(req.file.mimetype, header)) {
      await fs.unlink(filePath);
      return res.status(400).json({ ok: false, message: 'El contenido del comprobante no coincide con su formato' });
    }

    return res.status(201).json({
      ok: true,
      data: {
        rutaComprobante: `/uploads/payroll-payments/${req.file.filename}`,
        nombre: req.file.originalname,
        tipo: req.file.mimetype,
        tamano: req.file.size,
      },
    });
  } catch (error) {
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error('No se pudo limpiar el comprobante de nómina rechazado', cleanupError);
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getPayrollPaymentReceiptController(req: Request, res: Response) {
  const fileName = req.params.fileName;
  if (typeof fileName !== 'string' || !/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(fileName)) {
    return res.status(404).json({ ok: false, message: 'Comprobante no encontrado' });
  }

  const filePath = path.join(payrollPaymentsDir, fileName);
  try {
    await fs.access(filePath);
    return res.sendFile(filePath, {
      headers: { 'Content-Disposition': `inline; filename="${fileName}"` },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ ok: false, message: 'Comprobante no encontrado' });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}
