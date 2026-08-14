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
import { AUTH_SECRET_MIN_LENGTH } from './security-constants.js';
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
	/** Request the `__Host-` prefix. Defaults on when the other cookie options qualify. */
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

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const FORBIDDEN_COOKIE_NAMES: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
]);
const COOKIE_DOMAIN_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

const hasForbiddenCookieMetadata = (value: string): boolean => {
	for (const character of value) {
		const code = character.charCodeAt(0);
		if (code <= 31 || code === 127 || code === 59) return true;
	}
	return false;
};

const configError = (path: string, reason: string): never => {
	throw new ConfigError({ path, reason });
};

const normalizeCookieDomain = (
	domain: string | undefined
): string | undefined => {
	if (domain === undefined) return undefined;
	if (domain.length === 0) {
		return configError('cookie.domain', 'Cookie domain must not be empty.');
	}
	if (domain !== domain.trim()) {
		return configError(
			'cookie.domain',
			'Cookie domain must not contain surrounding whitespace.'
		);
	}
	if (hasForbiddenCookieMetadata(domain)) {
		return configError(
			'cookie.domain',
			'Cookie domain must not contain controls or semicolons.'
		);
	}
	if (/[/:@?#\\]/.test(domain)) {
		return configError(
			'cookie.domain',
			'Expected a hostname only, without a scheme, port, path, query, or fragment.'
		);
	}

	const normalized = (
		domain.startsWith('.') ? domain.slice(1) : domain
	).toLowerCase();
	if (normalized.length === 0) {
		return configError(
			'cookie.domain',
			'Cookie domain must contain a hostname.'
		);
	}
	if (normalized.length > 253) {
		return configError(
			'cookie.domain',
			'Cookie domain must not exceed 253 characters.'
		);
	}
	if (!COOKIE_DOMAIN_PATTERN.test(normalized)) {
		return configError(
			'cookie.domain',
			'Expected a valid ASCII hostname. Convert internationalized domains to their punycode form first.'
		);
	}

	return normalized;
};

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

	const seenSecrets = new Set<string>();
	input.secrets.forEach((secret, index) => {
		if (secret.length < AUTH_SECRET_MIN_LENGTH) {
			configError(
				`secrets[${String(index)}]`,
				`Signing secrets must be at least ${String(AUTH_SECRET_MIN_LENGTH)} characters. A shorter secret is brute-forceable offline against a captured token.`
			);
		}
		if (seenSecrets.has(secret)) {
			configError(
				`secrets[${String(index)}]`,
				'A signing secret appears more than once. Rotation entries must be distinct and ordered newest first.'
			);
		}
		seenSecrets.add(secret);
	});

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
	const cookieName = input.cookie?.name ?? DEFAULTS.cookieName;
	const cookiePath = input.cookie?.path ?? DEFAULTS.cookiePath;
	const cookieDomain = normalizeCookieDomain(input.cookie?.domain);

	if (
		!COOKIE_NAME_PATTERN.test(cookieName) ||
		FORBIDDEN_COOKIE_NAMES.has(cookieName) ||
		cookieName.startsWith('__Host-') ||
		cookieName.startsWith('__Secure-')
	) {
		configError(
			'cookie.name',
			'Expected an unprefixed HTTP token containing no spaces, controls, separators, or reserved cookie prefixes.'
		);
	}

	if (!cookiePath.startsWith('/') || hasForbiddenCookieMetadata(cookiePath)) {
		configError(
			'cookie.path',
			'Expected an absolute cookie path beginning with "/" and containing no controls or semicolons.'
		);
	}

	if (sameSite === 'none' && !secure) {
		throw new ConfigError({
			path: 'cookie.sameSite',
			reason:
				'SameSite=None requires Secure. Browsers reject the combination outright, so the session cookie would never persist.',
		});
	}

	const explicitlyRequestedHostPrefix = input.cookie?.hostPrefix === true;
	const qualifiesForHostPrefix =
		secure && cookiePath === '/' && cookieDomain === undefined;
	if (explicitlyRequestedHostPrefix && !qualifiesForHostPrefix) {
		configError(
			'cookie.hostPrefix',
			'__Host- cookies require Secure, Path=/, and no Domain. Remove the conflicting option or set hostPrefix to false explicitly.'
		);
	}
	const hostPrefix = input.cookie?.hostPrefix ?? qualifiesForHostPrefix;

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
			name: cookieName,
			path: cookiePath,
			secure,
			sameSite,
			domain: cookieDomain,
			// On by default. The prefix is enforced by the browser and is what stops
			// a sibling subdomain overwriting the session cookie — the usual
			// session-fixation route on a shared apex domain.
			hostPrefix,
		},
	};
};
