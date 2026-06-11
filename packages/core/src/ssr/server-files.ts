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
	ServerActionInput,
	ServerHandler,
	ServerLayerConfig,
	ServerMiddleware,
	ServerMethodHandlers,
	ServerRouteMetadata,
	ServerRoute,
	ServerRouteInput,
} from '../layers/types.js';
import {
	isHttpMethod,
	normalizeServerRouteInput,
} from './server-routes.js';

const HTTP_METHODS: readonly HttpMethod[] = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
];

export interface ServerApiFileModule {
	readonly path?: string;
	readonly default?: ServerRouteInput;
	readonly handler?: ServerRouteInput;
	readonly metadata?: ServerRouteMetadata;
	readonly methods?: ServerMethodHandlers;
	readonly middleware?: readonly ServerMiddleware[];
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
	readonly apiDir?: string;
	readonly actionsDir?: string;
	readonly apiBasePath?: string;
}

const DEFAULT_API_DIR = 'src/server/api';
const DEFAULT_ACTIONS_DIR = 'src/server/actions';
const DEFAULT_API_BASE_PATH = '/api';

const normalizeFilePath = (path: string): string =>
	path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

const normalizeDir = (path: string): string =>
	normalizeFilePath(path).replace(/\/+$/g, '');

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

const trimRouteFileSegment = (path: string): string =>
	path.replace(/\/(?:route|index)$/i, '').replace(/^(?:route|index)$/i, '');

const joinPath = (basePath: string, path: string): string => {
	const normalizedBase = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
	const normalizedPath = path.replace(/^\/+|\/+$/g, '');
	return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
};

export const serverFileToRoutePath = (
	filePath: string,
	options: ServerFilesOptions = {}
): string => {
	const apiDir = options.apiDir ?? DEFAULT_API_DIR;
	const apiBasePath = options.apiBasePath ?? DEFAULT_API_BASE_PATH;
	const path = trimRouteFileSegment(stripExtension(stripRoot(filePath, apiDir)));
	return joinPath(apiBasePath, path);
};

export const serverFileToActionName = (
	filePath: string,
	options: ServerFilesOptions = {}
): string => {
	const actionsDir = options.actionsDir ?? DEFAULT_ACTIONS_DIR;
	return trimRouteFileSegment(
		stripExtension(stripRoot(filePath, actionsDir))
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

const hasMethods = (methods: ServerMethodHandlers): boolean =>
	Object.keys(methods).some(isHttpMethod);

const resolveRouteInput = (
	module: ServerApiFileModule
): ServerRouteInput | null => {
	const methodExports = collectMethodExports(module);
	if (hasMethods(methodExports)) {
		return {
			...methodExports,
			metadata: module.metadata,
			middleware: module.middleware,
		};
	}

	if (module.methods) {
		return {
			methods: module.methods,
			metadata: module.metadata,
			middleware: module.middleware,
		};
	}

	if (module.handler) {
		return typeof module.handler === 'function'
			? {
					handler: module.handler,
					metadata: module.metadata,
					middleware: module.middleware,
				}
			: module.handler;
	}

	if (module.default) {
		return typeof module.default === 'function'
			? {
					handler: module.default,
					metadata: module.metadata,
					middleware: module.middleware,
				}
			: module.default;
	}

	return null;
};

const createServerFileRoute = (
	filePath: string,
	module: ServerApiFileModule,
	options: ServerFilesOptions
): ServerRoute | null => {
	const path = module.path ?? serverFileToRoutePath(filePath, options);
	const input = resolveRouteInput(module);

	return input ? normalizeServerRouteInput(path, input) : null;
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
	const actionsDir = normalizeDir(options.actionsDir ?? DEFAULT_ACTIONS_DIR);

	for (const [filePath, module] of Object.entries(files)) {
		const normalizedPath = normalizeFilePath(filePath);
		if (
			normalizedPath.startsWith(`${actionsDir}/`) ||
			normalizedPath.includes(`/${actionsDir}/`)
		) {
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

	for (const [filePath, module] of Object.entries(grouped.api ?? {})) {
		const route = createServerFileRoute(filePath, module, options);
		if (route) {
			routes.push(route);
		}
	}

	for (const [filePath, module] of Object.entries(grouped.actions ?? {})) {
		for (const [name, handler] of collectActions(filePath, module, options)) {
			actions[name] = handler;
		}
	}

	return {
		api: routes,
		actions,
	};
};
