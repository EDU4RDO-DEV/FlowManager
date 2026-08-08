import { Router } from 'express';

import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployeeByIdController,
  listEmployeesController,
  updateEmployeeController,
} from '../controllers/employee.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';

const employeeRouter = Router();

employeeRouter.get('/', requireModulePermission('empleados', 'read'), listEmployeesController);
employeeRouter.get('/:id', requireModulePermission('empleados', 'read'), getEmployeeByIdController);
employeeRouter.post('/', requireModulePermission('empleados', 'create'), createEmployeeController);
employeeRouter.patch('/:id', requireModulePermission('empleados', 'update'), updateEmployeeController);
employeeRouter.delete('/:id', requireModulePermission('empleados', 'delete'), deleteEmployeeController);

export default employeeRouter;
