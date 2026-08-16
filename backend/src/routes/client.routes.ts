import { Router } from 'express';

import {
  createClientController,
  deleteClientController,
  getClientByIdController,
  listAnulatedClientsController,
  listClientsController,
  restoreClientController,
  uploadClientImageController,
  updateClientController,
} from '../controllers/client.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadClientImage } from '../middlewares/upload.middleware';

const clientRouter = Router();

clientRouter.get('/', requireModulePermission('clientes', 'read'), listClientsController);
clientRouter.get('/anulados', requireModulePermission('clientes', 'read'), listAnulatedClientsController);
clientRouter.post(
  '/upload-image',
  requireModulePermission('clientes', 'read'),
  uploadClientImage.single('file'),
  uploadClientImageController,
);
clientRouter.get('/:id', requireModulePermission('clientes', 'read'), getClientByIdController);
clientRouter.post('/', requireModulePermission('clientes', 'create'), createClientController);
clientRouter.patch('/:id', requireModulePermission('clientes', 'update'), updateClientController);
clientRouter.delete('/:id', requireModulePermission('clientes', 'delete'), deleteClientController);
clientRouter.patch('/:id/restaurar', requireModulePermission('clientes', 'update'), restoreClientController);

export default clientRouter;