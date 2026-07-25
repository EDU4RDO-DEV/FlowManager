import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import authRouter from './routes/auth.routes';
import clientRouter from './routes/client.routes';
import roleRouter from './routes/role.routes';
import sessionRouter from './routes/session.routes';
import userRouter from './routes/user.routes';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/clients', clientRouter);
app.use('/api/roles', roleRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/users', userRouter);

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

app.listen(PORT, () => {
	console.log(`API running on http://localhost:${PORT}`);
});

