import { Router } from 'express';

import {
  createRoleController,
  deleteRoleController,
  getRoleByIdController,
  listRolesController,
  updateRoleController,
} from '../controllers/role.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const roleRouter = Router();

roleRouter.get('/', requireModulePermission('roles', 'read'), listRolesController);
roleRouter.get('/:id', requireModulePermission('roles', 'read'), getRoleByIdController);
roleRouter.post('/', requireModulePermission('roles', 'create'), createRoleController);
roleRouter.patch('/:id', requireModulePermission('roles', 'update'), updateRoleController);
roleRouter.delete('/:id', requireModulePermission('roles', 'delete'), deleteRoleController);

export default roleRouter;