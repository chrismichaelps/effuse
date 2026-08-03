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
 * Email and password authentication.
 *
 * This is the most common way people sign in and the flow the incumbent library
 * serves worst: its credentials provider silently does not support database
 * sessions, does not fire the session callback, and ships no hashing, rate
 * limiting, or lockout at all. Every application reimplements the
 * security-critical parts, and most get at least one of them wrong.
 *
 * Here it is a first-class provider that produces the same typed session as any
 * other, with the controls that make password authentication defensible built
 * in rather than left as an exercise.
 */

import {
	AccountLockedError,
	InvalidCredentialsError,
	PasswordPolicyError,
	RateLimitedError,
	type AuthError,
} from '../errors.js';
import type {
	Clock,
	PasswordHasher,
	RateLimiter,
	UserStore,
} from '../contract.js';

export type PasswordPolicy = (password: string) => string | undefined;

export interface CredentialsProviderOptions {
	readonly users: UserStore;
	readonly hasher: PasswordHasher;
	readonly limiter: RateLimiter;
	readonly clock: Clock;
	/** Consecutive failures before the account locks. Defaults to 10. */
	readonly lockoutThreshold?: number;
	/** How long a lock lasts. Defaults to 15 minutes. */
	readonly lockoutDurationMs?: number;
	/** Returns a reason string when a password is unacceptable. */
	readonly passwordPolicy?: PasswordPolicy;
}

export interface AuthenticateInput {
	readonly identifier: string;
	readonly password: string;
	/** The client address, for the per-IP budget. */
	readonly clientIp: string;
}

export type AuthenticateResult =
	| { readonly ok: true; readonly subject: string }
	| { readonly ok: false; readonly error: AuthError };

export type ChangePasswordResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly error: AuthError };

export interface CredentialsProvider {
	authenticate(input: AuthenticateInput): Promise<AuthenticateResult>;
	changePassword(input: {
		readonly subject: string;
		readonly newPassword: string;
	}): Promise<ChangePasswordResult>;
}

const DEFAULT_LOCKOUT_THRESHOLD = 10;
const DEFAULT_LOCKOUT_DURATION_MS = 15 * 60_000;

/** Rate-limit scopes. Separate namespaces keep the two budgets independent. */
const SCOPE_IDENTIFIER = 'credentials:identifier';
const SCOPE_IP = 'credentials:ip';

/**
 * A stand-in hash verified when no user matches.
 *
 * Returning early on an unknown identifier is the classic enumeration leak: the
 * miss answers in microseconds while a real account pays for a full derivation,
 * and the gap is measurable over a handful of requests without any special
 * tooling. Verifying against this instead makes both paths do the same work.
 *
 * Generated once at construction using the configured hasher, so it
 * automatically costs whatever a real verification costs — including after a
 * parameter increase.
 */
const DUMMY_PASSWORD = 'effuse-dummy-verification-password';

/**
 * The default password policy.
 *
 * Length only. Composition rules — a digit, a symbol, mixed case — push people
 * toward predictable substitutions and shorter passwords, which is why current
 * NIST guidance drops them. Length is the requirement that actually correlates
 * with strength.
 */
const defaultPasswordPolicy: PasswordPolicy = (password) => {
	if (password.length < 12) {
		return 'Password must be at least 12 characters.';
	}
	// The upper bound exists because the password is fed to a deliberately slow
	// KDF: without it, a multi-megabyte submission is a free denial of service.
	if (password.length > 256) {
		return 'Password must be at most 256 characters.';
	}
	return undefined;
};

const normaliseIdentifier = (identifier: string): string =>
	identifier.trim().toLowerCase();

export const createCredentialsProvider = (
	options: CredentialsProviderOptions
): CredentialsProvider => {
	const {
		users,
		hasher,
		limiter,
		clock,
		lockoutThreshold = DEFAULT_LOCKOUT_THRESHOLD,
		lockoutDurationMs = DEFAULT_LOCKOUT_DURATION_MS,
		passwordPolicy = defaultPasswordPolicy,
	} = options;

	// Built once, lazily, so construction stays synchronous and the cost is paid
	// on the first unknown-user attempt rather than at boot.
	let dummyHash: Promise<string> | undefined;
	const getDummyHash = (): Promise<string> => {
		dummyHash ??= hasher.hash(DUMMY_PASSWORD);
		return dummyHash;
	};

	return {
		authenticate: async ({ identifier, password, clientIp }) => {
			const normalised = normaliseIdentifier(identifier);

			// Two budgets, consumed independently. A shared budget would let an
			// attacker spend a victim's allowance from anywhere and lock them out
			// without ever guessing a password — turning a brute-force control into
			// a denial-of-service tool.
			const [byIdentifier, byIp] = await Promise.all([
				limiter.consume(SCOPE_IDENTIFIER, normalised),
				limiter.consume(SCOPE_IP, clientIp),
			]);

			if (!byIdentifier.allowed || !byIp.allowed) {
				const exhausted = !byIdentifier.allowed ? byIdentifier : byIp;
				return {
					ok: false,
					error: new RateLimitedError({
						retryAfterMs: exhausted.retryAfterMs,
						scope: !byIdentifier.allowed ? SCOPE_IDENTIFIER : SCOPE_IP,
					}),
				};
			}

			const record = await users.findByIdentifier(normalised);

			if (record === undefined) {
				// Same work, same error, same message as a wrong password. Nothing
				// observable distinguishes the two.
				await hasher.verify(password, await getDummyHash());
				return {
					ok: false,
					error: new InvalidCredentialsError({
						detail: `No credential record for "${normalised}".`,
					}),
				};
			}

			if (
				record.lockedUntil !== undefined &&
				record.lockedUntil > clock.now()
			) {
				return {
					ok: false,
					error: new AccountLockedError({
						retryAfterMs: record.lockedUntil - clock.now(),
						detail: `Subject ${record.subject} is locked.`,
					}),
				};
			}

			const matches = await hasher.verify(password, record.passwordHash);

			if (!matches) {
				const attempts = record.failedAttempts + 1;
				const shouldLock = attempts >= lockoutThreshold;

				await users.recordFailedAttempt(
					record.subject,
					shouldLock ? clock.now() + lockoutDurationMs : undefined
				);

				return {
					ok: false,
					error: new InvalidCredentialsError({
						detail: `Password mismatch for subject ${record.subject}.`,
					}),
				};
			}

			await users.clearFailedAttempts(record.subject);

			// A successful sign-in refunds the identifier budget. Leaving it spent
			// would let a burst of failures throttle the legitimate owner even after
			// they have proven who they are. The IP budget is deliberately not
			// refunded: an address producing many failures stays interesting even
			// once one of them succeeds.
			await limiter.reset(SCOPE_IDENTIFIER, normalised);

			// Opportunistic upgrade. This is the payoff for `needsRehash` being in
			// the port: raising cost needs neither a migration nor a forced reset,
			// because records upgrade as their owners sign in.
			if (hasher.needsRehash(record.passwordHash)) {
				await users.updatePasswordHash(
					record.subject,
					await hasher.hash(password)
				);
			}

			return { ok: true, subject: record.subject };
		},

		changePassword: async ({ subject, newPassword }) => {
			const rejection = passwordPolicy(newPassword);
			if (rejection !== undefined) {
				return {
					ok: false,
					error: new PasswordPolicyError({ reason: rejection }),
				};
			}

			await users.updatePasswordHash(subject, await hasher.hash(newPassword));

			// The user has demonstrably regained control of the account, so keeping
			// the lock in place only punishes the victim of the attempt that set it.
			await users.clearFailedAttempts(subject);

			return { ok: true };
		},
	};
};

export { defaultPasswordPolicy };
