import { relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import {
	discoverServerMiddleware,
	discoverServerRegistry,
	writeServerMiddlewareRegistryModule,
	writeServerRegistryModule,
	type ServerMiddlewareRegistry,
	type ServerMiddlewareRegistryOptions,
	type ServerRegistry,
	type ServerRegistryGenerationOptions,
	type ServerRegistryOptions,
} from '../services/server-registry.js';

const DEFAULT_API_DIR = 'src/server/api';
const DEFAULT_ACTIONS_DIR = 'src/server/actions';
const DEFAULT_MIDDLEWARE_DIR = 'src/server/middleware';
const MIDDLEWARE_OUTPUT = '.effuse/server-middleware-registry.ts';
const REGISTRY_EVENTS = new Set(['add', 'addDir', 'unlink', 'unlinkDir']);

export interface EffuseServerRegistryPluginOptions
	extends ServerRegistryOptions,
		ServerMiddlewareRegistryOptions,
		ServerRegistryGenerationOptions {
	readonly debounceMs?: number;
}

const isWithin = (root: string, target: string): boolean => {
	const path = relative(root, target);
	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..');
};

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));

export const effuseServerRegistryPlugin = (
	options: EffuseServerRegistryPluginOptions = {}
): Plugin => {
	let root = process.cwd();
	let devServer: ViteDevServer | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let detachWatcher: (() => void) | undefined;
	const debounceMs = options.debounceMs ?? 40;

	const sourceRoots = (): readonly string[] => {
		const roots = [
			resolve(root, options.apiDir ?? DEFAULT_API_DIR),
			resolve(root, options.actionsDir ?? DEFAULT_ACTIONS_DIR),
			resolve(root, options.middlewareDir ?? DEFAULT_MIDDLEWARE_DIR),
		];
		for (const sourceRoot of roots) {
			if (!isWithin(root, sourceRoot)) {
				throw new TypeError('Server watcher roots must stay within the project root.');
			}
		}
		return roots;
	};

	const compile = (): Readonly<{
		registry: ServerRegistry;
		outputPath: string;
	}> => {
		const registry = discoverServerRegistry(root, options);
		return {
			registry,
			outputPath: writeServerRegistryModule(registry, options),
		};
	};

	const compileMiddleware = (): Readonly<{
		registry: ServerMiddlewareRegistry;
		outputPath: string;
	}> => {
		const registry = discoverServerMiddleware(root, options);
		return {
			registry,
			outputPath: writeServerMiddlewareRegistryModule(registry, {
				outputPath: MIDDLEWARE_OUTPUT,
			}),
		};
	};

	const reportError = (error: unknown): void => {
		const failure = toError(error);
		devServer?.config.logger.error(`[effuse] ${failure.message}`);
		devServer?.ws.send({
			type: 'error',
			err: {
				message: failure.message,
				stack: failure.stack ?? failure.message,
			},
		});
	};

	const invalidate = (outputPath: string): void => {
		const module = devServer?.moduleGraph.getModuleById(outputPath);
		if (module) devServer?.moduleGraph.invalidateModule(module);
	};

	const commitUpdate = (): void => {
		try {
			const { outputPath } = compile();
			const middleware = compileMiddleware();
			invalidate(outputPath);
			invalidate(middleware.outputPath);
			devServer?.ws.send({ type: 'full-reload', path: '*' });
		} catch (error) {
			reportError(error);
		}
	};

	const schedule = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			commitUpdate();
		}, debounceMs);
	};

	const onWatcherEvent = (event: string, filePath: string): void => {
		if (
			REGISTRY_EVENTS.has(event) &&
			sourceRoots().some((sourceRoot) => isWithin(sourceRoot, resolve(filePath)))
		) {
			schedule();
		}
	};

	return {
		name: 'effuse-server-registry',
		enforce: 'pre',
		configResolved(config) {
			root = resolve(config.root);
		},
		buildStart() {
			const { registry } = compile();
			const middleware = compileMiddleware();
			for (const entry of [
				...registry.entries,
				...middleware.registry.entries,
			]) {
				this.addWatchFile(
					resolve(registry.rootDir, entry.filePath.replace(/^\.\//, ''))
				);
			}
		},
		configureServer(server) {
			detachWatcher?.();
			devServer = server;
			server.watcher.add([...sourceRoots()]);
			server.watcher.on('all', onWatcherEvent);
			detachWatcher = () => {
				if (timer) clearTimeout(timer);
				timer = undefined;
				server.watcher.off('all', onWatcherEvent);
				if (devServer === server) devServer = undefined;
			};
		},
		closeBundle() {
			detachWatcher?.();
			detachWatcher = undefined;
		},
	};
};
