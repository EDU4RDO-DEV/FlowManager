import { Router } from 'express';

import {
  createEmployeeController,
  deleteEmployeeController,
  getEmployeeByIdController,
  listAvailableEmployeesController,
  listAnulatedEmployeesController,
  listEmployeesController,
  restoreEmployeeController,
  uploadEmployeeImageController,
  updateEmployeeController,
} from '../controllers/employee.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadEmployeeImage } from '../middlewares/upload.middleware';

const employeeRouter = Router();

employeeRouter.get('/', requireModulePermission('empleados', 'read'), listEmployeesController);
employeeRouter.get('/disponibles', requireModulePermission('empleados', 'read'), listAvailableEmployeesController);
employeeRouter.get('/anulados', requireModulePermission('empleados', 'read'), listAnulatedEmployeesController);
employeeRouter.post(
  '/upload-image',
  requireModulePermission('empleados', 'read'),
  uploadEmployeeImage.single('file'),
  uploadEmployeeImageController,
);
employeeRouter.get('/:id', requireModulePermission('empleados', 'read'), getEmployeeByIdController);
employeeRouter.post('/', requireModulePermission('empleados', 'create'), createEmployeeController);
employeeRouter.patch('/:id', requireModulePermission('empleados', 'update'), updateEmployeeController);
employeeRouter.delete('/:id', requireModulePermission('empleados', 'delete'), deleteEmployeeController);
employeeRouter.patch('/:id/restaurar', requireModulePermission('empleados', 'update'), restoreEmployeeController);

export default employeeRouter;
