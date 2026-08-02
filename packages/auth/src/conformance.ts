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

import type {
	CredentialRecord,
	PasswordHasher,
	RateLimiter,
	SessionId,
	SessionStore,
	StoredSession,
	TokenCodec,
	UserStore,
} from './contract.js';

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

export interface PasswordHasherConformanceOptions {
	readonly harness: ConformanceHarness;
	readonly createHasher: () => PasswordHasher | Promise<PasswordHasher>;
	/**
	 * A hasher configured with deliberately weaker parameters.
	 *
	 * Supply it to exercise `needsRehash`; omit it and those cases are skipped
	 * rather than asserted vacuously.
	 */
	readonly createWeakerHasher?: () => PasswordHasher | Promise<PasswordHasher>;
}

/**
 * Runs the {@link PasswordHasher} conformance suite.
 *
 * The properties covered are the ones whose absence is invisible until a breach:
 * a missing salt looks identical to a present one until the table is stolen, and
 * a `verify` that throws on a foreign row looks fine until a migration leaves one
 * behind.
 */
export const runPasswordHasherConformance = (
	options: PasswordHasherConformanceOptions
): void => {
	const { harness, createHasher, createWeakerHasher } = options;
	const { describe, it, expect } = harness;

	describe('PasswordHasher conformance', () => {
		it('verifies a password against its own hash', async () => {
			const hasher = await createHasher();
			const stored = await hasher.hash('correct horse battery staple');

			expect(await hasher.verify('correct horse battery staple', stored)).toBe(true);
		});

		it('rejects a wrong password', async () => {
			const hasher = await createHasher();
			const stored = await hasher.hash('correct horse battery staple');

			expect(await hasher.verify('wrong', stored)).toBe(false);
		});

		it('salts, so identical passwords do not produce identical hashes', async () => {
			// Without a per-hash salt a stolen table reveals which accounts share a
			// password, and one precomputed dictionary cracks all of them at once.
			const hasher = await createHasher();

			const first = await hasher.hash('same');
			const second = await hasher.hash('same');

			expect(first === second).toBe(false);
		});

		it('handles an empty password', async () => {
			const hasher = await createHasher();
			const stored = await hasher.hash('');

			expect(await hasher.verify('', stored)).toBe(true);
			expect(await hasher.verify('x', stored)).toBe(false);
		});

		it('handles unicode without normalising it', async () => {
			// Silently normalising would let a visually identical password unlock an
			// account created with the other encoding.
			const hasher = await createHasher();
			const composed = 'caf\u00e9';
			const decomposed = 'cafe\u0301';

			const stored = await hasher.hash(composed);

			expect(await hasher.verify(composed, stored)).toBe(true);
			expect(await hasher.verify(decomposed, stored)).toBe(false);
		});

		it('returns false rather than throwing on a foreign or corrupt hash', async () => {
			// A bad row must fail one sign-in, not take the endpoint down for
			// everybody.
			const hasher = await createHasher();

			for (const bad of [
				'',
				'not-a-hash',
				'$2b$10$abcdefghijklmnopqrstuv',
				'$argon2id$v=19$m=65536,t=3,p=4$abc$def',
				'\u0000',
			]) {
				expect(await hasher.verify('pw', bad)).toBe(false);
			}
		});

		it('flags an unparseable hash for rehashing', async () => {
			// Otherwise a foreign or broken hash is frozen in place forever.
			const hasher = await createHasher();

			expect(hasher.needsRehash('not-a-hash')).toBe(true);
			expect(hasher.needsRehash('')).toBe(true);
		});

		it('does not flag a hash it just produced', async () => {
			const hasher = await createHasher();

			expect(hasher.needsRehash(await hasher.hash('pw'))).toBe(false);
		});

		it('flags a hash produced with weaker parameters', async () => {
			if (createWeakerHasher === undefined) return;

			const strong = await createHasher();
			const weak = await createWeakerHasher();

			expect(strong.needsRehash(await weak.hash('pw'))).toBe(true);
		});

		it('still verifies a hash produced with weaker parameters', async () => {
			// The whole point of recording parameters alongside the hash: old and new
			// must coexist while records upgrade opportunistically.
			if (createWeakerHasher === undefined) return;

			const strong = await createHasher();
			const weak = await createWeakerHasher();

			expect(await strong.verify('pw', await weak.hash('pw'))).toBe(true);
		});
	});
};

export interface TokenCodecConformanceOptions {
	readonly harness: ConformanceHarness;
	readonly createCodec: () => TokenCodec | Promise<TokenCodec>;
	/** A codec with entirely different secrets, for forgery cases. */
	readonly createForeignCodec?: () => TokenCodec | Promise<TokenCodec>;
}

/** Runs the {@link TokenCodec} conformance suite. */
export const runTokenCodecConformance = (
	options: TokenCodecConformanceOptions
): void => {
	const { harness, createCodec, createForeignCodec } = options;
	const { describe, it, expect } = harness;

	describe('TokenCodec conformance', () => {
		it('round-trips a payload', async () => {
			const codec = await createCodec();
			const token = await codec.sign({ sub: 'u_1', role: 'admin' });

			expect(await codec.verify(token)).toEqual({ sub: 'u_1', role: 'admin' });
		});

		it('produces different tokens for different payloads', async () => {
			const codec = await createCodec();

			expect(
				(await codec.sign({ sub: 'u_1' })) === (await codec.sign({ sub: 'u_2' }))
			).toBe(false);
		});

		it('rejects a token whose payload was edited', async () => {
			const codec = await createCodec();
			const token = await codec.sign({ sub: 'u_1' });

			// Flip one character in the payload half.
			const separator = token.indexOf('.');
			const first = token[0] === 'A' ? 'B' : 'A';
			const tampered = `${first}${token.slice(1, separator)}${token.slice(separator)}`;

			expect(await codec.verify(tampered)).toBeUndefined();
		});

		it('rejects a token signed by a foreign codec', async () => {
			if (createForeignCodec === undefined) return;

			const mine = await createCodec();
			const attacker = await createForeignCodec();

			expect(await mine.verify(await attacker.sign({ sub: 'u_1' }))).toBeUndefined();
		});

		it('returns undefined rather than throwing on malformed input', async () => {
			// This runs on every request against fully attacker-controlled input; a
			// throw is an unhandled 500 and a one-line denial of service.
			const codec = await createCodec();

			for (const bad of ['', '.', '..', 'not-a-token', 'a.b.c.d', '%%%', '\u0000']) {
				expect(await codec.verify(bad)).toBeUndefined();
			}
		});

		it('rejects a truncated token at every length', async () => {
			const codec = await createCodec();
			const token = await codec.sign({ sub: 'u_1' });

			for (let length = 0; length < token.length; length += 1) {
				expect(await codec.verify(token.slice(0, length))).toBeUndefined();
			}
		});
	});
};

export interface UserStoreConformanceOptions {
	readonly harness: ConformanceHarness;
	/** Produces an empty store plus a way to seed it. */
	readonly createStore: () => {
		readonly store: UserStore;
		readonly seed: (record: CredentialRecord) => void | Promise<void>;
		readonly read: (subject: string) => CredentialRecord | undefined | Promise<CredentialRecord | undefined>;
	};
}

/** Runs the {@link UserStore} conformance suite. */
export const runUserStoreConformance = (
	options: UserStoreConformanceOptions
): void => {
	const { harness, createStore } = options;
	const { describe, it, expect } = harness;

	const record = (overrides: Partial<CredentialRecord> = {}): CredentialRecord => ({
		subject: 'u_1',
		identifier: 'ada@example.com',
		passwordHash: 'stored-hash',
		failedAttempts: 0,
		...overrides,
	});

	describe('UserStore conformance', () => {
		it('finds a seeded record by identifier', async () => {
			const { store, seed } = createStore();
			await seed(record());

			expect((await store.findByIdentifier('ada@example.com'))?.subject).toBe('u_1');
		});

		it('returns undefined for an unknown identifier', async () => {
			const { store } = createStore();

			expect(await store.findByIdentifier('nobody@example.com')).toBeUndefined();
		});

		it('matches identifiers case-insensitively', async () => {
			// Otherwise `A@example.com` is a separate account with its own lockout
			// budget, and an attacker sidesteps lockout by varying the case.
			const { store, seed } = createStore();
			await seed(record());

			expect((await store.findByIdentifier('ADA@EXAMPLE.COM'))?.subject).toBe('u_1');
		});

		it('updates the password hash', async () => {
			const { store, seed, read } = createStore();
			await seed(record());

			await store.updatePasswordHash('u_1', 'new-hash');

			expect((await read('u_1'))?.passwordHash).toBe('new-hash');
		});

		it('increments the failure count', async () => {
			const { store, seed, read } = createStore();
			await seed(record());

			await store.recordFailedAttempt('u_1');
			await store.recordFailedAttempt('u_1');

			expect((await read('u_1'))?.failedAttempts).toBe(2);
		});

		it('records a lock instant when one is supplied', async () => {
			const { store, seed, read } = createStore();
			await seed(record());

			await store.recordFailedAttempt('u_1', 1_700_000_060_000);

			expect((await read('u_1'))?.lockedUntil).toBe(1_700_000_060_000);
		});

		it('clears both the count and the lock', async () => {
			// A lock left behind after a successful sign-in punishes the victim of
			// the attempt that set it.
			const { store, seed, read } = createStore();
			await seed(record({ failedAttempts: 5, lockedUntil: 1_700_000_060_000 }));

			await store.clearFailedAttempts('u_1');

			const after = await read('u_1');
			expect(after?.failedAttempts).toBe(0);
			expect(after?.lockedUntil).toBeUndefined();
		});

		it('ignores writes for an unknown subject without throwing', async () => {
			const { store } = createStore();

			await store.updatePasswordHash('nobody', 'x');
			await store.recordFailedAttempt('nobody');
			await store.clearFailedAttempts('nobody');
		});
	});
};
