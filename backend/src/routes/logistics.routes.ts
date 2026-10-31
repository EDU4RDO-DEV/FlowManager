import { Router } from 'express';

import {
  createGastoVehiculoController,
  createRutaController,
  createRutaSesionController,
  createVehiculoController,
  closeRutaSesionFromDispatchController,
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
import {
  requireAssignedVehicleAccess,
  requireAssignedVehicleExpenseAccess,
  requireAssignedRouteSessionAccess,
  requireAssignedRouteSessionReadAccess,
  requireAssignedTransferAccess,
} from '../middlewares/operational-scope.middleware';
import { uploadVehicleExpenseImage } from '../middlewares/upload.middleware';
import {
  createRouteAdjustmentController,
  createRouteDispatchController,
  createRouteReturnController,
  cancelRouteReturnController,
  cancelRouteDispatchController,
  getRouteInventoryController,
  getRouteSettlementController,
  listDispatchProductsController,
} from '../controllers/route-inventory.controller';
import {
  closeJornadaController,
  createJornadaController,
  getJornadaByIdController,
  listJornadasController,
} from '../controllers/jornada.controller';
import {
  cancelVehicleTransferController,
  confirmVehicleTransferController,
  createVehicleHandoffController,
  createVehicleTransferController,
  listVehicleTransfersController,
  rejectVehicleTransferController,
} from '../controllers/route-distribution.controller';

const logisticsRouter = Router();

logisticsRouter.get('/vehiculos', requireModulePermission('logistica', 'read'), listVehiculosController);
logisticsRouter.get(
  '/vehiculos/:id',
  requireModulePermission('logistica', 'read'),
  requireAssignedVehicleAccess(),
  getVehiculoByIdController,
);
logisticsRouter.post('/vehiculos', requireModulePermission('logistica', 'create'), createVehiculoController);
logisticsRouter.patch('/vehiculos/:id', requireModulePermission('logistica', 'update'), updateVehiculoController);
logisticsRouter.delete('/vehiculos/:id', requireModulePermission('logistica', 'delete'), deleteVehiculoController);
logisticsRouter.patch('/vehiculos/:id/restaurar', requireModulePermission('logistica', 'update'), restoreVehiculoController);

logisticsRouter.get('/rutas', requireModulePermission('logistica', 'read'), listRutasController);
logisticsRouter.get('/rutas/sesiones', requireModulePermission('logistica', 'read'), listRutaSesionesController);
logisticsRouter.get('/despacho/sesiones', requireModulePermission('despacho', 'read'), listRutaSesionesController);
logisticsRouter.get('/despacho/productos', requireModulePermission('despacho', 'read'), listDispatchProductsController);
logisticsRouter.patch(
  '/despacho/sesiones/:id/cerrar',
  requireModulePermission('despacho', 'update'),
  requireAssignedRouteSessionAccess(),
  closeRutaSesionFromDispatchController,
);
logisticsRouter.get(
  '/rutas/sesiones/:id/inventario',
  requireModulePermission('despacho', 'read'),
  requireAssignedRouteSessionAccess(),
  getRouteInventoryController,
);
logisticsRouter.get(
  '/rutas/sesiones/:id/liquidacion',
  requireModulePermission('despacho', 'read'),
  requireAssignedRouteSessionAccess(),
  getRouteSettlementController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/despacho',
  requireModulePermission('despacho', 'create'),
  requireAssignedRouteSessionAccess(),
  createRouteDispatchController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/despacho/anular',
  requireModulePermission('despacho', 'update'),
  requireAssignedRouteSessionAccess(),
  cancelRouteDispatchController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/devolucion',
  requireModulePermission('despacho', 'create'),
  requireAssignedRouteSessionAccess(),
  createRouteReturnController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/devolucion/anular',
  requireModulePermission('despacho', 'update'),
  requireAssignedRouteSessionAccess(),
  cancelRouteReturnController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/ajustes',
  requireModulePermission('despacho', 'update'),
  requireAssignedRouteSessionAccess(),
  createRouteAdjustmentController,
);
logisticsRouter.post(
  '/rutas/sesiones/:id/relevo',
  requireModulePermission('despacho', 'create'),
  requireAssignedRouteSessionAccess(),
  createVehicleHandoffController,
);
logisticsRouter.get(
  '/rutas/:id/sesiones/:idSesion',
  requireModulePermission('logistica', 'read'),
  requireAssignedRouteSessionReadAccess('idSesion'),
  getRutaSesionByIdController,
);
logisticsRouter.post('/rutas/sesiones', requireModulePermission('logistica', 'create'), createRutaSesionController);
logisticsRouter.patch(
  '/rutas/:id/sesiones/:idSesion',
  requireModulePermission('logistica', 'update'),
  requireAssignedRouteSessionAccess('idSesion'),
  updateRutaSesionController,
);
logisticsRouter.delete(
  '/rutas/:id/sesiones/:idSesion',
  requireModulePermission('logistica', 'delete'),
  requireAssignedRouteSessionAccess('idSesion'),
  deleteRutaSesionController,
);
logisticsRouter.patch(
  '/rutas/:id/sesiones/:idSesion/restaurar',
  requireModulePermission('logistica', 'update'),
  requireAssignedRouteSessionAccess('idSesion'),
  restoreRutaSesionController,
);
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
logisticsRouter.get(
  '/gastos/:id',
  requireModulePermission('logistica', 'read'),
  requireAssignedVehicleExpenseAccess(),
  getGastoVehiculoByIdController,
);
logisticsRouter.post('/gastos', requireModulePermission('logistica', 'create'), createGastoVehiculoController);
logisticsRouter.patch(
  '/gastos/:id',
  requireModulePermission('logistica', 'update'),
  requireAssignedVehicleExpenseAccess(),
  updateGastoVehiculoController,
);
logisticsRouter.delete(
  '/gastos/:id',
  requireModulePermission('logistica', 'delete'),
  requireAssignedVehicleExpenseAccess(),
  deleteGastoVehiculoController,
);
logisticsRouter.patch(
  '/gastos/:id/restaurar',
  requireModulePermission('logistica', 'update'),
  requireAssignedVehicleExpenseAccess(),
  restoreGastoVehiculoController,
);

// Fase 2 - Distribución: Jornada (D-DIST-01)
logisticsRouter.get('/jornadas', requireModulePermission('logistica', 'read'), listJornadasController);
logisticsRouter.get('/jornadas/:id', requireModulePermission('logistica', 'read'), getJornadaByIdController);
logisticsRouter.post('/jornadas', requireModulePermission('logistica', 'create'), createJornadaController);
logisticsRouter.patch(
  '/jornadas/:id/cerrar',
  requireModulePermission('logistica', 'update'),
  closeJornadaController,
);

// Fase 2 - Distribución: transferencias entre vehículos (D-DIST-04, pendiente de ratificación)
logisticsRouter.get('/transferencias', requireModulePermission('despacho', 'read'), listVehicleTransfersController);
logisticsRouter.post('/transferencias', requireModulePermission('despacho', 'create'), createVehicleTransferController);
logisticsRouter.patch(
  '/transferencias/:id/confirmar',
  requireModulePermission('despacho', 'update'),
  requireAssignedTransferAccess('DESTINO'),
  confirmVehicleTransferController,
);
logisticsRouter.patch(
  '/transferencias/:id/rechazar',
  requireModulePermission('despacho', 'update'),
  requireAssignedTransferAccess('DESTINO'),
  rejectVehicleTransferController,
);
logisticsRouter.patch(
  '/transferencias/:id/anular',
  requireModulePermission('despacho', 'update'),
  requireAssignedTransferAccess('ORIGEN'),
  cancelVehicleTransferController,
);

export default logisticsRouter;
