import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { requireAuth } from './middlewares/auth.middleware';
import adjustmentRouter from './routes/adjustment.routes';
import authRouter from './routes/auth.routes';
import clientRouter from './routes/client.routes';
import clientCatalogRouter from './routes/client-catalog.routes';
import commercialRuleRouter from './routes/commercial-rule.routes';
import creditRouter from './routes/credit.routes';
import employeeRouter from './routes/employee.routes';
import envaseRouter from './routes/envase.routes';
import inventoryLogRouter from './routes/inventory-log.routes';
import logisticsRouter from './routes/logistics.routes';
import planillaRouter from './routes/planilla.routes';
import productRouter from './routes/product.routes';
import productStructureRouter from './routes/product-structure.routes';
import purchaseRouter from './routes/purchase.routes';
import providerRouter from './routes/provider.routes';
import roleRouter from './routes/role.routes';
import saleRouter from './routes/sale.routes';
import sessionRouter from './routes/session.routes';
import talonarioRouter from './routes/talonario.routes';
import userRouter from './routes/user.routes';
import { uploadsRootPath } from './utils/paths';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(uploadsRootPath));

  app.use('/api/auth', authRouter);
  app.use('/api/adjustments', requireAuth, adjustmentRouter);
  app.use('/api/clients', requireAuth, clientRouter);
  app.use('/api/client-catalog', requireAuth, clientCatalogRouter);
  app.use('/api/commercial-rules', requireAuth, commercialRuleRouter);
  app.use('/api/credits', requireAuth, creditRouter);
  app.use('/api/employees', requireAuth, employeeRouter);
  app.use('/api/envases', requireAuth, envaseRouter);
  app.use('/api/inventory-log', requireAuth, inventoryLogRouter);
  app.use('/api/logistics', requireAuth, logisticsRouter);
  app.use('/api/planilla', requireAuth, planillaRouter);
  app.use('/api/products', requireAuth, productRouter);
  app.use('/api/product-structure', requireAuth, productStructureRouter);
  app.use('/api/compras', requireAuth, purchaseRouter);
  app.use('/api/providers', requireAuth, providerRouter);
  app.use('/api/roles', requireAuth, roleRouter);
  app.use('/api/ventas', requireAuth, saleRouter);
  app.use('/api/sessions', requireAuth, sessionRouter);
  app.use('/api/talonarios', requireAuth, talonarioRouter);
  app.use('/api/users', requireAuth, userRouter);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'flowmanager-backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, message: 'La imagen excede el tamaño máximo de 5MB' });
      }

      return res.status(400).json({ ok: false, message: 'Error al procesar la imagen enviada' });
    }

    if (error instanceof Error && error.message.includes('Tipo de archivo no permitido')) {
      return res.status(400).json({ ok: false, message: error.message });
    }

    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.parse.failed'
    ) {
      return res.status(400).json({ ok: false, message: 'JSON inválido en el cuerpo de la solicitud' });
    }

    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return res.status(500).json({ ok: false, message });
  });

  return app;
}
