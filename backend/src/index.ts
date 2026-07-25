import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
	res.status(200).json({
		ok: true,
		service: 'flowmanager-backend',
		timestamp: new Date().toISOString(),
	});
});

app.listen(PORT, () => {
	console.log(`API running on http://localhost:${PORT}`);
});

