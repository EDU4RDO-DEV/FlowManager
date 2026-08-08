import { Router } from 'express';

import {
  createRoleController,
  deleteRoleController,
  getRoleByIdController,
  listAnulatedRolesController,
  listRolesController,
  restoreRoleController,
  updateRoleController,
} from '../controllers/role.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const roleRouter = Router();

roleRouter.get('/', requireModulePermission('roles', 'read'), listRolesController);
roleRouter.get('/anulados', requireModulePermission('roles', 'read'), listAnulatedRolesController);
roleRouter.get('/:id', requireModulePermission('roles', 'read'), getRoleByIdController);
roleRouter.post('/', requireModulePermission('roles', 'create'), createRoleController);
roleRouter.patch('/:id', requireModulePermission('roles', 'update'), updateRoleController);
roleRouter.delete('/:id', requireModulePermission('roles', 'delete'), deleteRoleController);
roleRouter.patch('/:id/restaurar', requireModulePermission('roles', 'update'), restoreRoleController);

export default roleRouter;