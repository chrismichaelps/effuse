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
 * The ports `@effuse/auth` builds on.
 *
 * These are deliberately several small interfaces rather than one large
 * adapter. The prevailing design in this space is a single ~15-method contract
 * covering users, accounts, sessions, and verification tokens, which cannot be
 * partially implemented: an application that only wants OAuth still has to
 * supply password machinery, and a schema change breaks every implementation at
 * once.
 *
 * Here, a backend is a detail rather than an application-wide commitment. Most
 * applications implement none of these — {@link SessionStore} layers over any
 * key-value storage, and {@link UserStore} is only required by the credentials
 * provider.
 *
 * Every port ships an in-memory reference implementation in
 * `@effuse/auth/testing` and an executable conformance suite in
 * `@effuse/auth/conformance`, so a third-party implementation can prove itself
 * correct rather than diverging silently.
 */

/**
 * The minimal key-value surface {@link SessionStore} needs.
 *
 * Structurally satisfied by `EffuseStorage` from `@effuse/server`, and declared
 * here rather than imported so this package does not take a hard dependency on
 * the server runtime. Passing `createMemoryStorage()` from `@effuse/server`
 * just works; so does a Redis client wrapper of about thirty lines.
 */
export interface AuthStorage {
	get<Value = unknown>(key: string): Promise<Value | undefined>;
	set(
		key: string,
		value: unknown,
		options?: { readonly ttlMs?: number }
	): Promise<void>;
	delete(key: string): Promise<void>;
	has(key: string): Promise<boolean>;
	keys(): Promise<readonly string[]>;
	clear(): Promise<void>;
	namespace(name: string): AuthStorage;
}

/** Time, injected. */
export interface Clock {
	/** Milliseconds since the Unix epoch. */
	now(): number;
}

/**
 * Persistence for stateful sessions, and the coordination primitive that
 * single-flight token refresh is built on.
 *
 * The lock lives here, rather than in a module-local `Map`, because production
 * runs more than one process. A lock that only holds within a process is not a
 * lock; it is a race that passes its tests.
 */
export interface SessionStore {
	read(id: SessionId): Promise<StoredSession | undefined>;
	write(session: StoredSession): Promise<void>;
	destroy(id: SessionId): Promise<void>;
	/** Removes every session belonging to a subject. Used on password change and on refresh-token reuse. */
	destroyForSubject(subject: string): Promise<number>;
	/**
	 * Acquires an exclusive lock, or resolves `undefined` if it is already held.
	 *
	 * `ttlMs` bounds the hold so a process dying mid-critical-section cannot
	 * wedge a session permanently.
	 */
	acquireLock(key: string, ttlMs: number): Promise<LockHandle | undefined>;
}

/** An opaque, high-entropy session identifier. */
export type SessionId = string & { readonly __brand: 'SessionId' };

/** A held lock. Release is idempotent and must not release a lock re-acquired by someone else. */
export interface LockHandle {
	readonly key: string;
	/** Fencing token, so a slow holder cannot release a successor's lock. */
	readonly token: string;
	release(): Promise<void>;
}

/** A session as persisted. Claims stay opaque here; the engine owns their shape. */
export interface StoredSession {
	readonly id: SessionId;
	/** The user this session authenticates. */
	readonly subject: string;
	readonly claims: Readonly<Record<string, unknown>>;
	/** Epoch millis the session was created. Absolute expiry is measured from here and cannot be extended. */
	readonly createdAt: number;
	/** Epoch millis of the last request. Idle expiry is measured from here. */
	readonly lastSeenAt: number;
	/** Epoch millis after which the session is dead regardless of activity. */
	readonly absoluteExpiresAt: number;
	/**
	 * Set when this session has been rotated away from. The old id stays valid
	 * until this instant so concurrent in-flight requests converge instead of
	 * clobbering each other.
	 */
	readonly supersededAt?: number;
	/** The session that replaced this one, for rotation-race convergence. */
	readonly supersededBy?: SessionId;
}

/**
 * Password hashing.
 *
 * `needsRehash` is part of the contract from the outset, not an afterthought.
 * Cost parameters must be raisable as hardware improves, and that is only
 * possible if a stored hash records the parameters it was produced with, so old
 * and new records coexist during migration.
 */
export interface PasswordHasher {
	hash(password: string): Promise<string>;
	/** Constant-time. Must not throw on a malformed stored hash — return `false`. */
	verify(password: string, storedHash: string): Promise<boolean>;
	/** True when `storedHash` was produced with parameters weaker than current policy. */
	needsRehash(storedHash: string): boolean;
}

/** Sign and verify stateless tokens. */
export interface TokenCodec {
	sign(payload: Readonly<Record<string, unknown>>): Promise<string>;
	/** Rejects on malformed input or signature mismatch; never throws. */
	verify(token: string): Promise<Readonly<Record<string, unknown>> | undefined>;
}

/** The outcome of consuming one unit of a rate-limit budget. */
export interface RateLimitVerdict {
	readonly allowed: boolean;
	/** Attempts remaining in the current window. */
	readonly remaining: number;
	/** Milliseconds until the budget refills enough to retry. Zero when allowed. */
	readonly retryAfterMs: number;
}

/**
 * Attempt accounting.
 *
 * Consumption is separate from reset so a successful sign-in can clear a
 * partially-spent budget, and budgets are keyed by caller-chosen scope so
 * per-identifier and per-IP limits stay independent. Sharing one budget would
 * let an attacker exhaust a victim's allowance and lock them out — turning a
 * brute-force control into a denial-of-service tool.
 */
export interface RateLimiter {
	consume(scope: string, key: string): Promise<RateLimitVerdict>;
	reset(scope: string, key: string): Promise<void>;
	/** Inspects without consuming. */
	peek(scope: string, key: string): Promise<RateLimitVerdict>;
}

/** A credential record, as returned by {@link UserStore}. */
export interface CredentialRecord {
	readonly subject: string;
	readonly identifier: string;
	readonly passwordHash: string;
	/** Epoch millis until which sign-in is refused, if the account is locked. */
	readonly lockedUntil?: number;
	/** Consecutive failed attempts since the last success. */
	readonly failedAttempts: number;
}

/**
 * User and credential lookup. Required only by the credentials provider.
 *
 * `findByIdentifier` returning `undefined` must not be observable in the
 * response: the provider performs a dummy verification so an unknown address
 * and a wrong password take the same time and produce the same error.
 */
export interface UserStore {
	findByIdentifier(identifier: string): Promise<CredentialRecord | undefined>;
	updatePasswordHash(subject: string, passwordHash: string): Promise<void>;
	recordFailedAttempt(subject: string, lockedUntil?: number): Promise<void>;
	clearFailedAttempts(subject: string): Promise<void>;
}

/** A password-reset capability as persisted. The raw bearer token is never stored. */
export interface PasswordResetRecord {
	/** Lowercase SHA-256 digest of the raw reset token. */
	readonly digest: string;
	readonly subject: string;
	/** Epoch millis. The record is invalid at and after this instant. */
	readonly expiresAt: number;
}

/**
 * Atomic persistence for password-reset capabilities.
 *
 * Replacement and consumption are named operations because composing them from
 * key-value `get` and `delete` calls is racy across replicas. Implementations
 * should use a transaction, compare-and-delete, or equivalent database
 * primitive; the conformance suite proves the externally visible contract.
 */
export interface PasswordResetStore {
	/** Atomically revokes any existing record for the subject and stores this one. */
	replace(record: PasswordResetRecord): Promise<void>;
	/** Reads a live record without consuming it. Expired records return undefined. */
	read(digest: string, now: number): Promise<PasswordResetRecord | undefined>;
	/** Atomically returns and removes one live record. Exactly one concurrent caller may win. */
	consume(
		digest: string,
		now: number
	): Promise<PasswordResetRecord | undefined>;
	/** Revokes the subject's current reset capability, if one exists. */
	revokeForSubject(subject: string): Promise<void>;
}
