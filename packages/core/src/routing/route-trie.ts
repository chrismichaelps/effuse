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

import { parseRoutePattern, type RoutePattern } from './route-pattern.js';

const EMPTY_NAMES: readonly string[] = [];

/**
 * Prefix-tree (radix) router.
 *
 * Matching a path against N routes with per-route regular expressions costs
 * O(N) regex executions. This trie dispatches each path segment through a Map,
 * so a lookup costs O(k) in the path's segment count and is independent of how
 * many routes are registered. Static segments are tried before params and
 * params before catch-alls, so specificity wins without sorting the table, and
 * a dead-end static branch backtracks into the param branch.
 *
 * Patterns using optional or wildcard segments keep regex semantics: they are
 * reported by `isTrieRoutable` as unroutable so callers retain a correct
 * fallback rather than silently changing behaviour.
 */

interface TrieNode<Value> {
	/** Static children keyed by exact segment text, for O(1) descent. */
	staticChildren: Map<string, TrieNode<Value>> | undefined;
	/**
	 * Single-segment parameter branch. The branch is shared by every route
	 * passing through this position, so it carries no name: a parameter's
	 * position belongs to the edge, its name belongs to the route.
	 */
	paramChild: TrieNode<Value> | undefined;
	/** Catch-all branch consuming every remaining segment. */
	catchAllName: string | undefined;
	catchAllValue: Value | undefined;
	catchAllOrder: number;
	/** Parameter names of the catch-all route, in the order it declared them. */
	catchAllParamNames: readonly string[];
	/** Payload when a route terminates at this node. */
	value: Value | undefined;
	hasValue: boolean;
	/** Parameter names of the route terminating here, in declaration order. */
	paramNames: readonly string[];
	/** Insertion index, so equally specific duplicates keep declaration order. */
	order: number;
}

export interface RouteTrieEntry<Value> {
	readonly pattern: string | RoutePattern;
	readonly value: Value;
}

export interface RouteTrie<Value> {
	readonly root: TrieNode<Value>;
	/** Number of patterns the trie actually indexed. */
	readonly size: number;
}

export interface RouteTrieMatch<Value> {
	readonly value: Value;
	readonly params: Record<string, string>;
}

const createNode = <Value>(): TrieNode<Value> => ({
	staticChildren: undefined,
	paramChild: undefined,
	catchAllName: undefined,
	catchAllValue: undefined,
	catchAllOrder: Number.MAX_SAFE_INTEGER,
	catchAllParamNames: EMPTY_NAMES,
	value: undefined,
	hasValue: false,
	paramNames: EMPTY_NAMES,
	order: Number.MAX_SAFE_INTEGER,
});

const toPattern = (input: string | RoutePattern): RoutePattern =>
	typeof input === 'string' ? parseRoutePattern(input) : input;

/**
 * True when a pattern's semantics are fully expressible in the trie. Optional
 * segments may or may not consume a segment, and bare wildcards match across
 * separators; both keep regex semantics instead.
 */
export const isTrieRoutable = (input: string | RoutePattern): boolean => {
	const pattern = toPattern(input);
	for (const segment of pattern.urlSegments) {
		if (segment.kind === 'wildcard') return false;
		if (segment.kind === 'param' && segment.optional) return false;
	}
	return true;
};

export const createRouteTrie = <Value>(
	entries: readonly RouteTrieEntry<Value>[]
): RouteTrie<Value> => {
	const root = createNode<Value>();
	let size = 0;

	entries.forEach((entry, index) => {
		const pattern = toPattern(entry.pattern);
		if (!isTrieRoutable(pattern)) return;

		let node = root;
		let terminated = false;
		const paramNames: string[] = [];

		for (const segment of pattern.urlSegments) {
			if (segment.kind === 'static') {
				node.staticChildren ??= new Map<string, TrieNode<Value>>();
				let child = node.staticChildren.get(segment.value);
				if (!child) {
					child = createNode<Value>();
					node.staticChildren.set(segment.value, child);
				}
				node = child;
				continue;
			}

			// `isTrieRoutable` already rejected wildcards and optional params,
			// so anything left here is a required named parameter.
			if (segment.kind !== 'param') continue;

			if (segment.catchAll) {
				if (index < node.catchAllOrder) {
					node.catchAllName = segment.name;
					node.catchAllValue = entry.value;
					node.catchAllOrder = index;
					node.catchAllParamNames = [...paramNames];
				}
				terminated = true;
				break;
			}

			node.paramChild ??= createNode<Value>();
			paramNames.push(segment.name);
			node = node.paramChild;
		}

		size += 1;
		if (terminated) return;
		// First writer wins, so equally specific duplicates keep declaration order.
		if (!node.hasValue || index < node.order) {
			node.value = entry.value;
			node.hasValue = true;
			node.paramNames = paramNames;
			node.order = index;
		}
	});

	return { root, size };
};

const decodeSegment = (value: string): string => {
	// Skip the try/catch and allocation unless the segment is actually encoded.
	if (!value.includes('%')) return value;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const splitPath = (pathname: string): readonly string[] => {
	const trimmed =
		pathname.length > 1 && pathname.endsWith('/')
			? pathname.slice(0, -1)
			: pathname;
	if (trimmed === '' || trimmed === '/') return [];
	return trimmed.charCodeAt(0) === 47 /* '/' */
		? trimmed.slice(1).split('/')
		: trimmed.split('/');
};

/**
 * Positional parameter values gathered during descent. Names are applied only
 * once a route terminates, from that route's own declaration.
 */
const toParams = (
	values: readonly string[],
	names: readonly string[],
	catchAll?: { readonly name: string; readonly value: string }
): Record<string, string> => {
	const params: Record<string, string> = {};
	const shared = Math.min(values.length, names.length);
	for (let index = 0; index < shared; index += 1) {
		const name = names[index];
		const value = values[index];
		if (name !== undefined && value !== undefined) params[name] = value;
	}
	if (catchAll) params[catchAll.name] = catchAll.value;
	return params;
};

export const matchRouteTrie = <Value>(
	trie: RouteTrie<Value>,
	pathname: string
): RouteTrieMatch<Value> | null => {
	const segments = splitPath(pathname);

	// Recursive descent so a dead-end static branch can backtrack into the
	// param branch. Bindings are carried down and only materialised into a
	// params object once a route actually matches, so failed probes allocate
	// nothing beyond the binding list.
	const visit = (
		node: TrieNode<Value>,
		index: number,
		values: readonly string[]
	): RouteTrieMatch<Value> | null => {
		if (index === segments.length) {
			if (node.hasValue && node.value !== undefined) {
				return {
					value: node.value,
					params: toParams(values, node.paramNames),
				};
			}
			return null;
		}

		const segment = segments[index];
		if (segment === undefined || segment === '') return null;

		// Static first: most specific, and an O(1) Map hit.
		const staticChild = node.staticChildren?.get(segment);
		if (staticChild) {
			const found = visit(staticChild, index + 1, values);
			if (found) return found;
		}

		// Then the single-segment parameter branch.
		const paramChild = node.paramChild;
		if (paramChild) {
			const found = visit(paramChild, index + 1, [
				...values,
				decodeSegment(segment),
			]);
			if (found) return found;
		}

		// Finally the catch-all, which consumes everything that remains.
		if (node.catchAllName !== undefined && node.catchAllValue !== undefined) {
			const rest = segments.slice(index).map(decodeSegment).join('/');
			return {
				value: node.catchAllValue,
				params: toParams(values, node.catchAllParamNames, {
					name: node.catchAllName,
					value: rest,
				}),
			};
		}

		return null;
	};

	return visit(trie.root, 0, EMPTY_VALUES);
};

const EMPTY_VALUES: readonly string[] = [];
