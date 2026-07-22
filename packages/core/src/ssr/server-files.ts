/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type {
	HttpMethod,
	MaybePromise,
	ServerActionInput,
	ServerHandler,
	ServerLayerContext,
	ServerLayerDiagnostic,
	ServerLayerConfig,
	ServerMiddleware,
	ServerMethodHandlers,
	ServerRouteMetadata,
	ServerRoute,
	ServerRouteInput,
	ServerResult,
} from '../layers/types.js';
import {
	isHttpMethod,
	normalizeServerRouteInput,
} from './server-routes.js';
import { parseRoutePattern } from '../routing/route-pattern.js';
import type { MatchedRouteParams } from '../routing/route-pattern.js';
import type {
	AnyServerRequestContract,
	ServerRequestContractOutput,
} from './request-contract.js';
import type { AnyServerValidator } from './validation.js';

const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
];

const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS);

declare const SERVER_FILE_HANDLER_PATH: unique symbol;

export type ServerRouteParams<Path extends string> = MatchedRouteParams<Path>;

export type ServerFileContext<
	Path extends string,
	Services extends Record<string, unknown> = Record<string, unknown>,
> = Omit<ServerLayerContext<Services>, 'params'> & {
	readonly params: ServerRouteParams<Path>;
};

export type ServerFileContractContext<
	Path extends string,
	Contract extends AnyServerRequestContract,
	Services extends Record<string, unknown> = Record<string, unknown>,
> = ServerFileContext<Path, Services> & {
	readonly input: ServerRequestContractOutput<Contract>;
};

export type ServerFileHandler<
	Path extends string,
	Services extends Record<string, unknown> = Record<string, unknown>,
	Contract extends AnyServerRequestContract | undefined = undefined,
> = ServerHandler<Services> & {
	readonly [SERVER_FILE_HANDLER_PATH]: {
		readonly path: Path;
		readonly request: Contract;
	};
};

interface ServerFileHandlerDescriptor {
	readonly path: string;
	readonly request?: AnyServerRequestContract;
}

const serverFileHandlerDescriptors = new WeakMap<
	object,
	ServerFileHandlerDescriptor
>();

/** Contextually type a file handler while preserving the original function. */
export function defineServerFileHandler<
	const Path extends string,
	Services extends Record<string, unknown> = Record<string, unknown>,
>(
	path: Path,
	handler: (
		context: ServerFileContext<Path, Services>
	) => MaybePromise<ServerResult>
): ServerFileHandler<Path, Services>;
export function defineServerFileHandler<
	const Path extends string,
	const Contract extends AnyServerRequestContract,
	Services extends Record<string, unknown> = Record<string, unknown>,
>(
	path: Path,
	request: Contract,
	handler: (
		context: ServerFileContractContext<Path, Contract, Services>
	) => MaybePromise<ServerResult>
): ServerFileHandler<Path, Services, Contract>;
export function defineServerFileHandler(
	path: string,
	requestOrHandler:
		| AnyServerRequestContract
		| ((context: ServerFileContext<string>) => MaybePromise<ServerResult>),
	maybeHandler?: (
		context: ServerFileContractContext<string, AnyServerRequestContract>
	) => MaybePromise<ServerResult>
): ServerFileHandler<string> {
	const normalizedPath = parseRoutePattern(path).path;
	const request =
		typeof requestOrHandler === 'function' ? undefined : requestOrHandler;
	const handler =
		typeof requestOrHandler === 'function' ? requestOrHandler : maybeHandler;
	if (!handler) {
		throw new TypeError('Effuse file handlers require a handler function.');
	}
	serverFileHandlerDescriptors.set(handler, {
		path: normalizedPath,
		...(request ? { request } : {}),
	});
	return handler as unknown as ServerFileHandler<string>;
}

export interface ServerApiFileModule {
	readonly path?: string;
	readonly default?: ServerRouteInput;
	readonly handler?: ServerRouteInput;
	readonly metadata?: ServerRouteMetadata;
	readonly methods?: ServerMethodHandlers;
	readonly middleware?: readonly ServerMiddleware[];
	readonly request?: AnyServerRequestContract;
	readonly response?: AnyServerValidator;
	readonly GET?: ServerHandler;
	readonly POST?: ServerHandler;
	readonly PUT?: ServerHandler;
	readonly PATCH?: ServerHandler;
	readonly DELETE?: ServerHandler;
	readonly OPTIONS?: ServerHandler;
	readonly HEAD?: ServerHandler;
}

export interface ServerActionFileModule {
	readonly name?: string;
	readonly default?: ServerActionInput;
	readonly action?: ServerActionInput;
	readonly POST?: ServerActionInput;
	readonly actions?: Readonly<Record<string, ServerActionInput>>;
	readonly metadata?: ServerRouteMetadata;
	readonly middleware?: readonly ServerMiddleware[];
}

export type ServerFileSource<M> = Readonly<Record<string, M>>;

export interface ServerFilesInput {
	readonly api?: ServerFileSource<ServerApiFileModule>;
	readonly actions?: ServerFileSource<ServerActionFileModule>;
}

export interface ServerFilesOptions {
	readonly apiDir?: string | readonly string[];
	readonly actionsDir?: string | readonly string[];
	readonly apiBasePath?: string;
}

const DEFAULT_API_DIRS = ['src/server/api', 'app/api', 'src/api'] as const;
const DEFAULT_ACTIONS_DIRS = [
	'src/server/actions',
	'app/actions',
	'src/actions',
] as const;
const DEFAULT_API_BASE_PATH = '/api';

const normalizeFilePath = (path: string): string =>
	path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

const normalizeDir = (path: string): string =>
	normalizeFilePath(path).replace(/\/+$/g, '');

const normalizeDirs = (
	input: string | readonly string[] | undefined,
	defaults: readonly string[]
): readonly string[] =>
	(input === undefined ? defaults : Array.isArray(input) ? input : [input]).map(
		normalizeDir
	);

const stripExtension = (path: string): string =>
	path.replace(/\.(?:[cm]?[jt]sx?)$/i, '');

const stripRoot = (filePath: string, root: string): string => {
	const normalizedFile = normalizeFilePath(filePath);
	const normalizedRoot = normalizeDir(root);
	const marker = `/${normalizedRoot}/`;
	const markerIndex = normalizedFile.indexOf(marker);

	if (normalizedFile.startsWith(`${normalizedRoot}/`)) {
		return normalizedFile.slice(normalizedRoot.length + 1);
	}

	if (markerIndex >= 0) {
		return normalizedFile.slice(markerIndex + marker.length);
	}

	return normalizedFile;
};

const stripFirstMatchingRoot = (
	filePath: string,
	roots: readonly string[]
): string => {
	const normalizedFile = normalizeFilePath(filePath);

	for (const root of roots) {
		const stripped = stripRoot(normalizedFile, root);
		if (stripped !== normalizedFile) {
			return stripped;
		}
	}

	return normalizedFile;
};

const trimRouteFileSegment = (path: string): string =>
	path.replace(/\/(?:route|index)$/i, '').replace(/^(?:route|index)$/i, '');

const stripRouteGroupSegments = (path: string): string =>
	parseRoutePattern(path.startsWith('/') ? path : `/${path}`).path.replace(
		/^\//,
		''
	);

const joinPath = (basePath: string, path: string): string => {
	const normalizedBase = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
	const normalizedPath = path.replace(/^\/+|\/+$/g, '');
	return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
};

export const serverFileToRoutePath = (
	filePath: string,
	options: ServerFilesOptions = {}
): string => {
	const apiDirs = normalizeDirs(options.apiDir, DEFAULT_API_DIRS);
	const apiBasePath = options.apiBasePath ?? DEFAULT_API_BASE_PATH;
	const path = stripRouteGroupSegments(
		trimRouteFileSegment(
			stripExtension(stripFirstMatchingRoot(filePath, apiDirs))
		)
	);
	return joinPath(apiBasePath, path);
};

export const serverFileToActionName = (
	filePath: string,
	options: ServerFilesOptions = {}
): string => {
	const actionsDirs = normalizeDirs(options.actionsDir, DEFAULT_ACTIONS_DIRS);
	return stripRouteGroupSegments(
		trimRouteFileSegment(
			stripExtension(stripFirstMatchingRoot(filePath, actionsDirs))
		)
	).replace(/^\/+|\/+$/g, '');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const collectMethodExports = (
	module: ServerApiFileModule
): ServerMethodHandlers => {
	const methods: ServerMethodHandlers = {};
	const source = module as Record<string, unknown>;

	for (const method of HTTP_METHODS) {
		const handler = source[method];
		if (typeof handler === 'function') {
			methods[method] = handler as ServerHandler;
		}
	}

	return methods;
};

const collectHandlerDescriptors = (
	module: ServerApiFileModule
): readonly ServerFileHandlerDescriptor[] => {
	const handlers: ServerHandler[] = [];
	const source = module as Record<string, unknown>;
	for (const method of HTTP_METHODS) {
		const handler = source[method];
		if (typeof handler === 'function') handlers.push(handler as ServerHandler);
	}
	for (const handler of Object.values(module.methods ?? {})) {
		if (typeof handler === 'function') handlers.push(handler);
	}
	if (typeof module.handler === 'function') handlers.push(module.handler);
	if (typeof module.default === 'function') handlers.push(module.default);
	return [
		...new Set(
			handlers
				.map((handler) => serverFileHandlerDescriptors.get(handler))
				.filter(
					(descriptor): descriptor is ServerFileHandlerDescriptor =>
						descriptor !== undefined
				)
		),
	];
};

const hasMethods = (methods: ServerMethodHandlers): boolean =>
	Object.keys(methods).some(isHttpMethod);

const createFileDiagnostic = (
	code: ServerLayerDiagnostic['code'],
	filePath: string,
	target: string,
	key: string,
	message: string
): ServerLayerDiagnostic => ({
	code,
	filePath,
	key,
	message,
	target,
});

const collectInvalidMethodDiagnostics = (
	filePath: string,
	module: ServerApiFileModule
): readonly ServerLayerDiagnostic[] => {
	const diagnostics: ServerLayerDiagnostic[] = [];
	const source = module as Record<string, unknown>;

	for (const [key, value] of Object.entries(source)) {
		const normalizedKey = key.toUpperCase();
		if (!HTTP_METHOD_SET.has(normalizedKey)) continue;
		if (key !== normalizedKey || typeof value !== 'function') {
			diagnostics.push(
				createFileDiagnostic(
					'server_file_invalid_method',
					filePath,
					filePath,
					key,
					`Server file ${filePath} exports invalid HTTP method "${key}". Use uppercase method functions such as GET or POST.`
				)
			);
		}
	}

	if (module.methods) {
		for (const [method, handler] of Object.entries(module.methods)) {
			const normalizedMethod = method.toUpperCase();
			if (
				method !== normalizedMethod ||
				!isHttpMethod(normalizedMethod) ||
				typeof handler !== 'function'
			) {
				diagnostics.push(
					createFileDiagnostic(
						'server_file_invalid_method',
						filePath,
						filePath,
						method,
						`Server file ${filePath} declares invalid method "${method}".`
					)
				);
			}
		}
	}

	return diagnostics;
};

const resolveRouteInput = (
	module: ServerApiFileModule
): ServerRouteInput | null => {
	const methodExports = collectMethodExports(module);
	if (hasMethods(methodExports)) {
		return {
			...methodExports,
			metadata: module.metadata,
			middleware: module.middleware,
			request: module.request,
			response: module.response,
		};
	}

	if (module.methods) {
		return {
			methods: module.methods,
			metadata: module.metadata,
			middleware: module.middleware,
			request: module.request,
			response: module.response,
		};
	}

	if (module.handler) {
		return typeof module.handler === 'function'
			? {
					handler: module.handler,
					metadata: module.metadata,
					middleware: module.middleware,
					request: module.request,
					response: module.response,
				}
			: module.handler;
	}

	if (module.default) {
		return typeof module.default === 'function'
			? {
					handler: module.default,
					metadata: module.metadata,
					middleware: module.middleware,
					request: module.request,
					response: module.response,
				}
			: module.default;
	}

	return null;
};

interface ServerFileRouteResult {
	readonly diagnostics: readonly ServerLayerDiagnostic[];
	readonly filePath: string;
	readonly route?: ServerRoute;
}

const withRouteDiagnostics = (
	route: ServerRoute,
	diagnostics: readonly ServerLayerDiagnostic[]
): ServerRoute =>
	diagnostics.length > 0
		? { ...route, diagnostics: [...(route.diagnostics ?? []), ...diagnostics] }
		: route;

const createServerFileRoute = (
	filePath: string,
	module: ServerApiFileModule,
	options: ServerFilesOptions
): ServerFileRouteResult => {
	const diagnostics = [...collectInvalidMethodDiagnostics(filePath, module)];
	const path = module.path ?? serverFileToRoutePath(filePath, options);
	const normalizedPath = parseRoutePattern(path).path;
	const handlerDescriptors = collectHandlerDescriptors(module);
	const mismatchedPaths = handlerDescriptors.filter(
		(descriptor) => descriptor.path !== normalizedPath
	);
	if (mismatchedPaths.length > 0) {
		return {
			diagnostics: [
				...diagnostics,
				...mismatchedPaths.map((descriptor) =>
					createFileDiagnostic(
						'server_file_path_mismatch',
						filePath,
						normalizedPath,
						descriptor.path,
						`Server file ${filePath} resolves to ${normalizedPath}, but its handler declares ${descriptor.path}. Keep the path witness synchronized with the file route.`
					)
				),
			],
			filePath,
		};
	}
	const mismatchedContracts = handlerDescriptors.filter(
		(descriptor) =>
			descriptor.request !== undefined && descriptor.request !== module.request
	);
	if (mismatchedContracts.length > 0) {
		return {
			diagnostics: [
				...diagnostics,
				createFileDiagnostic(
					'server_file_contract_mismatch',
					filePath,
					normalizedPath,
					'request',
					`Server file ${filePath} must export the same request contract passed to defineServerFileHandler.`
				),
			],
			filePath,
		};
	}
	const input = resolveRouteInput(module);
	if (!input) {
		return {
			diagnostics: [
				...diagnostics,
				createFileDiagnostic(
					'server_file_invalid_route',
					filePath,
					path,
					path,
					`Server API file ${filePath} does not export a route handler.`
				),
			],
			filePath,
		};
	}

	const route = normalizeServerRouteInput(path, input);
	if (!hasMethods(route.methods)) {
		return {
			diagnostics: [
				...diagnostics,
				createFileDiagnostic(
					'server_file_invalid_route',
					filePath,
					path,
					path,
					`Server API file ${filePath} does not export any valid HTTP method handlers.`
				),
			],
			filePath,
		};
	}

	return {
		diagnostics,
		filePath,
		route: withRouteDiagnostics(route, diagnostics),
	};
};

const joinActionName = (baseName: string, name: string): string => {
	const normalizedBase = baseName.replace(/^\/+|\/+$/g, '');
	const normalizedName = name.replace(/^\/+|\/+$/g, '');
	return normalizedBase ? `${normalizedBase}/${normalizedName}` : normalizedName;
};

const collectActions = (
	filePath: string,
	module: ServerActionFileModule,
	options: ServerFilesOptions
): readonly (readonly [string, ServerActionInput])[] => {
	const baseName = module.name ?? serverFileToActionName(filePath, options);
	const actions: [string, ServerActionInput][] = [];

	if (module.actions && isRecord(module.actions)) {
		for (const [name, handler] of Object.entries(module.actions)) {
			if (typeof handler === 'function' || isRecord(handler)) {
				actions.push([joinActionName(baseName, name), handler]);
			}
		}
		return actions;
	}

	const handler = module.action ?? module.POST ?? module.default;
	if (handler) {
		actions.push([
			baseName,
			typeof handler === 'function'
				? {
						handler,
						metadata: module.metadata,
						middleware: module.middleware,
					}
				: handler,
		]);
	}

	return actions;
};

const createRouteSignature = (path: string): string =>
	parseRoutePattern(path).signature;

const isGroupedInput = (
	files:
		| ServerFileSource<ServerApiFileModule | ServerActionFileModule>
		| ServerFilesInput
): files is ServerFilesInput => 'api' in files || 'actions' in files;

const partitionFlatInput = (
	files: ServerFileSource<ServerApiFileModule | ServerActionFileModule>,
	options: ServerFilesOptions
): ServerFilesInput => {
	const api: Record<string, ServerApiFileModule> = {};
	const actions: Record<string, ServerActionFileModule> = {};
	const actionsDirs = normalizeDirs(options.actionsDir, DEFAULT_ACTIONS_DIRS);

	for (const [filePath, module] of Object.entries(files)) {
		const normalizedPath = normalizeFilePath(filePath);
		const isActionFile = actionsDirs.some(
			(actionsDir) =>
				normalizedPath.startsWith(`${actionsDir}/`) ||
				normalizedPath.includes(`/${actionsDir}/`)
		);
		if (isActionFile) {
			actions[filePath] = module as ServerActionFileModule;
		} else {
			api[filePath] = module as ServerApiFileModule;
		}
	}

	return { api, actions };
};

export const fromServerFiles = (
	files:
		| ServerFileSource<ServerApiFileModule | ServerActionFileModule>
		| ServerFilesInput,
	options: ServerFilesOptions = {}
): ServerLayerConfig => {
	const grouped = isGroupedInput(files)
		? files
		: partitionFlatInput(files, options);
	const routes: ServerRoute[] = [];
	const actions: Record<string, ServerActionInput> = {};
	const diagnostics: ServerLayerDiagnostic[] = [];
	const routeFilesByPath = new Map<string, string>();
	const routeFilesBySignature = new Map<string, { path: string; filePath: string }>();

	for (const [filePath, module] of Object.entries(grouped.api ?? {})) {
		const result = createServerFileRoute(filePath, module, options);
		if (!result.route) {
			diagnostics.push(...result.diagnostics);
			continue;
		}

		const duplicateFilePath = routeFilesByPath.get(result.route.path);
		if (duplicateFilePath) {
			diagnostics.push(
				...result.diagnostics,
				createFileDiagnostic(
					'server_file_duplicate_route',
					filePath,
					result.route.path,
					result.route.path,
					`Server API file ${filePath} duplicates route ${result.route.path} already defined by ${duplicateFilePath}.`
				)
			);
			continue;
		}

		const signature = createRouteSignature(result.route.path);
		const ambiguousRoute = routeFilesBySignature.get(signature);
		if (ambiguousRoute && ambiguousRoute.path !== result.route.path) {
			diagnostics.push(
				...result.diagnostics,
				createFileDiagnostic(
					'server_file_ambiguous_route',
					filePath,
					result.route.path,
					signature,
					`Server API file ${filePath} has the same dynamic route shape as ${ambiguousRoute.filePath}.`
				)
			);
			continue;
		}

		routeFilesByPath.set(result.route.path, filePath);
		routeFilesBySignature.set(signature, {
			filePath,
			path: result.route.path,
		});
		routes.push(result.route);
	}

	for (const [filePath, module] of Object.entries(grouped.actions ?? {})) {
		const collectedActions = collectActions(filePath, module, options);
		if (collectedActions.length === 0) {
			const name = module.name ?? serverFileToActionName(filePath, options);
			diagnostics.push(
				createFileDiagnostic(
					'server_file_invalid_action',
					filePath,
					name,
					name,
					`Server action file ${filePath} does not export an action handler.`
				)
			);
			continue;
		}
		for (const [name, handler] of collectedActions) {
			if (Object.hasOwn(actions, name)) {
				diagnostics.push(
					createFileDiagnostic(
						'server_file_duplicate_action',
						filePath,
						name,
						name,
						`Server action file ${filePath} duplicates action ${name}.`
					)
				);
				continue;
			}
			actions[name] = handler;
		}
	}

	return {
		api: routes,
		actions,
		...(diagnostics.length > 0 ? { diagnostics } : {}),
	};
};
