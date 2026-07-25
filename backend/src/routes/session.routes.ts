import { Router } from 'express';

import {
  createSessionController,
  deleteSessionController,
  getSessionByIdController,
  listSessionsController,
  updateSessionController,
} from '../controllers/session.controller';

const sessionRouter = Router();

sessionRouter.get('/', listSessionsController);
sessionRouter.get('/:id', getSessionByIdController);
sessionRouter.post('/', createSessionController);
sessionRouter.patch('/:id', updateSessionController);
sessionRouter.delete('/:id', deleteSessionController);

export default sessionRouter;