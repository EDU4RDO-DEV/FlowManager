import { Router } from 'express';

import {
  createGastoVehiculoController,
  createRutaController,
  createRutaSesionController,
  createVehiculoController,
  deleteGastoVehiculoController,
  deleteRutaController,
  deleteRutaSesionController,
  deleteVehiculoController,
  getGastoVehiculoByIdController,
  getRutaByIdController,
  getRutaSesionByIdController,
  getVehiculoByIdController,
  listGastosVehiculoController,
  listRutasController,
  listRutaSesionesController,
  listVehiculosController,
  restoreGastoVehiculoController,
  restoreRutaController,
  restoreRutaSesionController,
  restoreVehiculoController,
  updateGastoVehiculoController,
  updateRutaController,
  updateRutaSesionController,
  updateVehiculoController,
  uploadGastoVehiculoImageController,
} from '../controllers/logistics.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadVehicleExpenseImage } from '../middlewares/upload.middleware';

const logisticsRouter = Router();

logisticsRouter.get('/vehiculos', requireModulePermission('logistica', 'read'), listVehiculosController);
logisticsRouter.get('/vehiculos/:id', requireModulePermission('logistica', 'read'), getVehiculoByIdController);
logisticsRouter.post('/vehiculos', requireModulePermission('logistica', 'create'), createVehiculoController);
logisticsRouter.patch('/vehiculos/:id', requireModulePermission('logistica', 'update'), updateVehiculoController);
logisticsRouter.delete('/vehiculos/:id', requireModulePermission('logistica', 'delete'), deleteVehiculoController);
logisticsRouter.patch('/vehiculos/:id/restaurar', requireModulePermission('logistica', 'update'), restoreVehiculoController);

logisticsRouter.get('/rutas', requireModulePermission('logistica', 'read'), listRutasController);
logisticsRouter.get('/rutas/sesiones', requireModulePermission('logistica', 'read'), listRutaSesionesController);
logisticsRouter.get('/rutas/:id/sesiones/:idSesion', requireModulePermission('logistica', 'read'), getRutaSesionByIdController);
logisticsRouter.post('/rutas/sesiones', requireModulePermission('logistica', 'create'), createRutaSesionController);
logisticsRouter.patch('/rutas/:id/sesiones/:idSesion', requireModulePermission('logistica', 'update'), updateRutaSesionController);
logisticsRouter.delete('/rutas/:id/sesiones/:idSesion', requireModulePermission('logistica', 'delete'), deleteRutaSesionController);
logisticsRouter.patch('/rutas/:id/sesiones/:idSesion/restaurar', requireModulePermission('logistica', 'update'), restoreRutaSesionController);
logisticsRouter.get('/rutas/:id', requireModulePermission('logistica', 'read'), getRutaByIdController);
logisticsRouter.post('/rutas', requireModulePermission('logistica', 'create'), createRutaController);
logisticsRouter.patch('/rutas/:id', requireModulePermission('logistica', 'update'), updateRutaController);
logisticsRouter.delete('/rutas/:id', requireModulePermission('logistica', 'delete'), deleteRutaController);
logisticsRouter.patch('/rutas/:id/restaurar', requireModulePermission('logistica', 'update'), restoreRutaController);

logisticsRouter.get('/gastos', requireModulePermission('logistica', 'read'), listGastosVehiculoController);
logisticsRouter.post(
  '/gastos/upload-image',
  requireModulePermission('logistica', 'read'),
  uploadVehicleExpenseImage.single('file'),
  uploadGastoVehiculoImageController,
);
logisticsRouter.get('/gastos/:id', requireModulePermission('logistica', 'read'), getGastoVehiculoByIdController);
logisticsRouter.post('/gastos', requireModulePermission('logistica', 'create'), createGastoVehiculoController);
logisticsRouter.patch('/gastos/:id', requireModulePermission('logistica', 'update'), updateGastoVehiculoController);
logisticsRouter.delete('/gastos/:id', requireModulePermission('logistica', 'delete'), deleteGastoVehiculoController);
logisticsRouter.patch('/gastos/:id/restaurar', requireModulePermission('logistica', 'update'), restoreGastoVehiculoController);

export default logisticsRouter;
