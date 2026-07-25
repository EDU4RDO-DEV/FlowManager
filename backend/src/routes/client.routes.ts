import { Router } from 'express';

import {
  createClientController,
  deleteClientController,
  getClientByIdController,
  listClientsController,
  updateClientController,
} from '../controllers/client.controller';

const clientRouter = Router();

clientRouter.get('/', listClientsController);
clientRouter.get('/:id', getClientByIdController);
clientRouter.post('/', createClientController);
clientRouter.patch('/:id', updateClientController);
clientRouter.delete('/:id', deleteClientController);

export default clientRouter;