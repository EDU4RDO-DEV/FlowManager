import { Router } from 'express';

import {
  createClientController,
  deleteClientController,
  getClientByIdController,
  listClientsController,
  updateClientController,
} from '../controllers/client.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const clientRouter = Router();

clientRouter.get('/', requireModulePermission('clientes', 'read'), listClientsController);
clientRouter.get('/:id', requireModulePermission('clientes', 'read'), getClientByIdController);
clientRouter.post('/', requireModulePermission('clientes', 'create'), createClientController);
clientRouter.patch('/:id', requireModulePermission('clientes', 'update'), updateClientController);
clientRouter.delete('/:id', requireModulePermission('clientes', 'delete'), deleteClientController);

export default clientRouter;