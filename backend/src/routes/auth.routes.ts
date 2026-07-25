import { Router } from 'express';

import {
	assignUserRoleEntityController,
	loginController,
	registerController,
} from '../controllers/auth.controller';
import { requireAuth, requireBootstrapOrAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/register', requireBootstrapOrAuth, registerController);
authRouter.patch('/users/:idUsuario/assignment', requireAuth, assignUserRoleEntityController);

export default authRouter;
