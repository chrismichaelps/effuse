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

/**
 * Where policies attach to routes.
 *
 * Two decisions here carry the security weight.
 *
 * **Matching rules combine with AND, not most-specific-wins.** Adding a rule can
 * therefore only ever narrow access. With override semantics, a new rule on a
 * specific path silently widens what a broad rule was guarding, and that widening
 * is invisible in review because the diff only shows a rule being *added*.
 * Overriding is still possible, but it has to be written down (`override: true`),
 * which is exactly the property that makes it reviewable.
 *
 * **Method is part of the match.** A guard registered for `GET` leaves `POST`
 * open unless it says otherwise, so rules default to every method and narrowing
 * to a subset is deliberate. The reverse default — infer methods from what
 * happens to be registered — produces a route where the read is guarded and the
 * write is not.
 */

import type { ClaimsShape } from '../../claims.js';
import type { Policy } from './predicates.js';

/** An HTTP method, or `*` for all of them. */
export type PolicyMethod = string;

export interface PolicyRule<Shape extends ClaimsShape> {
	/**
	 * Path pattern. Supports `:param` segments and a trailing `*`.
	 *
	 * `/api/admin/*` matches everything beneath `/api/admin`. `/users/:id`
	 * matches one segment. Anything else is matched literally.
	 */
	readonly path: string;
	/** Methods this rule applies to. Defaults to all of them. */
	readonly methods?: readonly PolicyMethod[];
	readonly policy: Policy<Shape>;
	/**
	 * Replace less-specific rules instead of combining with them.
	 *
	 * The escape hatch for making a specific route more permissive than its
	 * prefix. Deliberately explicit: a silent override is a widening nobody
	 * reviewed.
	 */
	readonly override?: boolean;
}

export interface PolicyMatch<Shape extends ClaimsShape> {
	/** Rules that applied, least specific first. */
	readonly rules: readonly PolicyRule<Shape>[];
	/** The single policy to evaluate, already combined. */
	readonly policy: Policy<Shape> | undefined;
}

export interface PolicyRegistry<Shape extends ClaimsShape> {
	/** Registers a rule. Returns the registry for chaining. */
	protect(rule: PolicyRule<Shape>): PolicyRegistry<Shape>;
	/** Every registered rule, in registration order. */
	readonly rules: () => readonly PolicyRule<Shape>[];
	/** The combined policy for a path and method, or `undefined` if none matched. */
	resolve(path: string, method: string): PolicyMatch<Shape>;
}

interface CompiledPattern {
	readonly segments: readonly string[];
	readonly trailingWildcard: boolean;
	/** Higher binds tighter. Literal segments outrank parameters. */
	readonly specificity: number;
}

const compilePattern = (pattern: string): CompiledPattern => {
	const trailingWildcard = pattern.endsWith('/*') || pattern === '*';

	const cleaned = trailingWildcard
		? pattern.replace(/\/?\*$/, '')
		: pattern;

	const segments = cleaned.split('/').filter((segment) => segment.length > 0);

	// Literal segments are worth more than parameters, and a trailing wildcard
	// costs a point so `/a/b` outranks `/a/*` on the same path.
	const specificity =
		segments.reduce(
			(total, segment) => total + (segment.startsWith(':') ? 1 : 2),
			0
		) - (trailingWildcard ? 1 : 0);

	return { segments, trailingWildcard, specificity };
};

const matchesPath = (pattern: CompiledPattern, path: string): boolean => {
	const segments = path.split('/').filter((segment) => segment.length > 0);

	if (pattern.trailingWildcard) {
		if (segments.length < pattern.segments.length) return false;
	} else if (segments.length !== pattern.segments.length) {
		return false;
	}

	return pattern.segments.every((expected, index) => {
		if (expected.startsWith(':')) {
			// A parameter matches exactly one non-empty segment. It must not match
			// nothing, or `/users/:id` would match `/users`.
			return (segments[index] ?? '').length > 0;
		}
		return segments[index] === expected;
	});
};

const matchesMethod = (
	methods: readonly PolicyMethod[] | undefined,
	method: string
): boolean => {
	// No declaration means every method. Guarding only what someone remembered to
	// list is how a route ends up with a protected GET and an open POST.
	if (methods === undefined || methods.length === 0) return true;

	const wanted = method.toUpperCase();

	return methods.some(
		(candidate) => candidate === '*' || candidate.toUpperCase() === wanted
	);
};

/**
 * Combines several rules into one policy.
 *
 * Conjunction, unless a rule declares `override` — in which case it and
 * everything more specific than it stand alone.
 */
const combine = <Shape extends ClaimsShape>(
	rules: readonly PolicyRule<Shape>[]
): Policy<Shape> | undefined => {
	if (rules.length === 0) return undefined;

	// An override discards everything less specific. The last one wins, so the
	// most specific override is the one that takes effect.
	const lastOverride = rules.reduce(
		(found, rule, index) => (rule.override === true ? index : found),
		-1
	);

	const effective = lastOverride >= 0 ? rules.slice(lastOverride) : rules;

	if (effective.length === 1) return effective[0]?.policy;

	const policies = effective.map((rule) => rule.policy);

	return {
		name: `all(${policies.map((policy) => policy.name).join(', ')})`,
		isPublic: policies.every((policy) => policy.isPublic),
		evaluate: async (context) => {
			for (const policy of policies) {
				const decision = await policy.evaluate(context);
				if (!decision.allowed) return decision;
			}
			return { allowed: true };
		},
	};
};

export const createPolicyRegistry = <
	Shape extends ClaimsShape,
>(): PolicyRegistry<Shape> => {
	const entries: { rule: PolicyRule<Shape>; pattern: CompiledPattern }[] = [];

	const registry: PolicyRegistry<Shape> = {
		protect: (rule) => {
			entries.push({ rule, pattern: compilePattern(rule.path) });
			return registry;
		},

		rules: () => entries.map((entry) => entry.rule),

		resolve: (path, method) => {
			const matched = entries
				.filter(
					(entry) =>
						matchesPath(entry.pattern, path) &&
						matchesMethod(entry.rule.methods, method)
				)
				// Least specific first, so conjunction reads outside-in and an
				// override discards exactly the rules broader than itself.
				.sort((a, b) => a.pattern.specificity - b.pattern.specificity)
				.map((entry) => entry.rule);

			return { rules: matched, policy: combine(matched) };
		},
	};

	return registry;
};
