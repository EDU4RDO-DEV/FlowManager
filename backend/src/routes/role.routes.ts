import { Router } from 'express';

import {
  createRoleController,
  deleteRoleController,
  getRoleByIdController,
  listRolesController,
  updateRoleController,
} from '../controllers/role.controller';
import { requireAdminRole } from '../middlewares/auth.middleware';

const roleRouter = Router();

roleRouter.get('/', requireAdminRole, listRolesController);
roleRouter.get('/:id', requireAdminRole, getRoleByIdController);
roleRouter.post('/', requireAdminRole, createRoleController);
roleRouter.patch('/:id', requireAdminRole, updateRoleController);
roleRouter.delete('/:id', requireAdminRole, deleteRoleController);

export default roleRouter;