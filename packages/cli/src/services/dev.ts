import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { Console } from 'effect';
import { resolve } from 'node:path';
import * as nodeFs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DevServerError } from '../errors/index.js';
import { APP_NAME, DEFAULT_CONFIG, SERVER_TIMEOUT_MS, HTTP_STATUS } from '../constants.js';
import { EntryGenerator } from './entry-generator.js';

export interface DevOptions {
	readonly port?: number;
	readonly host?: string;
	readonly open?: boolean;
	readonly https?: boolean;
	readonly basePath?: string;
}

const createWebRequest = (req: express.Request): Request => {
	const protocol = (req.get('X-Forwarded-Proto') ?? req.protocol) as 'http' | 'https';
	const host = req.get('X-Forwarded-Host') ?? req.get('host') ?? 'localhost';
	const origin = `${protocol}://${host}`;
	const url = new URL(req.originalUrl || req.url, origin);

	const headers = new Headers(req.headers as Record<string, string>);

	const init: RequestInit = {
		method: req.method,
		headers,
	};

	const bodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
	if (bodyMethods.includes(req.method) && req.body) {
		init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
		const contentType = req.get('Content-Type');
		if (contentType) {
			headers.set('Content-Type', contentType);
		} else {
			headers.set('Content-Type', 'application/octet-stream');
		}
	}

	return new Request(url.href, init);
};

const serveStaticFiles = (app: express.Express, root: string) => {
	const publicDir = resolve(root, 'public');
	if (!existsSync(publicDir)) return;

	app.use('/public', express.static(publicDir, {
		etag: true,
		maxAge: '1y',
		immutable: true,
		dotfiles: 'ignore',
	}));
};

type ServerInstance = { close: (cb: () => void) => void };

const handleGracefulShutdown = (server: ServerInstance, vite: ViteDevServer) => {
	const shutdown = async (signal: string) => {
		Console.log(`\n[${APP_NAME}] Received ${signal}, shutting down...`);
		server.close(() => {
			Console.log('HTTP server closed.');
			process.exit(0);
		});
		setTimeout(() => {
			process.exit(1);
		}, SERVER_TIMEOUT_MS);
	};

	process.on('SIGTERM', () => shutdown('SIGTERM'));
	process.on('SIGINT', () => shutdown('SIGINT'));
};

const generateErrorOverlay = (error: Error): string => {
	const stack = error.stack?.replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '';
	const message = error.message ?? 'Unknown error';

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Error: ${message.slice(0, 50)}</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
		.error-container { background: #16213e; border: 1px solid #e94560; border-radius: 12px; padding: 32px; max-width: 800px; box-shadow: 0 20px 60px rgba(233, 69, 96, 0.3); }
		.error-title { color: #e94560; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
		.error-message { background: #0f0f23; padding: 16px; border-radius: 8px; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: #ff6b6b; }
		.error-hint { margin-top: 16px; color: #888; font-size: 14px; }
	</style>
</head>
<body>
	<div class="error-container">
		<div class="error-title">${message.slice(0, 100)}</div>
		<pre class="error-message">${stack}</pre>
		<div class="error-hint">Check the console for full stack trace</div>
	</div>
</body>
</html>`;
};

export class DevService {
	run(options: DevOptions, cwd: string): Promise<void> {
		return this.runEffect(options, cwd);
	}

	private runEffect = async (options: DevOptions, cwd: string): Promise<void> => {
		const port = options.port ?? DEFAULT_CONFIG.port;
		const host = options.host ?? DEFAULT_CONFIG.host;
		const openBrowserFlag = options.open ?? DEFAULT_CONFIG.open;
		const useHttps = options.https ?? DEFAULT_CONFIG.https;
		const basePath = options.basePath ?? DEFAULT_CONFIG.basePath;

		const entryGenerator = new EntryGenerator();
		const entries = entryGenerator.generate(cwd);

		if (entries.generated) {
			Console.log(`[${APP_NAME}] Auto-generated entry points from src/app.ts`);
			Console.log(`  Client: ${entries.client}`);
			Console.log(`  Server: ${entries.server}\n`);
		}

		Console.log(`\n[${APP_NAME}] Starting Dev Server...\n`);
		Console.log(`  Port:     ${port}`);
		Console.log(`  Host:     ${host}`);
		Console.log(`  HTTPS:    ${useHttps ? 'yes' : 'no'}`);
		Console.log(`  Base:     ${basePath}\n`);

		const app = express();
		app.use(express.json({ limit: '10mb' }));
		app.use(express.urlencoded({ extended: true, limit: '10mb' }));

		serveStaticFiles(app, cwd);

		const vite = await createViteServer({
			root: cwd,
			server: { middlewareMode: true, hmr: useHttps ? { host: 'localhost' } : true },
			appType: 'custom',
			base: basePath,
		});

		app.use(vite.middlewares);

		app.use('*', async (req, res) => {
			const startTime = Date.now();
			const url = req.originalUrl;

			try {
				let template = '';
				const indexPath = resolve(cwd, 'index.html');
				const fsStat = await nodeFs.stat(indexPath).catch(() => null);
				if (fsStat?.isFile()) {
					const fsTemplate = await nodeFs.readFile(indexPath, 'utf-8');
					template = await vite.transformIndexHtml(url, fsTemplate);
				} else {
					template = await vite.transformIndexHtml(url,
						'<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Effuse App</title></head><body><div id="app"><h1>Loading...</h1></div></body></html>'
					);
				}

				const entryModule = await vite.ssrLoadModule(`/${entries.server}`);
				if (!entryModule || typeof entryModule.handleRequest !== 'function') {
					throw new DevServerError({
						message: `Entry file ${entries.server} must export 'handleRequest' handler.`,
					});
				}

				const webRequest = createWebRequest(req);
				const webResponse: Response = await entryModule.handleRequest(webRequest);

				res.status(webResponse.status);
				webResponse.headers.forEach((value, key) => {
					if (key.toLowerCase() !== 'content-encoding') {
						res.setHeader(key, value);
					}
				});

				const timing = Date.now() - startTime;

				if (!webResponse.body) {
					res.setHeader('Server-Timing', `total;dur=${timing}`);
					return res.end();
				}

				const reader = webResponse.body.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					res.write(value);
				}
				res.setHeader('Server-Timing', `total;dur=${timing}`);
				res.end();
			} catch (e: unknown) {
				const devError = e instanceof DevServerError
					? e
					: new DevServerError({ message: String(e), cause: e });

				const nativeError = e instanceof Error ? e : new Error(String(e));
				vite.ssrFixStacktrace(nativeError);

				res.status(HTTP_STATUS.INTERNAL_ERROR);
				res.setHeader('Content-Type', 'text/html');
				res.send(generateErrorOverlay(nativeError));
			}
		});

		const protocol = useHttps ? 'https' : 'http';
		const serverUrl = `${protocol}://${host}:${port}${basePath}`;

		const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
			const srv = app.listen(port, host, () => resolve(srv)).on('error', reject);
		});

		handleGracefulShutdown(server, vite);

		if (openBrowserFlag && !process.env.CI) {
			// Browser auto-open disabled - requires 'open' package
		}

		Console.log(`\n[${APP_NAME}] Server ready at ${serverUrl}\n`);
		Console.log('  Press Ctrl+C to stop\n');
	};
}