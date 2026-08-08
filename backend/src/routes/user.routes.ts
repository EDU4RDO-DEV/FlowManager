import { Router } from 'express';

import {
  changeUserPasswordController,
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  resetUserPasswordController,
  updateUserController,
} from '../controllers/user.controller';
import {
  requireModulePermission,
  requireSelfOrAdmin,
} from '../middlewares/auth.middleware';

const userRouter = Router();

userRouter.get('/', requireModulePermission('usuarios', 'read'), listUsersController);
userRouter.get('/:id', requireModulePermission('usuarios', 'read'), getUserByIdController);
userRouter.post('/', requireModulePermission('usuarios', 'create'), createUserController);
userRouter.patch('/:id/password', requireSelfOrAdmin, changeUserPasswordController);
userRouter.patch('/:id/password/reset', requireModulePermission('usuarios', 'update'), resetUserPasswordController);
userRouter.patch('/:id', requireModulePermission('usuarios', 'update'), updateUserController);
userRouter.delete('/:id', requireModulePermission('usuarios', 'delete'), deleteUserController);

export default userRouter;