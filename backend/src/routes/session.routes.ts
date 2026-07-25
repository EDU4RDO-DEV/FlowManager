import { Router } from 'express';

import {
  createSessionController,
  deleteSessionController,
  getSessionByIdController,
  listSessionsController,
  updateSessionController,
} from '../controllers/session.controller';
import { requireRoleNames, ROLE_GROUPS } from '../middlewares/auth.middleware';

const sessionRouter = Router();
const requireSessionsAccess = requireRoleNames([
  ...ROLE_GROUPS.adminGerencia,
  ...ROLE_GROUPS.logistica,
  ...ROLE_GROUPS.cajeroVendedor,
]);

sessionRouter.get('/', requireSessionsAccess, listSessionsController);
sessionRouter.get('/:id', requireSessionsAccess, getSessionByIdController);
sessionRouter.post('/', requireSessionsAccess, createSessionController);
sessionRouter.patch('/:id', requireSessionsAccess, updateSessionController);
sessionRouter.delete('/:id', requireSessionsAccess, deleteSessionController);

export default sessionRouter;