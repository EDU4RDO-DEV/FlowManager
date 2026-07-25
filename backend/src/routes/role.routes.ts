import { Router } from 'express';

import {
  createRoleController,
  deleteRoleController,
  getRoleByIdController,
  listRolesController,
  updateRoleController,
} from '../controllers/role.controller';

const roleRouter = Router();

roleRouter.get('/', listRolesController);
roleRouter.get('/:id', getRoleByIdController);
roleRouter.post('/', createRoleController);
roleRouter.patch('/:id', updateRoleController);
roleRouter.delete('/:id', deleteRoleController);

export default roleRouter;