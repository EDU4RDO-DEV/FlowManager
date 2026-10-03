import { Router } from 'express';

import { testNotificationController } from '../controllers/notification.controller';

const notificationRouter = Router();

// Endpoint de prueba de la integración Backend -> n8n (webhook) -> Telegram.
notificationRouter.post('/test', testNotificationController);

export default notificationRouter;
