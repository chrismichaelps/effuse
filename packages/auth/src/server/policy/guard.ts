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
 * Applying policies to real requests.
 *
 * The guard resolves the session, finds the matching rules, evaluates them, and
 * either permits the request or produces a response. The session is resolved
 * once and handed to the policy, so a policy cannot cause a second resolution
 * and cannot observe a different session from the handler it guards.
 *
 * `deny-by-default` is available at runtime as well as at build time. The build
 * check is the one that should catch omissions, but a route registered
 * dynamically has no build step to catch it — and defaulting to open for exactly
 * the routes nobody compiled is the wrong way round.
 */

import {
	ForbiddenError,
	SessionNotFoundError,
	toSafeResponseInit,
	type AuthError,
} from '../../errors.js';
import type { ClaimsShape } from '../../claims.js';
import type { Session } from '../session-engine.js';
import type { PolicyDecision } from './predicates.js';
import type { PolicyRegistry } from './registry.js';

export interface GuardOptions<Shape extends ClaimsShape> {
	readonly registry: PolicyRegistry<Shape>;
	/** Resolves the session for a request. Normally `auth.fromRequest`. */
	readonly resolveSession: (request: Request) => Promise<{
		readonly session: Session<Shape> | undefined;
		readonly setCookies?: readonly string[];
	}>;
	/**
	 * What to do when no rule matches. Defaults to `deny`.
	 *
	 * `allow` exists for incremental adoption of an existing application, and is
	 * the setting to remove first. It is named rather than implied so that
	 * running open is a visible choice.
	 */
	readonly unmatched?: 'deny' | 'allow';
}

export type GuardOutcome<Shape extends ClaimsShape> =
	| {
			readonly allowed: true;
			readonly session: Session<Shape> | undefined;
			readonly setCookies: readonly string[];
	  }
	| {
			readonly allowed: false;
			readonly error: AuthError;
			readonly status: 401 | 403;
			readonly reason: string;
			readonly setCookies: readonly string[];
			/**
			 * The session that was refused, when there was one.
			 *
			 * Carried on the denial branch too, because "which user was denied
			 * what" is the question an audit log needs to answer. Omitting it here
			 * would make every 403 anonymous in the logs.
			 */
			readonly session: Session<Shape> | undefined;
	  };

export interface PolicyGuard<Shape extends ClaimsShape> {
	/** Evaluates the policies for a request. */
	check(request: Request): Promise<GuardOutcome<Shape>>;
	/** Evaluates and, on denial, produces the response to send. */
	protect(request: Request): Promise<{
		readonly response: Response | undefined;
		readonly session: Session<Shape> | undefined;
		readonly setCookies: readonly string[];
	}>;
}

// 401 means "sign in"; 403 means "signing in again will not help". Sending the
// second as the first bounces an authenticated user through a sign-in page they
// will come straight back out of.
const denialError = (status: 401 | 403, reason: string): AuthError =>
	status === 401
		? new SessionNotFoundError({ detail: reason })
		: new ForbiddenError({ detail: reason });

export const createPolicyGuard = <Shape extends ClaimsShape>(
	options: GuardOptions<Shape>
): PolicyGuard<Shape> => {
	const { registry, resolveSession, unmatched = 'deny' } = options;

	const guard: PolicyGuard<Shape> = {
		check: async (request) => {
			const url = new URL(request.url);
			const method = request.method;

			const match = registry.resolve(url.pathname, method);

			// Resolved once, before evaluation, and reused. A policy that resolved
			// its own session could see a different one from the handler — the
			// classic time-of-check-to-time-of-use gap.
			const resolved = await resolveSession(request);
			const setCookies = resolved.setCookies ?? [];

			if (match.policy === undefined) {
				if (unmatched === 'allow') {
					return { allowed: true, session: resolved.session, setCookies };
				}

				return {
					allowed: false,
					error: denialError(
						resolved.session === undefined ? 401 : 403,
						`No policy covers ${method} ${url.pathname}.`
					),
					status: resolved.session === undefined ? 401 : 403,
					reason: `No policy covers ${method} ${url.pathname}.`,
					setCookies,
					session: resolved.session,
				};
			}

			let decision: PolicyDecision;
			try {
				decision = await match.policy.evaluate({
					session: resolved.session,
					method,
					path: url.pathname,
					request,
				});
			} catch {
				// A throwing policy denies. Failing open would turn any bug in a
				// custom predicate into an authorization bypass.
				decision = {
					allowed: false,
					reason: 'Policy evaluation threw.',
					status: 403,
				};
			}

			if (decision.allowed) {
				return { allowed: true, session: resolved.session, setCookies };
			}

			return {
				allowed: false,
				error: denialError(decision.status, decision.reason),
				status: decision.status,
				reason: decision.reason,
				setCookies,
				session: resolved.session,
			};
		},

		protect: async (request) => {
			const outcome = await guard.check(request);

			if (outcome.allowed) {
				return {
					response: undefined,
					session: outcome.session,
					setCookies: outcome.setCookies,
				};
			}

			const { headers, body } = toSafeResponseInit(outcome.error);

			return {
				response: new Response(JSON.stringify(body), {
					status: outcome.status,
					headers,
				}),
				session: outcome.session,
				setCookies: outcome.setCookies,
			};
		},
	};

	return guard;
};
