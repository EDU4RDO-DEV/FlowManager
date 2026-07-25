import { Router } from 'express';

import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployeeByIdController,
  listEmployeesController,
  updateEmployeeController,
} from '../controllers/employee.controller';
import { requireRoleNames, ROLE_GROUPS } from '../middlewares/auth.middleware';

const employeeRouter = Router();
const requireEmployeesAccess = requireRoleNames([
  ...ROLE_GROUPS.adminGerencia,
  ...ROLE_GROUPS.produccion,
]);

employeeRouter.get('/', requireEmployeesAccess, listEmployeesController);
employeeRouter.get('/:id', requireEmployeesAccess, getEmployeeByIdController);
employeeRouter.post('/', requireEmployeesAccess, createEmployeeController);
employeeRouter.patch('/:id', requireEmployeesAccess, updateEmployeeController);
employeeRouter.delete('/:id', requireEmployeesAccess, deleteEmployeeController);

export default employeeRouter;
