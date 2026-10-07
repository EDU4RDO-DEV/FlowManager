import 'dotenv/config';
import { createApp } from './app';
import { closeBrowser } from './modules/reports/export/browser';

const app = createApp();
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
	console.log(`API running on http://${HOST}:${PORT}`);
});

// Cierra Chromium (Puppeteer) ordenadamente para no dejar procesos huérfanos
// al detener o reiniciar el backend (ts-node-dev respawn, docker stop, etc.).
async function shutdown() {
	server.close();
	await closeBrowser();
	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

