import { Router } from 'express';

import {
	assignUserRoleEntityController,
	loginController,
	registerController,
} from '../controllers/auth.controller';

const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/register', registerController);
authRouter.patch('/users/:idUsuario/assignment', assignUserRoleEntityController);

export default authRouter;
