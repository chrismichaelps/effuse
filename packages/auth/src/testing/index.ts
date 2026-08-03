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
 * In-memory ports and time control for tests.
 *
 * Two things here matter more than they look:
 *
 * - **The clock is controllable.** Without it, every expiry, lockout, and
 *   backoff test is either slow or flaky, so in practice those tests do not get
 *   written — and expiry logic is exactly where auth bugs hide.
 * - **These implementations are the reference, not a mock.** They pass the same
 *   conformance suite a Redis or Postgres implementation must pass, so a test
 *   that goes green here is evidence about the contract rather than about a
 *   stub someone wrote to match their assumptions.
 */

import type {
	Clock,
	CredentialRecord,
	LockHandle,
	PasswordResetRecord,
	PasswordResetStore,
	RateLimitVerdict,
	RateLimiter,
	SessionId,
	SessionStore,
	StoredSession,
	UserStore,
} from '../contract.js';

/** A {@link Clock} whose time only moves when a test moves it. */
export interface TestClock extends Clock {
	/** Moves time forward. */
	advance(ms: number): void;
	/** Jumps to an absolute epoch-millis instant, forwards or backwards. */
	set(epochMs: number): void;
}

/**
 * Creates a clock that starts at a fixed instant and never ticks on its own.
 *
 * The default start is a real, arbitrary past instant rather than `0`, so that
 * code accidentally treating a timestamp as falsy is caught.
 */
export const createTestClock = (
	startEpochMs = 1_700_000_000_000
): TestClock => {
	let current = startEpochMs;

	return {
		now: () => current,
		advance: (ms) => {
			current += ms;
		},
		set: (epochMs) => {
			current = epochMs;
		},
	};
};

/** The real clock. */
export const systemClock: Clock = { now: () => Date.now() };

interface LockEntry {
	readonly token: string;
	readonly expiresAt: number;
}

/** A {@link SessionStore} for tests, with observable internals. */
export interface MemorySessionStore extends SessionStore {
	/** Every live session, for assertions. */
	readonly snapshot: () => readonly StoredSession[];
	/** Drops everything, including held locks. */
	readonly reset: () => void;
}

/**
 * An in-memory {@link SessionStore}.
 *
 * The lock is genuinely exclusive within the process and honours its TTL, which
 * is enough to exercise single-flight refresh under real concurrency. It is not
 * a substitute for a shared lock in production — a process-local lock across
 * several replicas is a race that passes its tests — and the conformance suite
 * says so explicitly.
 */
export const createMemorySessionStore = (
	clock: Clock = systemClock
): MemorySessionStore => {
	const sessions = new Map<string, StoredSession>();
	const locks = new Map<string, LockEntry>();

	let lockCounter = 0;

	return {
		// Copied on read as well, so a caller mutating what it received cannot
		// reach back into the store.
		read: (id) => {
			const found = sessions.get(id);
			return Promise.resolve(
				found === undefined ? undefined : structuredClone(found)
			);
		},

		// Deep copy, not a spread. A shallow copy leaves nested `claims` shared
		// with the caller, so mutating it after the write silently rewrites stored
		// state — and since no remote backend behaves that way, code written
		// against the shallow version breaks only once deployed.
		write: (session) => {
			sessions.set(session.id, structuredClone(session));
			return Promise.resolve();
		},

		destroy: (id) => {
			sessions.delete(id);
			return Promise.resolve();
		},

		destroyForSubject: (subject) => {
			let removed = 0;
			for (const [id, session] of sessions) {
				if (session.subject !== subject) continue;
				sessions.delete(id);
				removed += 1;
			}
			return Promise.resolve(removed);
		},

		acquireLock: (key, ttlMs) => {
			const held = locks.get(key);

			// An expired lock is treated as free. This is what stops a process that
			// died mid-critical-section from wedging a session permanently.
			if (held !== undefined && held.expiresAt > clock.now()) {
				return Promise.resolve(undefined);
			}

			lockCounter += 1;
			const token = `lock_${String(lockCounter)}`;
			locks.set(key, { token, expiresAt: clock.now() + ttlMs });

			const handle: LockHandle = {
				key,
				token,
				release: () => {
					// Fencing: only release the lock if it is still ours. A slow holder
					// whose TTL lapsed must not release the successor's lock.
					if (locks.get(key)?.token === token) locks.delete(key);
					return Promise.resolve();
				},
			};

			return Promise.resolve(handle);
		},

		snapshot: () => [...sessions.values()],

		reset: () => {
			sessions.clear();
			locks.clear();
		},
	};
};

export interface RateLimiterOptions {
	/** Attempts permitted per window. */
	readonly limit: number;
	/** Window length in milliseconds. */
	readonly windowMs: number;
}

interface Bucket {
	count: number;
	windowStartedAt: number;
}

/**
 * An in-memory {@link RateLimiter} using a fixed window.
 *
 * Budgets are keyed by `scope` and `key` together, so a per-identifier limit and
 * a per-IP limit never share a bucket. Sharing them would let an attacker spend
 * a victim's allowance and lock them out — converting a brute-force control
 * into a denial-of-service tool.
 */
export const createMemoryRateLimiter = (
	options: RateLimiterOptions,
	clock: Clock = systemClock
): RateLimiter => {
	const buckets = new Map<string, Bucket>();

	const bucketFor = (scope: string, key: string): Bucket => {
		const id = `${scope}::${key}`;
		const now = clock.now();
		const existing = buckets.get(id);

		if (
			existing === undefined ||
			now - existing.windowStartedAt >= options.windowMs
		) {
			const fresh: Bucket = { count: 0, windowStartedAt: now };
			buckets.set(id, fresh);
			return fresh;
		}

		return existing;
	};

	const verdictFor = (bucket: Bucket): RateLimitVerdict => {
		const allowed = bucket.count <= options.limit;
		const elapsed = clock.now() - bucket.windowStartedAt;

		return {
			allowed,
			remaining: Math.max(0, options.limit - bucket.count),
			retryAfterMs: allowed ? 0 : Math.max(1, options.windowMs - elapsed),
		};
	};

	return {
		consume: (scope, key) => {
			const bucket = bucketFor(scope, key);
			bucket.count += 1;
			return Promise.resolve(verdictFor(bucket));
		},

		peek: (scope, key) => Promise.resolve(verdictFor(bucketFor(scope, key))),

		reset: (scope, key) => {
			buckets.delete(`${scope}::${key}`);
			return Promise.resolve();
		},
	};
};

/** A {@link UserStore} for tests, seedable with credential records. */
export interface MemoryUserStore extends UserStore {
	readonly seed: (record: CredentialRecord) => void;
	readonly get: (subject: string) => CredentialRecord | undefined;
}

/** An in-memory {@link UserStore}. */
export const createMemoryUserStore = (): MemoryUserStore => {
	const bySubject = new Map<string, CredentialRecord>();
	const byIdentifier = new Map<string, string>();

	// Identifiers are compared case-insensitively, matching how email addresses
	// are treated in practice. Without this, `A@example.com` and `a@example.com`
	// would be separate accounts with separate lockout budgets, and an attacker
	// could sidestep lockout by varying the case.
	const normalise = (identifier: string): string => identifier.toLowerCase();

	const put = (record: CredentialRecord): void => {
		bySubject.set(record.subject, record);
		byIdentifier.set(normalise(record.identifier), record.subject);
	};

	return {
		seed: put,

		get: (subject) => bySubject.get(subject),

		findByIdentifier: (identifier) => {
			const subject = byIdentifier.get(normalise(identifier));
			return Promise.resolve(
				subject === undefined ? undefined : bySubject.get(subject)
			);
		},

		updatePasswordHash: (subject, passwordHash) => {
			const existing = bySubject.get(subject);
			if (existing !== undefined) put({ ...existing, passwordHash });
			return Promise.resolve();
		},

		recordFailedAttempt: (subject, lockedUntil) => {
			const existing = bySubject.get(subject);
			if (existing === undefined) return Promise.resolve();

			put({
				...existing,
				failedAttempts: existing.failedAttempts + 1,
				...(lockedUntil === undefined ? {} : { lockedUntil }),
			});
			return Promise.resolve();
		},

		clearFailedAttempts: (subject) => {
			const existing = bySubject.get(subject);
			if (existing === undefined) return Promise.resolve();

			// Rebuilt without `lockedUntil` rather than set to undefined, so the
			// record genuinely has no lock rather than one that reads as absent.
			const cleared: CredentialRecord = {
				subject: existing.subject,
				identifier: existing.identifier,
				passwordHash: existing.passwordHash,
				failedAttempts: 0,
			};
			put(cleared);
			return Promise.resolve();
		},
	};
};

/** An in-memory password-reset store with observable live records. */
export interface MemoryPasswordResetStore extends PasswordResetStore {
	readonly snapshot: () => readonly PasswordResetRecord[];
	readonly reset: () => void;
}

/**
 * Reference implementation of the atomic password-reset persistence contract.
 *
 * Map mutations occur synchronously before each promise resolves, so concurrent
 * consumers in one process exercise the same single-winner contract a database
 * adapter must implement with a transaction or compare-and-delete operation.
 */
export const createMemoryPasswordResetStore = (): MemoryPasswordResetStore => {
	const byDigest = new Map<string, PasswordResetRecord>();
	const digestBySubject = new Map<string, string>();

	const remove = (record: PasswordResetRecord): void => {
		byDigest.delete(record.digest);
		if (digestBySubject.get(record.subject) === record.digest) {
			digestBySubject.delete(record.subject);
		}
	};

	const findLive = (
		digest: string,
		now: number
	): PasswordResetRecord | undefined => {
		const record = byDigest.get(digest);
		if (record === undefined) return undefined;
		if (record.expiresAt <= now) {
			remove(record);
			return undefined;
		}
		return record;
	};

	return {
		replace: (record) => {
			const previousDigest = digestBySubject.get(record.subject);
			if (previousDigest !== undefined) {
				const previous = byDigest.get(previousDigest);
				if (previous !== undefined) remove(previous);
			}

			const copy = structuredClone(record);
			byDigest.set(copy.digest, copy);
			digestBySubject.set(copy.subject, copy.digest);
			return Promise.resolve();
		},

		read: (digest, now) => {
			const record = findLive(digest, now);
			return Promise.resolve(
				record === undefined ? undefined : structuredClone(record)
			);
		},

		consume: (digest, now) => {
			const record = findLive(digest, now);
			if (record === undefined) return Promise.resolve(undefined);
			remove(record);
			return Promise.resolve(structuredClone(record));
		},

		revokeForSubject: (subject) => {
			const digest = digestBySubject.get(subject);
			if (digest !== undefined) {
				const record = byDigest.get(digest);
				if (record !== undefined) remove(record);
			}
			return Promise.resolve();
		},

		snapshot: () =>
			[...byDigest.values()].map((record) => structuredClone(record)),
		reset: () => {
			byDigest.clear();
			digestBySubject.clear();
		},
	};
};

/** Narrows a string to a {@link SessionId} in test fixtures. */
export const asSessionId = (value: string): SessionId => value as SessionId;

export {
	createFakeIdp,
	publicKeyFromJwk,
	type AuthorizeOptions,
	type FakeIdp,
	type FakeIdpOptions,
	type MintOptions,
} from './fake-idp.js';

export { createMemoryAuthStorage } from './storage.js';

export {
	createTestEnvironment,
	createTestSession,
	TEST_SECRET,
	type CreateTestSessionOptions,
	type TestSession,
} from './session.js';
