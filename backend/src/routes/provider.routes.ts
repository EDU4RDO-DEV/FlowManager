import { Router } from 'express';

import {
  createProviderController,
  deleteProviderController,
  getProviderByIdController,
  listProvidersController,
  updateProviderController,
} from '../controllers/provider.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const providerRouter = Router();

providerRouter.get('/', requireModulePermission('proveedores', 'read'), listProvidersController);
providerRouter.get('/:id', requireModulePermission('proveedores', 'read'), getProviderByIdController);
providerRouter.post('/', requireModulePermission('proveedores', 'create'), createProviderController);
providerRouter.patch('/:id', requireModulePermission('proveedores', 'update'), updateProviderController);
providerRouter.delete('/:id', requireModulePermission('proveedores', 'delete'), deleteProviderController);

export default providerRouter;