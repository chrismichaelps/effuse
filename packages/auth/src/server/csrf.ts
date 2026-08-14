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
 * Cross-site request forgery protection.
 *
 * A signed, session-bound, expiring token rather than a bare random value
 * echoed back. The binding is what matters: an unbound double-submit token only
 * proves the caller could read a cookie they set themselves, so an attacker who
 * can plant a cookie on a sibling subdomain defeats it. Binding the token to the
 * session identifier means a token minted under the attacker's own account
 * cannot be spent against a victim's session.
 *
 * `SameSite` is treated as defence in depth, not the primary control. It is
 * unevenly enforced across embedded webviews and older clients, and a control
 * that silently varies by user agent is not a control.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConfigError } from '../errors.js';
import { AUTH_SECRET_MIN_LENGTH } from '../security-constants.js';
import type { Clock } from '../contract.js';

export interface CsrfGuardOptions {
	/** Signing secrets. The first signs; all verify, so rotation works as elsewhere. */
	readonly secrets: readonly string[];
	readonly clock: Clock;
	/** Token lifetime. Defaults to 12 hours. */
	readonly ttlMs?: number;
}

export interface CsrfGuard {
	/** Mints a token bound to a session. */
	issue(sessionId: string): Promise<string>;
	/** Never throws; returns `false` for anything it cannot positively verify. */
	verify(sessionId: string, token: string | undefined | null): Promise<boolean>;
	/** Whether a request with this method must present a token. */
	requiresCsrf(method: string): boolean;
}

const DEFAULT_TTL_MS = 12 * 60 * 60_000;

/**
 * Methods defined as safe by RFC 9110.
 *
 * The list is an allowlist rather than a denylist of unsafe methods, so an
 * unrecognised verb is challenged instead of waved through. A method nobody
 * anticipated reaching a state-changing handler unchallenged is a far worse
 * outcome than a needless challenge.
 */
const SAFE_METHODS: ReadonlySet<string> = new Set([
	'GET',
	'HEAD',
	'OPTIONS',
	'TRACE',
]);

const sign = (message: string, secret: string): string =>
	createHmac('sha256', secret).update(message).digest('base64url');

const constantTimeEquals = (a: string, b: string): boolean => {
	const digest = (value: string): Buffer =>
		createHmac('sha256', 'csrf-comparison').update(value).digest();

	return timingSafeEqual(digest(a), digest(b));
};

export const createCsrfGuard = (options: CsrfGuardOptions): CsrfGuard => {
	const { secrets, clock, ttlMs = DEFAULT_TTL_MS } = options;

	if (secrets.length === 0) {
		throw new ConfigError({
			path: 'secrets',
			reason: 'CSRF protection requires at least one signing secret.',
		});
	}

	const [signingSecret] = secrets;
	if (
		signingSecret === undefined ||
		signingSecret.length < AUTH_SECRET_MIN_LENGTH
	) {
		throw new ConfigError({
			path: 'secrets[0]',
			reason: `CSRF signing secrets must be at least ${String(AUTH_SECRET_MIN_LENGTH)} characters.`,
		});
	}

	return {
		issue: (sessionId) => {
			// The nonce makes every issued token distinct. A per-session constant
			// would be replayable indefinitely once captured a single time.
			const nonce = randomBytes(16).toString('base64url');
			const expiresAt = clock.now() + ttlMs;
			const message = `${nonce}.${String(expiresAt)}.${sessionId}`;

			return Promise.resolve(
				`${nonce}.${String(expiresAt)}.${sign(message, signingSecret)}`
			);
		},

		verify: (sessionId, token) => {
			if (typeof token !== 'string' || token.length === 0) {
				return Promise.resolve(false);
			}

			const parts = token.split('.');
			if (parts.length !== 3) return Promise.resolve(false);

			const [nonce, expiresAtRaw, signature] = parts;
			if (
				nonce === undefined ||
				expiresAtRaw === undefined ||
				signature === undefined
			) {
				return Promise.resolve(false);
			}

			const expiresAt = Number(expiresAtRaw);
			if (!Number.isFinite(expiresAt)) return Promise.resolve(false);
			if (clock.now() > expiresAt) return Promise.resolve(false);

			// The session id is part of the signed message, not merely compared
			// afterwards, so a token cannot be lifted from one session to another.
			const message = `${nonce}.${expiresAtRaw}.${sessionId}`;

			return Promise.resolve(
				secrets.some((secret) =>
					constantTimeEquals(sign(message, secret), signature)
				)
			);
		},

		requiresCsrf: (method) => !SAFE_METHODS.has(method.toUpperCase()),
	};
};
