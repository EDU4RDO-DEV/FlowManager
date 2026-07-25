import { Router } from 'express';

import {
  createProviderController,
  deleteProviderController,
  getProviderByIdController,
  listProvidersController,
  updateProviderController,
} from '../controllers/provider.controller';

const providerRouter = Router();

providerRouter.get('/', listProvidersController);
providerRouter.get('/:id', getProviderByIdController);
providerRouter.post('/', createProviderController);
providerRouter.patch('/:id', updateProviderController);
providerRouter.delete('/:id', deleteProviderController);

export default providerRouter;