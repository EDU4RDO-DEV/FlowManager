import { Router } from 'express';

import {
  closeCashSessionController,
  getCurrentCashSessionController,
  listCashSessionsController,
  openCashSessionController,
} from '../controllers/cash.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const cashRouter = Router();

cashRouter.get('/current', requireModulePermission('caja', 'read'), getCurrentCashSessionController);
cashRouter.get('/sessions', requireModulePermission('caja', 'read'), listCashSessionsController);
cashRouter.post('/open', requireModulePermission('caja', 'create'), openCashSessionController);
cashRouter.post(
  '/sessions/:id/close',
  requireModulePermission('caja', 'update'),
  closeCashSessionController,
);

export default cashRouter;
