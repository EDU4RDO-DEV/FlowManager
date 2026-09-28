import { Router } from 'express';

import {
	assignUserRoleEntityController,
	loginController,
	logoutController,
	meController,
	refreshController,
	registerController,
} from '../controllers/auth.controller';
import {
	requireAuth,
	requireBootstrapOrModulePermission,
	requireModulePermission,
} from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/refresh', refreshController);
authRouter.get('/me', requireAuth, meController);
authRouter.post('/register', requireBootstrapOrModulePermission('usuarios', 'create'), registerController);
authRouter.post('/logout', requireAuth, logoutController);
authRouter.patch(
	'/users/:idUsuario/assignment',
	requireAuth,
	requireModulePermission('usuarios', 'update'),
	assignUserRoleEntityController,
);

export default authRouter;
