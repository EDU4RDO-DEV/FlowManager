import { Router } from 'express';

import {
  createProviderController,
  deleteProviderController,
  getProviderByIdController,
  listProvidersController,
  updateProviderController,
} from '../controllers/provider.controller';
import { requireRoleNames, ROLE_GROUPS } from '../middlewares/auth.middleware';

const providerRouter = Router();
const requireProvidersAccess = requireRoleNames([
  ...ROLE_GROUPS.adminGerencia,
  ...ROLE_GROUPS.inventario,
]);

providerRouter.get('/', requireProvidersAccess, listProvidersController);
providerRouter.get('/:id', requireProvidersAccess, getProviderByIdController);
providerRouter.post('/', requireProvidersAccess, createProviderController);
providerRouter.patch('/:id', requireProvidersAccess, updateProviderController);
providerRouter.delete('/:id', requireProvidersAccess, deleteProviderController);

export default providerRouter;