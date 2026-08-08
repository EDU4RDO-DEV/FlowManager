import { Router } from 'express';

import {
  createProviderController,
  deleteProviderController,
  getProviderByIdController,
  listAnulatedProvidersController,
  listProvidersController,
  restoreProviderController,
  updateProviderController,
} from '../controllers/provider.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const providerRouter = Router();

providerRouter.get('/', requireModulePermission('proveedores', 'read'), listProvidersController);
providerRouter.get('/anulados', requireModulePermission('proveedores', 'read'), listAnulatedProvidersController);
providerRouter.get('/:id', requireModulePermission('proveedores', 'read'), getProviderByIdController);
providerRouter.post('/', requireModulePermission('proveedores', 'create'), createProviderController);
providerRouter.patch('/:id', requireModulePermission('proveedores', 'update'), updateProviderController);
providerRouter.delete('/:id', requireModulePermission('proveedores', 'delete'), deleteProviderController);
providerRouter.patch('/:id/restaurar', requireModulePermission('proveedores', 'update'), restoreProviderController);

export default providerRouter;