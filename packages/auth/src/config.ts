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
 * Configuration.
 *
 * One config object, not two. The incumbent library's documented workaround for
 * edge runtimes is maintaining a split `auth.config.ts` / `auth.ts` pair,
 * because its adapters use Node APIs that fail in middleware — an implementation
 * constraint that leaks all the way into how users organise their files. Here
 * the runtime split is handled by entrypoints (`@effuse/auth` is isomorphic,
 * `@effuse/auth/server` is not), so the configuration stays singular.
 *
 * This module deliberately imports nothing from `node:`. It is reachable from
 * the client entrypoint, and a `node:crypto` import here is how the browser
 * bundle acquires polyfills nobody asked for.
 */

import { ConfigError } from './errors.js';
import type { ClaimsShape } from './claims.js';
import type { SameSitePolicy } from './server/cookies.js';

export interface SessionConfigInput {
	/** Defaults to `stateful` when a store is supplied, `stateless` otherwise. */
	readonly strategy?: 'stateless' | 'stateful';
	/** Inactivity before expiry. Defaults to 30 minutes. */
	readonly idleTtlMs?: number;
	/** Hard lifetime regardless of activity. Defaults to 12 hours. */
	readonly absoluteTtlMs?: number;
	/** How long a rotated-away session stays resolvable. Defaults to 10 seconds. */
	readonly rotationOverlapMs?: number;
}

export interface CookieConfigInput {
	/** Cookie name, without the `__Host-` prefix. Defaults to `effuse.session`. */
	readonly name?: string;
	readonly path?: string;
	/** Defaults to `true`. Set false only for local http development. */
	readonly secure?: boolean;
	/** Defaults to `lax`. */
	readonly sameSite?: SameSitePolicy;
	readonly domain?: string;
	/** Request the `__Host-` prefix. Defaults to `true`. */
	readonly hostPrefix?: boolean;
}

export interface AuthConfigInput<Shape extends ClaimsShape> {
	/**
	 * Signing secrets, newest first. The first signs; all verify.
	 *
	 * Rotation is a two-deploy operation with no forced sign-out: prepend the new
	 * secret, wait out the absolute session lifetime, then drop the old one.
	 */
	readonly secrets: readonly string[];
	/** The session shape, declared once and inferred everywhere. */
	readonly claims: Shape;
	readonly session?: SessionConfigInput;
	readonly cookie?: CookieConfigInput;
}

export interface AuthConfig<Shape extends ClaimsShape> {
	readonly secrets: readonly string[];
	readonly claims: Shape;
	readonly session: Required<Omit<SessionConfigInput, 'strategy'>> & {
		readonly strategy: 'stateless' | 'stateful' | undefined;
	};
	readonly cookie: Required<Omit<CookieConfigInput, 'domain'>> & {
		readonly domain: string | undefined;
	};
}

const DEFAULTS = {
	idleTtlMs: 30 * 60_000,
	absoluteTtlMs: 12 * 60 * 60_000,
	rotationOverlapMs: 10_000,
	cookieName: 'effuse.session',
	cookiePath: '/',
} as const;

const assertFiniteDuration = (
	path: string,
	value: number,
	minimum: 'positive' | 'non-negative'
): void => {
	const valid =
		Number.isFinite(value) && (minimum === 'positive' ? value > 0 : value >= 0);

	if (!valid) {
		throw new ConfigError({
			path,
			reason: `Expected a finite ${minimum} duration in milliseconds.`,
		});
	}
};

/**
 * Validates and normalises configuration.
 *
 * Everything that can be checked here is checked here rather than on the first
 * request. A deployment that boots healthy and only reveals a missing secret
 * once traffic arrives is strictly worse than one that refuses to start, because
 * the first failure mode is discovered by users.
 */
export const defineAuth = <Shape extends ClaimsShape>(
	input: AuthConfigInput<Shape>
): AuthConfig<Shape> => {
	if (input.secrets.length === 0) {
		throw new ConfigError({
			path: 'secrets',
			reason:
				'At least one signing secret is required. Generate one with `openssl rand -base64 32`.',
		});
	}

	if (Object.keys(input.claims).length === 0) {
		throw new ConfigError({
			path: 'claims',
			reason:
				'Declare at least one claim. The claims shape is what gives every call site its session type.',
		});
	}

	const idleTtlMs = input.session?.idleTtlMs ?? DEFAULTS.idleTtlMs;
	const absoluteTtlMs = input.session?.absoluteTtlMs ?? DEFAULTS.absoluteTtlMs;
	const rotationOverlapMs =
		input.session?.rotationOverlapMs ?? DEFAULTS.rotationOverlapMs;

	assertFiniteDuration('session.idleTtlMs', idleTtlMs, 'positive');
	assertFiniteDuration('session.absoluteTtlMs', absoluteTtlMs, 'positive');
	assertFiniteDuration(
		'session.rotationOverlapMs',
		rotationOverlapMs,
		// Stryker disable next-line StringLiteral: the helper fallback is the same non-negative branch
		'non-negative'
	);

	if (idleTtlMs > absoluteTtlMs) {
		throw new ConfigError({
			path: 'session.idleTtlMs',
			reason:
				'The idle window exceeds the absolute lifetime, so idle expiry can never fire and one of the two controls is doing nothing.',
		});
	}

	const secure = input.cookie?.secure ?? true;
	const sameSite = input.cookie?.sameSite ?? 'lax';

	if (sameSite === 'none' && !secure) {
		throw new ConfigError({
			path: 'cookie.sameSite',
			reason:
				'SameSite=None requires Secure. Browsers reject the combination outright, so the session cookie would never persist.',
		});
	}

	return {
		secrets: input.secrets,
		claims: input.claims,
		session: {
			strategy: input.session?.strategy,
			idleTtlMs,
			absoluteTtlMs,
			rotationOverlapMs,
		},
		cookie: {
			name: input.cookie?.name ?? DEFAULTS.cookieName,
			path: input.cookie?.path ?? DEFAULTS.cookiePath,
			secure,
			sameSite,
			domain: input.cookie?.domain,
			// On by default. The prefix is enforced by the browser and is what stops
			// a sibling subdomain overwriting the session cookie — the usual
			// session-fixation route on a shared apex domain. It is dropped
			// automatically when a Domain is set and the cookie no longer qualifies.
			hostPrefix: input.cookie?.hostPrefix ?? true,
		},
	};
};
