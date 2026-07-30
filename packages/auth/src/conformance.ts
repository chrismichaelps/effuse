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
 * Executable conformance suites for the ports.
 *
 * A third-party `SessionStore` runs one function and finds out whether it is
 * correct. Without this, adapters diverge silently: each author implements to
 * their reading of the docs, the differences only surface under concurrency or
 * at expiry, and the bug reports land on the framework rather than the adapter.
 *
 * The properties covered here are deliberately the ones that are easy to get
 * subtly wrong and impossible to notice until production — exclusivity under
 * real concurrency, TTL actually expiring, fencing on release, and isolation of
 * stored values from later mutation by the caller.
 */

import type { RateLimiter, SessionId, SessionStore, StoredSession } from './contract.js';

/** The minimal test-runner surface a suite needs. Satisfied by vitest, jest, and node:test. */
export interface ConformanceHarness {
	// Declared as properties holding functions rather than methods, so callers
	// can destructure them off a runner's exports without `this` binding.
	readonly describe: (name: string, body: () => void) => void;
	readonly it: (name: string, body: () => Promise<void> | void) => void;
	readonly expect: (value: unknown) => {
		readonly toBe: (expected: unknown) => void;
		readonly toEqual: (expected: unknown) => void;
		readonly toBeUndefined: () => void;
		readonly toBeDefined: () => void;
	};
}

export interface SessionStoreConformanceOptions {
	readonly harness: ConformanceHarness;
	/** Produces a fresh, empty store for each test. */
	readonly createStore: () => SessionStore | Promise<SessionStore>;
	/**
	 * Advances the implementation's notion of time.
	 *
	 * Omit when the implementation is driven by a real clock; the TTL tests are
	 * then skipped rather than made slow or flaky.
	 */
	readonly advanceTime?: (ms: number) => void | Promise<void>;
}

const session = (
	id: string,
	subject: string,
	overrides: Partial<StoredSession> = {}
): StoredSession => ({
	id: id as SessionId,
	subject,
	claims: { role: 'member' },
	createdAt: 1_700_000_000_000,
	lastSeenAt: 1_700_000_000_000,
	absoluteExpiresAt: 1_700_000_000_000 + 3_600_000,
	...overrides,
});

/**
 * Runs the {@link SessionStore} conformance suite.
 *
 * ```ts
 * runSessionStoreConformance({
 *   harness: { describe, it, expect },
 *   createStore: () => createRedisSessionStore(client),
 * });
 * ```
 */
export const runSessionStoreConformance = (
	options: SessionStoreConformanceOptions
): void => {
	const { harness, createStore, advanceTime } = options;
	const { describe, it, expect } = harness;

	describe('SessionStore conformance', () => {
		describe('read and write', () => {
			it('reads back what was written', async () => {
				const store = await createStore();
				await store.write(session('s1', 'u1'));

				const found = await store.read('s1' as SessionId);
				expect(found?.subject).toBe('u1');
			});

			it('returns undefined for an unknown id rather than throwing', async () => {
				const store = await createStore();
				expect(await store.read('nope' as SessionId)).toBeUndefined();
			});

			it('overwrites an existing record rather than merging into it', async () => {
				// A merge would let a stale `supersededAt` survive a rotation and
				// revoke a session that is in fact current.
				const store = await createStore();
				await store.write(session('s1', 'u1', { supersededAt: 123 }));
				await store.write(session('s1', 'u1'));

				expect((await store.read('s1' as SessionId))?.supersededAt).toBeUndefined();
			});

			it('isolates stored values from later mutation by the caller', async () => {
				// Any remote backend serialises, so mutating an object after storing
				// it cannot affect the store. An in-process implementation that shares
				// the reference would behave differently from every real one, and code
				// written against it would break on deployment.
				const store = await createStore();
				const original = session('s1', 'u1');
				await store.write(original);

				(original.claims as Record<string, unknown>)['role'] = 'admin';

				expect((await store.read('s1' as SessionId))?.claims).toEqual({
					role: 'member',
				});
			});
		});

		describe('destroy', () => {
			it('removes a session', async () => {
				const store = await createStore();
				await store.write(session('s1', 'u1'));
				await store.destroy('s1' as SessionId);

				expect(await store.read('s1' as SessionId)).toBeUndefined();
			});

			it('is idempotent for an unknown id', async () => {
				const store = await createStore();
				await store.destroy('nope' as SessionId);
			});

			it('removes every session for a subject and reports the count', async () => {
				const store = await createStore();
				await store.write(session('s1', 'u1'));
				await store.write(session('s2', 'u1'));
				await store.write(session('s3', 'u2'));

				expect(await store.destroyForSubject('u1')).toBe(2);
				expect(await store.read('s1' as SessionId)).toBeUndefined();
				expect(await store.read('s2' as SessionId)).toBeUndefined();
			});

			it('leaves other subjects untouched', async () => {
				const store = await createStore();
				await store.write(session('s1', 'u1'));
				await store.write(session('s3', 'u2'));

				await store.destroyForSubject('u1');

				expect(await store.read('s3' as SessionId)).toBeDefined();
			});

			it('reports zero for a subject with no sessions', async () => {
				const store = await createStore();
				expect(await store.destroyForSubject('nobody')).toBe(0);
			});
		});

		describe('locking', () => {
			it('grants a lock that is not currently held', async () => {
				const store = await createStore();
				expect(await store.acquireLock('k', 1000)).toBeDefined();
			});

			it('refuses a lock that is already held', async () => {
				const store = await createStore();
				await store.acquireLock('k', 1000);

				expect(await store.acquireLock('k', 1000)).toBeUndefined();
			});

			it('grants the lock again after release', async () => {
				const store = await createStore();
				const held = await store.acquireLock('k', 1000);
				await held?.release();

				expect(await store.acquireLock('k', 1000)).toBeDefined();
			});

			it('keeps locks on different keys independent', async () => {
				const store = await createStore();
				await store.acquireLock('a', 1000);

				expect(await store.acquireLock('b', 1000)).toBeDefined();
			});

			it('grants the lock to exactly one of many concurrent callers', async () => {
				// Real concurrency, not a mocked sequence. This is the property
				// single-flight token refresh rests on: if two callers can hold the
				// lock at once, both hit the identity provider, one refresh token is
				// invalidated, and the user is signed out for no visible reason.
				const store = await createStore();

				const results = await Promise.all(
					Array.from({ length: 10 }, async () => store.acquireLock('k', 1000))
				);

				expect(results.filter((handle) => handle !== undefined).length).toBe(1);
			});

			it('does not release a lock re-acquired by someone else', async () => {
				// Fencing. Without it, a slow holder whose TTL lapsed releases its
				// successor's lock, and two callers proceed into the critical section
				// believing they hold it exclusively.
				if (advanceTime === undefined) return;

				const store = await createStore();
				const first = await store.acquireLock('k', 1000);

				await advanceTime(1001);
				const second = await store.acquireLock('k', 1000);
				expect(second).toBeDefined();

				await first?.release();

				// The successor still holds it, so a third attempt must fail.
				expect(await store.acquireLock('k', 1000)).toBeUndefined();
			});

			it('frees a lock whose ttl elapsed', async () => {
				if (advanceTime === undefined) return;

				const store = await createStore();
				await store.acquireLock('k', 1000);

				await advanceTime(1001);

				expect(await store.acquireLock('k', 1000)).toBeDefined();
			});
		});
	});
};

export interface RateLimiterConformanceOptions {
	readonly harness: ConformanceHarness;
	/** Produces a limiter permitting `limit` attempts per `windowMs`. */
	readonly createLimiter: (options: {
		readonly limit: number;
		readonly windowMs: number;
	}) => RateLimiter | Promise<RateLimiter>;
	readonly advanceTime?: (ms: number) => void | Promise<void>;
}

/** Runs the {@link RateLimiter} conformance suite. */
export const runRateLimiterConformance = (
	options: RateLimiterConformanceOptions
): void => {
	const { harness, createLimiter, advanceTime } = options;
	const { describe, it, expect } = harness;

	describe('RateLimiter conformance', () => {
		it('allows attempts up to the limit', async () => {
			const limiter = await createLimiter({ limit: 3, windowMs: 60_000 });

			for (let i = 0; i < 3; i += 1) {
				expect((await limiter.consume('scope', 'key')).allowed).toBe(true);
			}
		});

		it('refuses the attempt past the limit', async () => {
			const limiter = await createLimiter({ limit: 3, windowMs: 60_000 });

			for (let i = 0; i < 3; i += 1) await limiter.consume('scope', 'key');

			expect((await limiter.consume('scope', 'key')).allowed).toBe(false);
		});

		it('reports a positive retry budget once exhausted', async () => {
			// The transport turns this into `Retry-After`. A zero or missing value
			// leaves a well-behaved client hot-looping against the endpoint the
			// limiter exists to protect.
			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.consume('scope', 'key');

			const verdict = await limiter.consume('scope', 'key');
			expect(verdict.allowed).toBe(false);
			expect(verdict.retryAfterMs > 0).toBe(true);
		});

		it('keeps budgets independent across scopes', async () => {
			// The property that stops an attacker exhausting a victim's per-identifier
			// budget through a per-IP one, or the reverse.
			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.consume('scope-a', 'key');

			expect((await limiter.consume('scope-b', 'key')).allowed).toBe(true);
		});

		it('keeps budgets independent across keys within a scope', async () => {
			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.consume('scope', 'key-a');

			expect((await limiter.consume('scope', 'key-b')).allowed).toBe(true);
		});

		it('does not consume on peek', async () => {
			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.peek('scope', 'key');
			await limiter.peek('scope', 'key');

			expect((await limiter.consume('scope', 'key')).allowed).toBe(true);
		});

		it('restores the budget on reset', async () => {
			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.consume('scope', 'key');
			await limiter.reset('scope', 'key');

			expect((await limiter.consume('scope', 'key')).allowed).toBe(true);
		});

		it('restores the budget once the window elapses', async () => {
			if (advanceTime === undefined) return;

			const limiter = await createLimiter({ limit: 1, windowMs: 60_000 });
			await limiter.consume('scope', 'key');

			await advanceTime(60_001);

			expect((await limiter.consume('scope', 'key')).allowed).toBe(true);
		});
	});
};
