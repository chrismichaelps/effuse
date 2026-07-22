import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
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
	readonly code: 'server_route_collision' | 'server_action_collision';
	readonly target: string;
	readonly files: readonly [string, string];
	readonly message: string;
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
			`\t{ ...${JSON.stringify(metadata)}, load: ${load} },`
		)
		.join('\n');

	return `// Generated by @effuse/cli. Do not edit.\nimport type { ServerActionFileModule, ServerApiFileModule, ServerFilesInput } from '@effuse/core/server';\n\nexport const serverRegistry = [\n${renderedEntries}\n] as const;\n\nexport async function loadServerFiles(): Promise<ServerFilesInput> {\n\tconst apiEntries = serverRegistry.filter((entry) => entry.kind === 'api');\n\tconst actionEntries = serverRegistry.filter((entry) => entry.kind === 'action');\n\tconst api = Object.fromEntries(await Promise.all(apiEntries.map(async (entry) => [entry.filePath, await entry.load()]))) as Record<string, ServerApiFileModule>;\n\tconst actions = Object.fromEntries(await Promise.all(actionEntries.map(async (entry) => [entry.filePath, await entry.load()]))) as Record<string, ServerActionFileModule>;\n\treturn { api, actions };\n}\n`;
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
	writeFileSync(outputPath, source, 'utf-8');
	return outputPath;
};
