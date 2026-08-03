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
 * Single-use password-reset capabilities.
 *
 * This service deliberately starts after account lookup. Applications own the
 * identifier-facing endpoint and must return the same response for known and
 * unknown accounts. Keeping email delivery and URL construction outside this
 * module also prevents an untrusted Host header from becoming a reset origin.
 */

import { createHash, randomBytes } from 'node:crypto';
import type {
	Clock,
	PasswordHasher,
	PasswordResetStore,
	RateLimiter,
	SessionStore,
	UserStore,
} from '../contract.js';
import {
	ConfigError,
	InvalidResetTokenError,
	PasswordPolicyError,
	RateLimitedError,
} from '../errors.js';
import { defaultPasswordPolicy, type PasswordPolicy } from './credentials.js';

export const DEFAULT_PASSWORD_RESET_TTL_MS = 15 * 60_000;
export const MAX_PASSWORD_RESET_TTL_MS = 24 * 60 * 60_000;

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SCOPE_ISSUE_SUBJECT = 'password-reset:issue:subject';
const SCOPE_ISSUE_IP = 'password-reset:issue:ip';
const SCOPE_REDEEM_IP = 'password-reset:redeem:ip';

export interface PasswordResetCompletedEvent {
	readonly subject: string;
	readonly revokedSessions: number;
	readonly completedAt: number;
}

export interface PasswordResetServiceOptions {
	readonly store: PasswordResetStore;
	readonly users: UserStore;
	readonly hasher: PasswordHasher;
	readonly sessions: SessionStore;
	readonly limiter: RateLimiter;
	readonly clock: Clock;
	/** Defaults to 15 minutes and cannot exceed 24 hours. */
	readonly tokenTtlMs?: number;
	readonly passwordPolicy?: PasswordPolicy;
	/**
	 * Called after the password and sessions have changed. Use this to enqueue
	 * the required account-security notification through a durable outbox.
	 */
	readonly onCompleted: (
		event: PasswordResetCompletedEvent
	) => Promise<void> | void;
}

export type IssuePasswordResetResult =
	| {
			readonly ok: true;
			readonly token: string;
			readonly expiresAt: number;
	  }
	| { readonly ok: false; readonly error: RateLimitedError };

export type RedeemPasswordResetResult =
	| { readonly ok: true; readonly revokedSessions: number }
	| {
			readonly ok: false;
			readonly error:
				| InvalidResetTokenError
				| PasswordPolicyError
				| RateLimitedError;
	  };

export interface PasswordResetService {
	/** Issues a new capability and atomically invalidates the subject's prior one. */
	issue(input: {
		readonly subject: string;
		readonly clientIp: string;
	}): Promise<IssuePasswordResetResult>;
	/** Changes the password exactly once and revokes every active session. */
	redeem(input: {
		readonly token: string;
		readonly newPassword: string;
		readonly clientIp: string;
	}): Promise<RedeemPasswordResetResult>;
	/** Revokes a pending capability, for example after an administrator action. */
	revoke(subject: string): Promise<void>;
}

const digestToken = (token: string): string =>
	// Stryker disable next-line StringLiteral: empty and omitted update encodings are both UTF-8 in Node
	createHash('sha256').update(token, 'utf8').digest('hex');

const rateLimitError = (
	verdict: { readonly retryAfterMs: number },
	scope: string
): RateLimitedError =>
	new RateLimitedError({ retryAfterMs: verdict.retryAfterMs, scope });

export const createPasswordResetService = (
	options: PasswordResetServiceOptions
): PasswordResetService => {
	const {
		store,
		users,
		hasher,
		sessions,
		limiter,
		clock,
		tokenTtlMs = DEFAULT_PASSWORD_RESET_TTL_MS,
		passwordPolicy = defaultPasswordPolicy,
		onCompleted,
	} = options;

	if (
		!Number.isFinite(tokenTtlMs) ||
		tokenTtlMs <= 0 ||
		tokenTtlMs > MAX_PASSWORD_RESET_TTL_MS
	) {
		throw new ConfigError({
			path: 'passwordReset.tokenTtlMs',
			reason: `Expected a positive finite duration no greater than ${String(MAX_PASSWORD_RESET_TTL_MS)}ms.`,
		});
	}

	return {
		issue: async ({ subject, clientIp }) => {
			const [bySubject, byIp] = await Promise.all([
				limiter.consume(SCOPE_ISSUE_SUBJECT, subject),
				limiter.consume(SCOPE_ISSUE_IP, clientIp),
			]);
			if (!bySubject.allowed) {
				return {
					ok: false,
					error: rateLimitError(bySubject, SCOPE_ISSUE_SUBJECT),
				};
			}
			if (!byIp.allowed) {
				return { ok: false, error: rateLimitError(byIp, SCOPE_ISSUE_IP) };
			}

			const token = randomBytes(TOKEN_BYTES).toString('base64url');
			const expiresAt = clock.now() + tokenTtlMs;
			await store.replace({ digest: digestToken(token), subject, expiresAt });

			return { ok: true, token, expiresAt };
		},

		redeem: async ({ token, newPassword, clientIp }) => {
			const rate = await limiter.consume(SCOPE_REDEEM_IP, clientIp);
			if (!rate.allowed) {
				return { ok: false, error: rateLimitError(rate, SCOPE_REDEEM_IP) };
			}

			if (!TOKEN_PATTERN.test(token)) {
				return {
					ok: false,
					error: new InvalidResetTokenError({
						detail: 'Malformed reset token.',
					}),
				};
			}

			const digest = digestToken(token);
			const available = await store.read(digest, clock.now());
			if (available === undefined) {
				return {
					ok: false,
					error: new InvalidResetTokenError({
						detail: 'Reset token is absent, expired, replaced, or consumed.',
					}),
				};
			}

			const rejection = passwordPolicy(newPassword);
			if (rejection !== undefined) {
				return {
					ok: false,
					error: new PasswordPolicyError({ reason: rejection }),
				};
			}

			// Hash before atomic consumption: malformed and unknown tokens stay cheap,
			// while a password-policy rejection leaves a valid link usable.
			const passwordHash = await hasher.hash(newPassword);
			const consumed = await store.consume(digest, clock.now());
			if (consumed === undefined || consumed.subject !== available.subject) {
				return {
					ok: false,
					error: new InvalidResetTokenError({
						detail: 'Reset token lost an atomic redemption race.',
					}),
				};
			}

			const revokedSessions = await sessions.destroyForSubject(
				consumed.subject
			);
			await users.updatePasswordHash(consumed.subject, passwordHash);
			await onCompleted({
				subject: consumed.subject,
				revokedSessions,
				completedAt: clock.now(),
			});

			return { ok: true, revokedSessions };
		},

		revoke: (subject) => store.revokeForSubject(subject),
	};
};
