import { Router } from 'express';

import {
  anulateTalonarioController,
  createTalonarioController,
  getTalonarioByIdController,
  listAnulatedTalonariosController,
  listTalonariosController,
  restoreTalonarioController,
  updateTalonarioController,
} from '../controllers/talonario.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const talonarioRouter = Router();

talonarioRouter.get('/', requireModulePermission('ventas', 'read'), listTalonariosController);
talonarioRouter.get('/anulados', requireModulePermission('ventas', 'read'), listAnulatedTalonariosController);
talonarioRouter.get('/:id', requireModulePermission('ventas', 'read'), getTalonarioByIdController);
talonarioRouter.post('/', requireModulePermission('ventas', 'create'), createTalonarioController);
talonarioRouter.patch('/:id', requireModulePermission('ventas', 'update'), updateTalonarioController);
talonarioRouter.patch('/:id/anular', requireModulePermission('ventas', 'delete'), anulateTalonarioController);
talonarioRouter.patch('/:id/restaurar', requireModulePermission('ventas', 'update'), restoreTalonarioController);

export default talonarioRouter;
