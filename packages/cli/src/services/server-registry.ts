import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import {
	parseRoutePattern,
	serverFileToActionName,
	serverFileToRoutePath,
} from '@effuse/core';

const DEFAULT_API_DIR = 'src/server/api';
const DEFAULT_ACTIONS_DIR = 'src/server/actions';
const DEFAULT_MIDDLEWARE_DIR = 'src/server/middleware';
const SERVER_MODULE = /\.(?:[cm]?[jt]s)$/i;
const DECLARATION = /\.d\.[cm]?ts$/i;
const TEST_MODULE = /(?:^|\.)(?:test|spec)\.[cm]?[jt]s$/i;
const EXCLUDED_DIRECTORIES = new Set(['__fixtures__', '__tests__', 'fixtures']);

export type ServerRegistryEntry =
	| Readonly<{
			kind: 'api';
			filePath: string;
			path: string;
			signature: string;
	  }>
	| Readonly<{
			kind: 'action';
			filePath: string;
			name: string;
	  }>;

export interface ServerRegistry {
	readonly rootDir: string;
	readonly entries: readonly ServerRegistryEntry[];
}

export interface ServerRegistryOptions {
	readonly apiDir?: string;
	readonly actionsDir?: string;
	readonly apiBasePath?: string;
}

export interface ServerRegistryGenerationOptions {
	readonly outputPath?: string;
}

export interface ServerRegistryDiagnostic {
	readonly code:
		| 'server_route_collision'
		| 'server_action_collision'
		| 'server_middleware_collision'
		| 'server_middleware_missing_owner';
	readonly target: string;
	readonly files: readonly [string, string];
	readonly message: string;
}

export type ServerMiddlewareScope = 'engine' | 'global' | 'layer' | 'route';

export interface ServerMiddlewareRegistryEntry {
	readonly filePath: string;
	readonly name: string;
	readonly scope: ServerMiddlewareScope;
	readonly owner: string | undefined;
}

export interface ServerMiddlewareRegistry {
	readonly rootDir: string;
	readonly entries: readonly ServerMiddlewareRegistryEntry[];
}

export interface ServerMiddlewareRegistryOptions {
	readonly middlewareDir?: string;
}

export class ServerRegistryCompilationError extends Error {
	readonly diagnostics: readonly ServerRegistryDiagnostic[];

	constructor(diagnostics: readonly ServerRegistryDiagnostic[]) {
		super(diagnostics.map(({ message }) => message).join('\n'));
		this.name = 'ServerRegistryCompilationError';
		this.diagnostics = diagnostics;
	}
}

const toPosix = (value: string): string => value.split(sep).join('/');

const isWithin = (root: string, target: string): boolean => {
	const path = relative(root, target);
	return path === '' || (!path.startsWith(`..${sep}`) && path !== '..');
};

const resolveOwnedDirectory = (root: string, input: string): string => {
	const target = resolve(root, input);
	if (!isWithin(root, target)) {
		throw new TypeError(`Server directory must stay within the project root: ${input}`);
	}
	return target;
};

const shouldIncludeFile = (name: string): boolean =>
	SERVER_MODULE.test(name) &&
	!DECLARATION.test(name) &&
	!TEST_MODULE.test(name) &&
	!name.startsWith('.');

const collectFiles = (directory: string): readonly string[] => {
	if (!existsSync(directory)) return [];
	if (!statSync(directory).isDirectory()) {
		throw new TypeError(`Server source root is not a directory: ${directory}`);
	}

	const files: string[] = [];
	const visit = (current: string): void => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
			const path = resolve(current, entry.name);
			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRECTORIES.has(entry.name)) visit(path);
			} else if (entry.isFile() && shouldIncludeFile(entry.name)) {
				files.push(path);
			}
		}
	};

	visit(directory);
	return files;
};

const projectFilePath = (root: string, filePath: string): string =>
	`./${toPosix(relative(root, filePath))}`;

const compareEntries = (left: ServerRegistryEntry, right: ServerRegistryEntry) =>
	left.filePath < right.filePath ? -1 : left.filePath > right.filePath ? 1 : 0;

export const discoverServerRegistry = (
	cwd: string,
	options: ServerRegistryOptions = {}
): ServerRegistry => {
	const rootDir = realpathSync(resolve(cwd));
	if (!lstatSync(rootDir).isDirectory()) {
		throw new TypeError(`Project root is not a directory: ${cwd}`);
	}
	const apiDir = resolveOwnedDirectory(rootDir, options.apiDir ?? DEFAULT_API_DIR);
	const actionsDir = resolveOwnedDirectory(
		rootDir,
		options.actionsDir ?? DEFAULT_ACTIONS_DIR
	);
	const entries: ServerRegistryEntry[] = [
		...collectFiles(apiDir).map((filePath): ServerRegistryEntry => {
			const source = projectFilePath(rootDir, filePath);
			const path = serverFileToRoutePath(source, {
				apiDir: toPosix(relative(rootDir, apiDir)),
				...(options.apiBasePath
					? { apiBasePath: options.apiBasePath }
					: {}),
			});
			return {
				kind: 'api',
				filePath: source,
				path,
				signature: parseRoutePattern(path).signature,
			};
		}),
		...collectFiles(actionsDir).map((filePath): ServerRegistryEntry => {
			const source = projectFilePath(rootDir, filePath);
			return {
				kind: 'action',
				filePath: source,
				name: serverFileToActionName(source, {
					actionsDir: toPosix(relative(rootDir, actionsDir)),
				}),
			};
		}),
	].sort(compareEntries);

	const owners = new Map<string, ServerRegistryEntry>();
	const diagnostics: ServerRegistryDiagnostic[] = [];
	for (const entry of entries) {
		const target = entry.kind === 'api' ? entry.signature : entry.name;
		const key = `${entry.kind}:${target}`;
		const owner = owners.get(key);
		if (!owner) {
			owners.set(key, entry);
			continue;
		}
		diagnostics.push({
			code:
				entry.kind === 'api'
					? 'server_route_collision'
					: 'server_action_collision',
			target,
			files: [owner.filePath, entry.filePath],
			message: `Server ${entry.kind} collision for "${target}" between ${owner.filePath} and ${entry.filePath}.`,
		});
	}
	if (diagnostics.length > 0) throw new ServerRegistryCompilationError(diagnostics);

	return Object.freeze({
		rootDir,
		entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
	});
};

const stripModuleExtension = (value: string): string =>
	value.replace(SERVER_MODULE, '');

interface MiddlewareScopeResolution {
	readonly scope: ServerMiddlewareScope;
	readonly owner: string | undefined;
	readonly missingOwner: boolean;
}

// Derives a middleware's onion scope from its directory convention:
// `layers/<owner>/...` is layer-scoped, `routes/...` is route-scoped, and
// everything else at the middleware root is application-global. The framework
// owns the `engine` scope, so filesystem middleware never claims it.
const resolveMiddlewareScope = (
	relativePosix: string
): MiddlewareScopeResolution => {
	const segments = relativePosix.split('/');
	if (segments[0] === 'layers') {
		const owner = segments[1];
		if (segments.length < 3 || owner === undefined || owner === '') {
			return { scope: 'layer', owner: undefined, missingOwner: true };
		}
		return { scope: 'layer', owner, missingOwner: false };
	}
	if (segments[0] === 'routes') {
		return { scope: 'route', owner: undefined, missingOwner: false };
	}
	return { scope: 'global', owner: undefined, missingOwner: false };
};

export const discoverServerMiddleware = (
	cwd: string,
	options: ServerMiddlewareRegistryOptions = {}
): ServerMiddlewareRegistry => {
	const rootDir = realpathSync(resolve(cwd));
	if (!lstatSync(rootDir).isDirectory()) {
		throw new TypeError(`Project root is not a directory: ${cwd}`);
	}
	const middlewareDir = resolveOwnedDirectory(
		rootDir,
		options.middlewareDir ?? DEFAULT_MIDDLEWARE_DIR
	);

	const diagnostics: ServerRegistryDiagnostic[] = [];
	const entries = collectFiles(middlewareDir)
		.map((filePath): ServerMiddlewareRegistryEntry => {
			const relativeToDir = toPosix(relative(middlewareDir, filePath));
			const name = stripModuleExtension(relativeToDir);
			const { scope, owner, missingOwner } =
				resolveMiddlewareScope(relativeToDir);
			if (missingOwner) {
				diagnostics.push({
					code: 'server_middleware_missing_owner',
					target: name,
					files: [
						projectFilePath(rootDir, filePath),
						projectFilePath(rootDir, filePath),
					],
					message: `Layer-scoped middleware "${projectFilePath(
						rootDir,
						filePath
					)}" must live under layers/<owner>/.`,
				});
			}
			return {
				filePath: projectFilePath(rootDir, filePath),
				name,
				scope,
				owner,
			};
		})
		.sort((left, right) =>
			left.filePath < right.filePath
				? -1
				: left.filePath > right.filePath
					? 1
					: 0
		);

	const owners = new Map<string, ServerMiddlewareRegistryEntry>();
	for (const entry of entries) {
		const existing = owners.get(entry.name);
		if (!existing) {
			owners.set(entry.name, entry);
			continue;
		}
		diagnostics.push({
			code: 'server_middleware_collision',
			target: entry.name,
			files: [existing.filePath, entry.filePath],
			message: `Server middleware collision for "${entry.name}" between ${existing.filePath} and ${entry.filePath}.`,
		});
	}

	if (diagnostics.length > 0) {
		throw new ServerRegistryCompilationError(diagnostics);
	}

	return Object.freeze({
		rootDir,
		entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
	});
};

const importSpecifier = (
	rootDir: string,
	outputPath: string,
	filePath: string
): string => {
	const source = resolve(rootDir, filePath.replace(/^\.\//, ''));
	let specifier = toPosix(relative(dirname(outputPath), source));
	if (!specifier.startsWith('.')) specifier = `./${specifier}`;
	return specifier;
};

export const generateServerMiddlewareRegistryModule = (
	registry: ServerMiddlewareRegistry,
	options: ServerRegistryGenerationOptions = {}
): string => {
	const outputPath = resolve(
		registry.rootDir,
		options.outputPath ?? '.effuse/server-middleware-registry.ts'
	);
	if (!isWithin(registry.rootDir, outputPath)) {
		throw new TypeError(
			'Generated server middleware registry must stay within the project root.'
		);
	}

	const renderedEntries = registry.entries
		.map((entry) => {
			const metadata = `{ name: ${JSON.stringify(
				entry.name
			)}, scope: ${JSON.stringify(entry.scope)}, owner: ${JSON.stringify(
				entry.owner ?? null
			)}, filePath: ${JSON.stringify(entry.filePath)} }`;
			const load = `() => import(${JSON.stringify(
				importSpecifier(registry.rootDir, outputPath, entry.filePath)
			)})`;
			return `\tObject.freeze({ ...${metadata}, load: ${load} }),`;
		})
		.join('\n');

	return `// Generated by @effuse/cli. Do not edit.\nimport { compileServerMiddlewareGraph, type ServerMiddlewareGraphInput, type DefinedServerMiddleware } from '@effuse/core/server';\n\nexport const serverMiddlewareRegistry = Object.freeze([\n${renderedEntries}\n] as const);\n\nexport async function loadServerMiddlewareGraph() {\n\tconst inputs = await Promise.all(\n\t\tserverMiddlewareRegistry.map(async (entry): Promise<ServerMiddlewareGraphInput> => {\n\t\t\tconst module = (await entry.load()) as unknown as { default: DefinedServerMiddleware };\n\t\t\tconst middleware = module.default;\n\t\t\treturn entry.owner === null\n\t\t\t\t? { scope: entry.scope, middleware }\n\t\t\t\t: { scope: entry.scope, owner: entry.owner, middleware };\n\t\t})\n\t);\n\treturn compileServerMiddlewareGraph(inputs);\n}\n`;
};

export const generateServerRegistryModule = (
	registry: ServerRegistry,
	options: ServerRegistryGenerationOptions = {}
): string => {
	const outputPath = resolve(
		registry.rootDir,
		options.outputPath ?? '.effuse/server-registry.ts'
	);
	if (!isWithin(registry.rootDir, outputPath)) {
		throw new TypeError('Generated server registry must stay within the project root.');
	}
	const entries = registry.entries.map((entry) => ({
		...entry,
		load: `() => import(${JSON.stringify(
			importSpecifier(registry.rootDir, outputPath, entry.filePath)
		)})`,
	}));
	const renderedEntries = entries
		.map(({ load, ...metadata }) =>
			`\tObject.freeze({ ...${JSON.stringify(metadata)}, load: ${load} }),`
		)
		.join('\n');

	return `// Generated by @effuse/cli. Do not edit.\nimport { compileServerFileRegistry, matchServerFileRequest, type ServerActionFileModule, type ServerApiFileModule, type ServerFileMatch, type ServerFileMatchOptions, type ServerFilesInput } from '@effuse/core/server';\n\nexport const serverRegistry = Object.freeze([\n${renderedEntries}\n] as const);\n\nexport const compiledServerRegistry = compileServerFileRegistry(serverRegistry);\n\nexport function matchServerFile(request: Request, options?: ServerFileMatchOptions): ServerFileMatch | null {\n\treturn matchServerFileRequest(request, compiledServerRegistry, options);\n}\n\nexport async function loadServerFiles(): Promise<ServerFilesInput> {\n\tconst apiEntries = serverRegistry.filter((entry) => entry.kind === 'api');\n\tconst actionEntries = serverRegistry.filter((entry) => entry.kind === 'action');\n\tconst api = Object.fromEntries(await Promise.all(apiEntries.map(async (entry) => [entry.filePath, await entry.load()]))) as Record<string, ServerApiFileModule>;\n\tconst actions = Object.fromEntries(await Promise.all(actionEntries.map(async (entry) => [entry.filePath, await entry.load()]))) as Record<string, ServerActionFileModule>;\n\treturn { api, actions };\n}\n`;
};

export const writeServerRegistryModule = (
	registry: ServerRegistry,
	options: ServerRegistryGenerationOptions = {}
): string => {
	const outputPath = resolve(
		registry.rootDir,
		options.outputPath ?? '.effuse/server-registry.ts'
	);
	const source = generateServerRegistryModule(registry, options);
	mkdirSync(dirname(outputPath), { recursive: true });
	const temporaryPath = `${outputPath}.tmp-${String(process.pid)}-${String(Date.now())}`;
	try {
		writeFileSync(temporaryPath, source, 'utf-8');
		renameSync(temporaryPath, outputPath);
	} catch (error) {
		rmSync(temporaryPath, { force: true });
		throw error;
	}
	return outputPath;
};
