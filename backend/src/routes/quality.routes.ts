import { Router } from 'express';

import {
  createControlCalidadController,
  deleteControlCalidadController,
  getControlCalidadByIdController,
  listAnulatedControlCalidadController,
  listControlCalidadController,
  listFechasFaltantesController,
  restoreControlCalidadController,
  updateControlCalidadController,
  validateControlCalidadController,
} from '../controllers/quality.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const qualityRouter = Router();

qualityRouter.get('/', requireModulePermission('calidad', 'read'), listControlCalidadController);
qualityRouter.get('/anulados', requireModulePermission('calidad', 'read'), listAnulatedControlCalidadController);
qualityRouter.get(
  '/faltantes',
  requireModulePermission('calidad', 'read'),
  listFechasFaltantesController,
);
qualityRouter.get('/:id', requireModulePermission('calidad', 'read'), getControlCalidadByIdController);
qualityRouter.post('/', requireModulePermission('calidad', 'create'), createControlCalidadController);
qualityRouter.patch('/:id', requireModulePermission('calidad', 'update'), updateControlCalidadController);
qualityRouter.patch(
  '/:id/validar',
  requireModulePermission('calidad', 'update'),
  validateControlCalidadController,
);
qualityRouter.delete('/:id', requireModulePermission('calidad', 'delete'), deleteControlCalidadController);
qualityRouter.patch(
  '/:id/restaurar',
  requireModulePermission('calidad', 'update'),
  restoreControlCalidadController,
);

export default qualityRouter;
