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

import type { HttpMethod } from '../layers/types.js';
import { matchRoutePattern } from '../routing/route-pattern.js';
import { isHttpMethod } from './server-routes.js';
import type {
	DefinedServerMiddleware,
	ServerMiddlewareTarget,
} from './middleware-definition.js';

/**
 * Ownership scope of a middleware, ordered outermost-first. The onion executes
 * `engine` outermost and unwinds through `route` innermost, before the
 * handler. Ordering is derived from explicit scope, never from filename or
 * registration accidents.
 */
export type ServerMiddlewareScope = 'engine' | 'global' | 'layer' | 'route';

const SCOPE_ORDER: Readonly<Record<ServerMiddlewareScope, number>> = {
	engine: 0,
	global: 1,
	layer: 2,
	route: 3,
};

/** A middleware definition tagged with the scope that owns it. */
export interface ServerMiddlewareGraphInput {
	readonly scope: ServerMiddlewareScope;
	/** Required for `layer` scope: the owning layer name. */
	readonly owner?: string;
	readonly middleware: DefinedServerMiddleware;
}

/** A compiled, ordered entry in the middleware graph. */
export interface CompiledServerMiddlewareEntry {
	readonly name: string;
	readonly scope: ServerMiddlewareScope;
	readonly owner: string | undefined;
	readonly middleware: DefinedServerMiddleware;
}

/** The deterministic, immutable middleware pipeline. */
export interface CompiledServerMiddlewareGraph {
	readonly entries: readonly CompiledServerMiddlewareEntry[];
}

/** Request coordinates used to select the applicable middleware chain. */
export interface ServerMiddlewareRequestContext {
	readonly pathname: string;
	readonly method: string;
	readonly target: ServerMiddlewareTarget;
}

interface OrderedInput extends ServerMiddlewareGraphInput {
	readonly index: number;
}

const middlewareName = (
	input: ServerMiddlewareGraphInput,
	index: number
): string => input.middleware.name ?? `middleware:${String(index)}`;

/**
 * Compiles scope-tagged middleware definitions into one deterministic pipeline.
 * Entries are ordered by scope precedence (engine, global, layer, route), then
 * by ascending `order`, then by declaration index. Names must be unique so a
 * middleware can be referenced and traced unambiguously.
 */
export const compileServerMiddlewareGraph = (
	inputs: readonly ServerMiddlewareGraphInput[]
): CompiledServerMiddlewareGraph => {
	const ordered: OrderedInput[] = inputs.map((input, index) => {
		if (SCOPE_ORDER[input.scope] === undefined) {
			throw new TypeError(
				`Invalid server middleware scope "${String(input.scope)}".`
			);
		}
		if (input.scope === 'layer' && !input.owner) {
			throw new TypeError(
				'Layer-scoped server middleware requires an owner.'
			);
		}
		return { ...input, index };
	});

	ordered.sort((a, b) => {
		const scopeDelta = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
		if (scopeDelta !== 0) return scopeDelta;
		const orderDelta = a.middleware.order - b.middleware.order;
		if (orderDelta !== 0) return orderDelta;
		return a.index - b.index;
	});

	const seen = new Set<string>();
	const entries: CompiledServerMiddlewareEntry[] = ordered.map((input) => {
		const name = middlewareName(input, input.index);
		if (seen.has(name)) {
			throw new TypeError(
				`Duplicate server middleware name "${name}" in compiled graph.`
			);
		}
		seen.add(name);
		return Object.freeze({
			name,
			scope: input.scope,
			owner: input.owner,
			middleware: input.middleware,
		});
	});

	return Object.freeze({ entries: Object.freeze(entries) });
};

const matchesTarget = (
	entry: CompiledServerMiddlewareEntry,
	target: ServerMiddlewareTarget
): boolean =>
	(entry.middleware.match.targets as readonly ServerMiddlewareTarget[]).includes(
		target
	);

const matchesMethod = (
	entry: CompiledServerMiddlewareEntry,
	method: string
): boolean => {
	const normalized = method.toUpperCase();
	if (!isHttpMethod(normalized)) return false;
	return (entry.middleware.match.methods as readonly HttpMethod[]).includes(
		normalized
	);
};

const matchesPath = (
	entry: CompiledServerMiddlewareEntry,
	pathname: string
): boolean =>
	entry.middleware.match.paths.some(
		(path) => matchRoutePattern(path, pathname) !== null
	);

/**
 * Selects the ordered chain of middleware whose match covers the request. The
 * compiled order is preserved; a route mismatch simply excludes the entry so
 * scoped middleware and its route chunks are never loaded for a non-match.
 */
export const selectServerMiddlewareChain = (
	graph: CompiledServerMiddlewareGraph,
	context: ServerMiddlewareRequestContext
): readonly CompiledServerMiddlewareEntry[] =>
	graph.entries.filter(
		(entry) =>
			matchesTarget(entry, context.target) &&
			matchesMethod(entry, context.method) &&
			matchesPath(entry, context.pathname)
	);
