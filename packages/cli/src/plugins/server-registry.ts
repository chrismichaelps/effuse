import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import {
	discoverServerMiddleware,
	discoverServerRegistry,
	DEFAULT_SERVER_MIDDLEWARE_REGISTRY_OUTPUT,
	DEFAULT_SERVER_REGISTRY_OUTPUT,
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

const runtimeModulePath = (sourcePath: string): string | undefined => {
	if (sourcePath.endsWith('.mts')) return `${sourcePath.slice(0, -4)}.mjs`;
	if (sourcePath.endsWith('.cts')) return `${sourcePath.slice(0, -4)}.cjs`;
	if (sourcePath.endsWith('.tsx')) return `${sourcePath.slice(0, -4)}.js`;
	if (sourcePath.endsWith('.ts')) return `${sourcePath.slice(0, -3)}.js`;
	return undefined;
};

/**
 * Vite reports importers through their real path, while a configured root can
 * still carry symlinked segments. Comparing both sides in real-path form keeps
 * generated-artifact specifiers matchable.
 */
const canonicalDir = (path: string): string => {
	const absolute = resolve(path);
	const trail: string[] = [];
	let current = absolute;
	for (;;) {
		try {
			return resolve(realpathSync.native(current), ...trail.reverse());
		} catch {
			const parent = dirname(current);
			if (parent === current) return absolute;
			trail.push(basename(current));
			current = parent;
		}
	}
};

export const effuseServerRegistryPlugin = (
	options: EffuseServerRegistryPluginOptions = {}
): Plugin => {
	let root = process.cwd();
	let devServer: ViteDevServer | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let detachWatcher: (() => void) | undefined;
	const debounceMs = options.debounceMs ?? 40;
	const registryOutputPath = (): string =>
		resolve(canonicalDir(root), options.outputPath ?? DEFAULT_SERVER_REGISTRY_OUTPUT);

	const middlewareOutputPath = (): string =>
		resolve(canonicalDir(root), DEFAULT_SERVER_MIDDLEWARE_REGISTRY_OUTPUT);

	const importedPath = (
		source: string,
		importer: string | undefined
	): string | undefined => {
		if (importer === undefined) return undefined;
		const cleanSource = source.split('?')[0] ?? source;
		if (isAbsolute(cleanSource)) {
			return resolve(canonicalDir(dirname(cleanSource)), basename(cleanSource));
		}
		if (!cleanSource.startsWith('.')) return undefined;
		const cleanImporter = importer.split('?')[0] ?? importer;
		return resolve(canonicalDir(dirname(cleanImporter)), cleanSource);
	};

	/**
	 * Owns both the documented runtime specifier and the generated source path so
	 * development SSR never depends on Vite remapping `.js` to `.ts`, and so a
	 * missing artifact is rebuilt instead of failing the request.
	 */
	const resolveGeneratedImport = (
		source: string,
		importer: string | undefined
	): string | undefined => {
		const candidate = importedPath(source, importer);
		if (candidate === undefined) return undefined;
		for (const [outputPath, generate] of [
			[registryOutputPath(), compile],
			[middlewareOutputPath(), compileMiddleware],
		] as const) {
			if (candidate !== outputPath && candidate !== runtimeModulePath(outputPath)) {
				continue;
			}
			if (!existsSync(outputPath)) generate();
			return outputPath;
		}
		return undefined;
	};

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
				outputPath: DEFAULT_SERVER_MIDDLEWARE_REGISTRY_OUTPUT,
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
		resolveId(source, importer) {
			return resolveGeneratedImport(source, importer) ?? null;
		},
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
