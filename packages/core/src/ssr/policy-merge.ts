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
	ServerLayerDiagnostic,
	ServerPolicy,
	ServerPolicySourceKind,
} from '../layers/types.js';

/**
 * A single contributor to an endpoint's effective policy. Sources are folded in
 * precedence order (least specific first): parents -> dependencies -> layer ->
 * route -> method. Later sources win.
 */
export interface PolicySource {
	readonly kind: ServerPolicySourceKind;
	/** Layer name for layer-kinded sources; the endpoint target otherwise. */
	readonly name: string;
	readonly policy?: ServerPolicy;
}

/** Records which source contributed the final value of a policy key. */
export interface PolicyProvenanceEntry {
	/** Dotted key path, e.g. `runtime`, `cache.tags`, `headers.x-frame-options`. */
	readonly key: string;
	readonly source: ServerPolicySourceKind;
	readonly name: string;
}

export interface FoldedPolicy {
	readonly policy: ServerPolicy;
	readonly diagnostics: readonly ServerLayerDiagnostic[];
	readonly provenance: readonly PolicyProvenanceEntry[];
}

/**
 * Merge strategy for a policy field. `override` replaces wholesale and reports a
 * conflict when a later source changes an existing value. `union` combines arrays
 * additively (no loss, so no conflict). `record` merges string maps key-wise,
 * reporting a conflict only when a key's value is replaced.
 */
type Strategy = 'override' | 'union' | 'record';

const CACHE_STRATEGY: Record<string, Strategy> = {
	cacheControl: 'override',
	revalidate: 'override',
	tags: 'union',
};

const CORS_STRATEGY: Record<string, Strategy> = {
	origin: 'override',
	credentials: 'override',
	maxAge: 'override',
	headers: 'union',
	methods: 'union',
};

const TOP_STRATEGY: Record<keyof ServerPolicy, Strategy | 'cache' | 'cors'> = {
	cache: 'cache',
	cors: 'cors',
	maxDuration: 'override',
	region: 'override',
	runtime: 'override',
	headers: 'record',
	status: 'override',
	redirect: 'override',
	renderMode: 'override',
	prerender: 'override',
	fallback: 'override',
};

const equal = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left) === JSON.stringify(right);

const unionArray = (
	prev: readonly unknown[] | undefined,
	next: readonly unknown[] | undefined
): readonly unknown[] => {
	const seen = new Set<string>();
	const out: unknown[] = [];
	for (const value of [...(prev ?? []), ...(next ?? [])]) {
		const token = JSON.stringify(value);
		if (!seen.has(token)) {
			seen.add(token);
			out.push(value);
		}
	}
	return out;
};

interface MergeContext {
	readonly target: string;
	readonly owners: Map<string, PolicySource>;
	readonly diagnostics: ServerLayerDiagnostic[];
}

const conflict = (
	ctx: MergeContext,
	key: string,
	from: PolicySource,
	to: PolicySource
): void => {
	ctx.diagnostics.push({
		code: 'metadata_conflict',
		key,
		layer: to.kind === 'layer' ? to.name : from.kind === 'layer' ? from.name : undefined,
		message: `Server metadata "${key}" on ${ctx.target} overrides ${from.kind} metadata from ${from.name}.`,
		target: ctx.target,
		from: from.kind,
		to: to.kind,
	});
};

/**
 * Merge a single leaf value under `override`/`union` strategy, tracking ownership
 * and emitting a conflict diagnostic when an `override` field is changed.
 */
const mergeLeaf = (
	ctx: MergeContext,
	key: string,
	strategy: Strategy,
	prev: unknown,
	source: PolicySource,
	next: unknown
): unknown => {
	if (next === undefined) {
		return prev;
	}
	if (strategy === 'union') {
		if (prev !== undefined) {
			ctx.owners.set(key, source);
		}
		const merged = unionArray(
			prev as readonly unknown[] | undefined,
			next as readonly unknown[]
		);
		if (prev === undefined) {
			ctx.owners.set(key, source);
		}
		return merged;
	}
	if (strategy === 'record') {
		const prevRecord = (prev ?? {}) as Record<string, string>;
		const nextRecord = next as Record<string, string>;
		const out: Record<string, string> = { ...prevRecord };
		for (const [name, value] of Object.entries(nextRecord)) {
			const subKey = `${key}.${name}`;
			const owner = ctx.owners.get(subKey);
			if (owner && out[name] !== undefined && !equal(out[name], value)) {
				conflict(ctx, subKey, owner, source);
			}
			out[name] = value;
			ctx.owners.set(subKey, source);
		}
		return out;
	}
	// override
	const owner = ctx.owners.get(key);
	if (owner && prev !== undefined && !equal(prev, next)) {
		conflict(ctx, key, owner, source);
	}
	ctx.owners.set(key, source);
	return next;
};

/**
 * Fold policy sources (least specific first) into one effective policy, emitting a
 * `metadata_conflict` diagnostic for every value a later source overrides.
 */
export const foldServerPolicy = (
	target: string,
	sources: readonly PolicySource[]
): FoldedPolicy => {
	const ctx: MergeContext = {
		target,
		owners: new Map(),
		diagnostics: [],
	};

	let cache: Record<string, unknown> | undefined;
	let cors: Record<string, unknown> | undefined;
	const top: Record<string, unknown> = {};

	for (const source of sources) {
		const policy = source.policy;
		if (!policy) {
			continue;
		}
		for (const rawKey of Object.keys(policy) as (keyof ServerPolicy)[]) {
			const value = policy[rawKey];
			if (value === undefined) {
				continue;
			}
			const strategy = TOP_STRATEGY[rawKey];
			if (strategy === 'cache') {
				cache = cache ?? {};
				for (const [subKey, subValue] of Object.entries(
					value as Record<string, unknown>
				)) {
					cache[subKey] = mergeLeaf(
						ctx,
						`cache.${subKey}`,
						CACHE_STRATEGY[subKey] ?? 'override',
						cache[subKey],
						source,
						subValue
					);
				}
			} else if (strategy === 'cors') {
				cors = cors ?? {};
				for (const [subKey, subValue] of Object.entries(
					value as Record<string, unknown>
				)) {
					cors[subKey] = mergeLeaf(
						ctx,
						`cors.${subKey}`,
						CORS_STRATEGY[subKey] ?? 'override',
						cors[subKey],
						source,
						subValue
					);
				}
			} else {
				top[rawKey] = mergeLeaf(
					ctx,
					rawKey,
					strategy,
					top[rawKey],
					source,
					value
				);
			}
		}
	}

	const policy: Record<string, unknown> = { ...top };
	if (cache) {
		policy.cache = cache;
	}
	if (cors) {
		policy.cors = cors;
	}

	const provenance: PolicyProvenanceEntry[] = [];
	for (const [key, source] of ctx.owners) {
		provenance.push({ key, source: source.kind, name: source.name });
	}

	return {
		policy: policy as ServerPolicy,
		diagnostics: ctx.diagnostics,
		provenance,
	};
};
