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

import {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	type CompiledRoutePattern,
} from '../routing/route-pattern.js';
import { EFFUSE_ACTION_PREFIX } from './constants.js';
import type {
	ServerActionFileModule,
	ServerApiFileModule,
} from './server-files.js';

export type ServerFileModule = ServerApiFileModule | ServerActionFileModule;

interface LazyServerFileEntryBase<Module extends ServerFileModule> {
	readonly filePath: string;
	readonly load: () => Promise<Module>;
}

export interface LazyServerApiFileEntry extends LazyServerFileEntryBase<ServerApiFileModule> {
	readonly kind: 'api';
	readonly path: string;
	readonly signature?: string;
}

export interface LazyServerActionFileEntry extends LazyServerFileEntryBase<ServerActionFileModule> {
	readonly kind: 'action';
	readonly name: string;
}

export type LazyServerFileEntry =
	| LazyServerApiFileEntry
	| LazyServerActionFileEntry;

export interface CompiledServerFileRegistry {
	readonly kind: 'effuse-server-file-registry';
	readonly apiCount: number;
	readonly actionCount: number;
}

export interface ServerFileMatchOptions {
	readonly actionLayer?: string;
}

interface ServerFileMatchBase<Module extends ServerFileModule> {
	readonly filePath: string;
	readonly target: string;
	readonly params: Readonly<Record<string, string>>;
	readonly load: () => Promise<Module>;
}

export interface ServerApiFileMatch extends ServerFileMatchBase<ServerApiFileModule> {
	readonly kind: 'api';
	readonly path: string;
}

export interface ServerActionFileMatch extends ServerFileMatchBase<ServerActionFileModule> {
	readonly kind: 'action';
	readonly name: string;
	readonly allowedMethods: readonly ['POST'];
	readonly layer?: string;
}

export type ServerFileMatch = ServerApiFileMatch | ServerActionFileMatch;

interface CompiledApiFile {
	readonly entry: LazyServerApiFileEntry;
	readonly pattern: CompiledRoutePattern;
}

interface CompiledServerFileRegistryData {
	readonly api: readonly CompiledApiFile[];
	readonly actions: ReadonlyMap<string, LazyServerActionFileEntry>;
	readonly imports: WeakMap<LazyServerFileEntry, Promise<ServerFileModule>>;
}

export type ServerFileRegistrySource =
	| readonly LazyServerFileEntry[]
	| CompiledServerFileRegistry;

const compiledRegistries = new WeakMap<
	CompiledServerFileRegistry,
	CompiledServerFileRegistryData
>();

const isCompiledRegistry = (
	source: ServerFileRegistrySource
): source is CompiledServerFileRegistry =>
	compiledRegistries.has(source as CompiledServerFileRegistry);

export const compileServerFileRegistry = (
	source: ServerFileRegistrySource
): CompiledServerFileRegistry => {
	if (isCompiledRegistry(source)) return source;
	const api: CompiledApiFile[] = [];
	const actions = new Map<string, LazyServerActionFileEntry>();
	const routeSignatures = new Set<string>();

	for (const entry of source) {
		if (entry.kind === 'action') {
			if (actions.has(entry.name)) {
				throw new TypeError(`Duplicate lazy server action "${entry.name}".`);
			}
			const ownedEntry = Object.freeze({ ...entry });
			actions.set(ownedEntry.name, ownedEntry);
			continue;
		}
		const pattern = compileRoutePattern(entry.path);
		if (entry.signature && entry.signature !== pattern.pattern.signature) {
			throw new TypeError(`Stale route signature for ${entry.filePath}.`);
		}
		if (routeSignatures.has(pattern.pattern.signature)) {
			throw new TypeError(
				`Duplicate lazy server route shape "${pattern.pattern.signature}".`
			);
		}
		routeSignatures.add(pattern.pattern.signature);
		api.push(Object.freeze({ entry: Object.freeze({ ...entry }), pattern }));
	}
	api.sort((left, right) =>
		compareRoutePatterns(left.pattern.pattern, right.pattern.pattern)
	);
	const registry = Object.freeze({
		kind: 'effuse-server-file-registry' as const,
		apiCount: api.length,
		actionCount: actions.size,
	});
	compiledRegistries.set(registry, {
		api: Object.freeze(api),
		actions,
		imports: new WeakMap(),
	});
	return registry;
};

const decodeActionName = (value: string): string =>
	value
		.split('/')
		.filter(Boolean)
		.map((segment) => {
			try {
				return decodeURIComponent(segment);
			} catch {
				return segment;
			}
		})
		.join('/');

function createLoader(
	entry: LazyServerApiFileEntry,
	data: CompiledServerFileRegistryData
): () => Promise<ServerApiFileModule>;
function createLoader(
	entry: LazyServerActionFileEntry,
	data: CompiledServerFileRegistryData
): () => Promise<ServerActionFileModule>;
function createLoader(
	entry: LazyServerFileEntry,
	data: CompiledServerFileRegistryData
): () => Promise<ServerFileModule> {
	return async () => {
		const key = entry;
		let pending = data.imports.get(key);
		if (!pending) {
			pending = (async (): Promise<ServerFileModule> => entry.load())();
			data.imports.set(key, pending);
			void pending.catch(() => {
				if (data.imports.get(key) === pending) data.imports.delete(key);
			});
		}
		return pending;
	};
}

export const matchServerFileRequest = (
	request: Request,
	source: ServerFileRegistrySource,
	options: ServerFileMatchOptions = {}
): ServerFileMatch | null => {
	const registry = compileServerFileRegistry(source);
	const data = compiledRegistries.get(registry);
	if (!data) throw new TypeError('Invalid Effuse server file registry.');
	const pathname = new URL(request.url).pathname;

	if (pathname.startsWith(EFFUSE_ACTION_PREFIX)) {
		const requested = decodeActionName(
			pathname.slice(EFFUSE_ACTION_PREFIX.length)
		);
		let entry = data.actions.get(requested);
		let layer: string | undefined;
		if (!entry && options.actionLayer) {
			const prefix = `${options.actionLayer}/`;
			if (requested.startsWith(prefix)) {
				entry = data.actions.get(requested.slice(prefix.length));
				if (entry) layer = options.actionLayer;
			}
		}
		if (entry) {
			return Object.freeze({
				kind: 'action' as const,
				filePath: entry.filePath,
				name: entry.name,
				target: entry.name,
				params: Object.freeze({
					...(layer ? { layer } : {}),
					action: entry.name,
				}),
				allowedMethods: Object.freeze(['POST'] as const),
				...(layer ? { layer } : {}),
				load: createLoader(entry, data),
			});
		}
	}

	for (const { entry, pattern } of data.api) {
		const params = matchRoutePattern(pattern, pathname);
		if (params) {
			return Object.freeze({
				kind: 'api' as const,
				filePath: entry.filePath,
				path: entry.path,
				target: entry.path,
				params: Object.freeze(params),
				load: createLoader(entry, data),
			});
		}
	}
	return null;
};
