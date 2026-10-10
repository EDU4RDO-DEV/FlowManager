import { Router } from 'express';

import { getDashboardController } from '../controllers/dashboard.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const dashboardRouter = Router();

dashboardRouter.get('/', requireModulePermission('ventas', 'read'), getDashboardController);

export default dashboardRouter;
