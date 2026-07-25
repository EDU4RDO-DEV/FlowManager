import { Router } from 'express';

import {
	assignUserRoleEntityController,
	loginController,
	registerController,
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const authRouter = Router();

authRouter.post('/login', loginController);
// TODO(seguridad): volver a requireBootstrapOrAuth o proteger con invite key antes de produccion.
authRouter.post('/register', registerController);
authRouter.patch('/users/:idUsuario/assignment', requireAuth, assignUserRoleEntityController);

export default authRouter;
