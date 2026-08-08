import { Router } from 'express';

import {
  createSessionController,
  deleteSessionController,
  getSessionByIdController,
  listAnulatedSessionsController,
  listSessionsController,
  restoreSessionController,
  updateSessionController,
} from '../controllers/session.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const sessionRouter = Router();

sessionRouter.get('/', requireModulePermission('sesiones', 'read'), listSessionsController);
sessionRouter.get('/anulados', requireModulePermission('sesiones', 'read'), listAnulatedSessionsController);
sessionRouter.get('/:id', requireModulePermission('sesiones', 'read'), getSessionByIdController);
sessionRouter.post('/', requireModulePermission('sesiones', 'create'), createSessionController);
sessionRouter.patch('/:id', requireModulePermission('sesiones', 'update'), updateSessionController);
sessionRouter.delete('/:id', requireModulePermission('sesiones', 'delete'), deleteSessionController);
sessionRouter.patch('/:id/restaurar', requireModulePermission('sesiones', 'update'), restoreSessionController);

export default sessionRouter;