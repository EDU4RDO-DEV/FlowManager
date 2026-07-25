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
import { requireAdminRole, requireSelfOrAdmin } from '../middlewares/auth.middleware';

const userRouter = Router();

userRouter.get('/', requireAdminRole, listUsersController);
userRouter.get('/:id', requireAdminRole, getUserByIdController);
userRouter.post('/', requireAdminRole, createUserController);
userRouter.patch('/:id/password', requireSelfOrAdmin, changeUserPasswordController);
userRouter.patch('/:id/password/reset', requireAdminRole, resetUserPasswordController);
userRouter.patch('/:id', requireAdminRole, updateUserController);
userRouter.delete('/:id', requireAdminRole, deleteUserController);

export default userRouter;