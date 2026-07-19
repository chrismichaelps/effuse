import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { toWebRequest, writeWebResponse } from '@effuse/server';
import { Console } from 'effect';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { DevServerError } from '../errors/index.js';
import { APP_NAME, DEFAULT_CONFIG, SERVER_TIMEOUT_MS, HTTP_STATUS } from '../constants.js';
import { EntryGenerator } from './entry-generator.js';
import { effuseHMRPlugin } from '../plugins/hmr.js';

export interface DevOptions {
	readonly port?: number;
	readonly host?: string;
	readonly open?: boolean;
	readonly https?: boolean;
	readonly basePath?: string;
}

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
		await vite.close().catch((error: unknown) => {
			Console.error(`[${APP_NAME}] Vite shutdown failed: ${String(error)}`);
		});
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
		// The SSR handler consumes the raw request body as a Web `Request`
		// stream (via `toWebRequest`), so no Express body parsers are mounted —
		// they would drain the stream before the shared adapter can read it.
		serveStaticFiles(app, cwd);

		const vite = await createViteServer({
			root: cwd,
			server: { middlewareMode: true, hmr: useHttps ? { host: 'localhost' } : true },
			appType: 'custom',
			base: basePath,
			plugins: [effuseHMRPlugin()],
		});

		app.use(vite.middlewares);

		// Final fallthrough middleware (mounted at '/', not '*') so `req.url`
		// keeps the full request path — `toWebRequest` reads it directly, unlike
		// `app.use('*')` which rewrites `req.url` to the matched suffix.
		app.use(async (req, res) => {
			const startTime = Date.now();
			const controller = new AbortController();
			res.on('close', () => controller.abort());

			try {
				const entryModule = await vite.ssrLoadModule(`/${entries.server}`);
				if (!entryModule || typeof entryModule.handleRequest !== 'function') {
					throw new DevServerError({
						message: `Entry file ${entries.server} must export 'handleRequest' handler.`,
					});
				}

				const webRequest = toWebRequest(req, `${host}:${port}`, controller.signal);
				const webResponse: Response = await entryModule.handleRequest(webRequest);

				// Dev never compresses SSR output; drop any encoding header so the
				// raw stream is written verbatim, and surface render timing.
				webResponse.headers.delete('content-encoding');
				webResponse.headers.set('Server-Timing', `total;dur=${Date.now() - startTime}`);

				await writeWebResponse(
					res,
					webResponse,
					controller.signal,
					req.method === 'HEAD'
				);
			} catch (e: unknown) {
				const nativeError = e instanceof Error ? e : new Error(String(e));
				vite.ssrFixStacktrace(nativeError);

				if (res.headersSent) {
					if (!res.writableEnded) res.destroy();
					return;
				}

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
