import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { requireAuth } from './middlewares/auth.middleware';
import authRouter from './routes/auth.routes';
import clientRouter from './routes/client.routes';
import employeeRouter from './routes/employee.routes';
import providerRouter from './routes/provider.routes';
import roleRouter from './routes/role.routes';
import sessionRouter from './routes/session.routes';
import userRouter from './routes/user.routes';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/clients', requireAuth, clientRouter);
app.use('/api/employees', requireAuth, employeeRouter);
app.use('/api/providers', requireAuth, providerRouter);
app.use('/api/roles', requireAuth, roleRouter);
app.use('/api/sessions', requireAuth, sessionRouter);
app.use('/api/users', requireAuth, userRouter);

app.get('/health', (_req, res) => {
	res.status(200).json({
		ok: true,
		service: 'flowmanager-backend',
		timestamp: new Date().toISOString(),
	});
});

app.use((_req, res) => {
	res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	if (
		error &&
		typeof error === 'object' &&
		'type' in error &&
		(error as { type?: string }).type === 'entity.parse.failed'
	) {
		return res.status(400).json({ ok: false, message: 'JSON inválido en el cuerpo de la solicitud' });
	}

	const message = error instanceof Error ? error.message : 'Error interno del servidor';
	return res.status(500).json({ ok: false, message });
});

app.listen(PORT, HOST, () => {
	console.log(`API running on http://${HOST}:${PORT}`);
});

