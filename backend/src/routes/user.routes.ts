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

const userRouter = Router();

userRouter.get('/', listUsersController);
userRouter.get('/:id', getUserByIdController);
userRouter.post('/', createUserController);
userRouter.patch('/:id/password', changeUserPasswordController);
userRouter.patch('/:id/password/reset', resetUserPasswordController);
userRouter.patch('/:id', updateUserController);
userRouter.delete('/:id', deleteUserController);

export default userRouter;