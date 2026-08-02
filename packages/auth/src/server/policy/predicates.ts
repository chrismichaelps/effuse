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
 * Authorization predicates over the typed session.
 *
 * The library this package improves on stops at authentication, so authorization
 * becomes `if (session.user.role !== 'admin')` scattered across route handlers.
 * That is unreviewable in a specific way: there is no way to enumerate what is
 * protected, so a missing check is invisible until it is exploited. Nobody can
 * answer "which routes are open?" without reading every file.
 *
 * Policies here are values. They compose, they carry names, and — because they
 * are built against the same claims declaration the session is — referencing a
 * claim that does not exist is a compile error rather than a comparison against
 * `undefined` that is quietly always false.
 */

import type { ClaimsShape, InferClaims } from '../../claims.js';
import type { Session } from '../session-engine.js';

/** What a policy is given to decide with. */
export interface PolicyContext<Shape extends ClaimsShape> {
	/** Absent when the request carries no valid session. */
	readonly session: Session<Shape> | undefined;
	readonly method: string;
	readonly path: string;
	/**
	 * The request, when one exists.
	 *
	 * Present so a policy can inspect headers or origin. Its absence does not
	 * mean "trusted": an internally-originated call is evaluated by the same
	 * policy as an external one, which is what stops a confused deputy — an
	 * internal caller reaching a resource the external path guards.
	 */
	readonly request?: Request;
}

export type PolicyDecision =
	| { readonly allowed: true }
	| {
			readonly allowed: false;
			/** Operator-facing. Never returned to a client verbatim. */
			readonly reason: string;
			/** 401 when nobody is signed in; 403 when someone is but may not. */
			readonly status: 401 | 403;
	  };

export interface Policy<Shape extends ClaimsShape> {
	/** Appears in coverage reports and denial diagnostics. */
	readonly name: string;
	/**
	 * True when this policy permits anonymous access.
	 *
	 * Tracked explicitly so `deny-by-default` can distinguish "deliberately
	 * public" from "nobody got round to it" — the whole point of the mode.
	 */
	readonly isPublic: boolean;
	evaluate(
		context: PolicyContext<Shape>
	): PolicyDecision | Promise<PolicyDecision>;
}

const ALLOW: PolicyDecision = { allowed: true };

const deny = (reason: string, status: 401 | 403): PolicyDecision => ({
	allowed: false,
	reason,
	status,
});

/**
 * Policy builders bound to a claims declaration.
 *
 * Bound rather than free functions so the compiler can check claim names and
 * values against the same shape the session was declared with. A typo in a role
 * name fails the build instead of evaluating to `false` on every request — which
 * looks identical to a working deny and is why these bugs survive review.
 */
export interface PolicyBuilders<Shape extends ClaimsShape> {
	/** Requires any valid session. */
	authenticated(): Policy<Shape>;

	/** Requires a claim to equal a value. Both are checked against the shape. */
	claim<Key extends keyof InferClaims<Shape> & string>(
		key: Key,
		value: InferClaims<Shape>[Key]
	): Policy<Shape>;

	/** Requires a claim to be one of several values. */
	claimIn<Key extends keyof InferClaims<Shape> & string>(
		key: Key,
		values: readonly InferClaims<Shape>[Key][]
	): Policy<Shape>;

	/** Every policy must permit. Denies with the first failure's status. */
	all(...policies: readonly Policy<Shape>[]): Policy<Shape>;

	/** At least one policy must permit. */
	any(...policies: readonly Policy<Shape>[]): Policy<Shape>;

	/** Inverts a policy. Requires a session, so it cannot accidentally open a route. */
	not(policy: Policy<Shape>): Policy<Shape>;

	/** An arbitrary predicate over the session and request. */
	custom(
		name: string,
		predicate: (
			context: PolicyContext<Shape>
		) => boolean | Promise<boolean>
	): Policy<Shape>;

	/**
	 * Explicitly public.
	 *
	 * Required under `deny-by-default`: a route that should be open must say so,
	 * so that "open" is a decision in the diff rather than an omission.
	 */
	public(): Policy<Shape>;
}

export const createPolicies = <
	Shape extends ClaimsShape,
>(): PolicyBuilders<Shape> => {
	const authenticated = (): Policy<Shape> => ({
		name: 'authenticated',
		isPublic: false,
		evaluate: ({ session }) =>
			session === undefined ? deny('No session.', 401) : ALLOW,
	});

	const claimPolicy = <Key extends keyof InferClaims<Shape> & string>(
		key: Key,
		values: readonly InferClaims<Shape>[Key][],
		name: string
	): Policy<Shape> => ({
		name,
		isPublic: false,
		evaluate: ({ session }) => {
			// Authentication is checked here rather than assumed. A claim policy used
			// without an `authenticated()` alongside it must not read `undefined` and
			// fall through to a comparison.
			if (session === undefined) return deny('No session.', 401);

			const actual = (session.claims as InferClaims<Shape>)[key];

			return values.includes(actual)
				? ALLOW
				: deny(`Claim "${key}" is not permitted for this route.`, 403);
		},
	});

	return {
		authenticated,

		claim: (key, value) =>
			claimPolicy(key, [value], `claim:${key}=${String(value)}`),

		claimIn: (key, values) =>
			claimPolicy(key, values, `claim:${key} in [${values.map(String).join(',')}]`),

		all: (...policies) => ({
			name: `all(${policies.map((policy) => policy.name).join(', ')})`,
			// A conjunction is public only if every member is. Anything else would
			// let one public member open a route its neighbours meant to guard.
			isPublic: policies.length > 0 && policies.every((policy) => policy.isPublic),
			evaluate: async (context) => {
				for (const policy of policies) {
					const decision = await policy.evaluate(context);
					// First failure wins, so the status reflects the earliest reason —
					// an unauthenticated caller gets 401 rather than a confusing 403.
					if (!decision.allowed) return decision;
				}
				return ALLOW;
			},
		}),

		any: (...policies) => ({
			name: `any(${policies.map((policy) => policy.name).join(', ')})`,
			isPublic: policies.some((policy) => policy.isPublic),
			evaluate: async (context) => {
				if (policies.length === 0) {
					// An empty disjunction permits nothing. Returning ALLOW here would
					// mean `any()` silently opened a route.
					return deny('No alternative policy permitted this request.', 403);
				}

				let last: PolicyDecision = deny('Denied.', 403);

				for (const policy of policies) {
					const decision = await policy.evaluate(context);
					if (decision.allowed) return ALLOW;
					last = decision;
				}

				return last;
			},
		}),

		not: (policy) => ({
			name: `not(${policy.name})`,
			isPublic: false,
			evaluate: async (context) => {
				// Negation still requires a session. Without this, `not(claim('role',
				// 'banned'))` would permit anonymous callers, because an absent
				// session trivially fails the inner policy.
				if (context.session === undefined) return deny('No session.', 401);

				const decision = await policy.evaluate(context);

				return decision.allowed
					? deny(`Excluded by ${policy.name}.`, 403)
					: ALLOW;
			},
		}),

		custom: (name, predicate) => ({
			name,
			isPublic: false,
			evaluate: async (context) => {
				try {
					return (await predicate(context))
						? ALLOW
						: deny(`Custom policy "${name}" denied the request.`, 403);
				} catch {
					// A throwing predicate denies. Failing open here would turn a bug in
					// someone's policy into an authorization bypass.
					return deny(`Custom policy "${name}" threw; denying.`, 403);
				}
			},
		}),

		public: () => ({
			name: 'public',
			isPublic: true,
			evaluate: () => ALLOW,
		}),
	};
};
