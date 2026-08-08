import { Router } from 'express';

import {
	assignUserRoleEntityController,
	loginController,
	logoutController,
	refreshController,
	registerController,
} from '../controllers/auth.controller';
import { requireAuth, requireBootstrapOrAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshController);
authRouter.post('/register', requireBootstrapOrAuth, registerController);
authRouter.post('/logout', requireAuth, logoutController);
authRouter.patch('/users/:idUsuario/assignment', requireAuth, assignUserRoleEntityController);

export default authRouter;
