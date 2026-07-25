import { Router } from 'express';

import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController,
} from '../controllers/user.controller';

const userRouter = Router();

userRouter.get('/', listUsersController);
userRouter.get('/:id', getUserByIdController);
userRouter.post('/', createUserController);
userRouter.patch('/:id', updateUserController);
userRouter.delete('/:id', deleteUserController);

export default userRouter;