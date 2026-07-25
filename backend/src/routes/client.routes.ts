import { Router } from 'express';

import {
  createClientController,
  deleteClientController,
  getClientByIdController,
  listClientsController,
  updateClientController,
} from '../controllers/client.controller';
import { requireRoleNames, ROLE_GROUPS } from '../middlewares/auth.middleware';

const clientRouter = Router();
const requireClientsAccess = requireRoleNames([
  ...ROLE_GROUPS.adminGerencia,
  ...ROLE_GROUPS.cajeroVendedor,
  ...ROLE_GROUPS.logistica,
]);

clientRouter.get('/', requireClientsAccess, listClientsController);
clientRouter.get('/:id', requireClientsAccess, getClientByIdController);
clientRouter.post('/', requireClientsAccess, createClientController);
clientRouter.patch('/:id', requireClientsAccess, updateClientController);
clientRouter.delete('/:id', requireClientsAccess, deleteClientController);

export default clientRouter;