import { beforeEach, describe, expect, it } from 'vitest';
import { createCredentialsProvider } from '../server/credentials.js';
import { createScryptHasher } from '../server/password-hasher.js';
import {
	createMemoryRateLimiter,
	createMemoryUserStore,
	createTestClock,
	type MemoryUserStore,
	type TestClock,
} from '../testing/index.js';
import type { PasswordHasher, RateLimiter } from '../contract.js';

const fastHasher = createScryptHasher({
	cost: 2 ** 12,
	blockSize: 8,
	parallelism: 1,
});

const LOCK_THRESHOLD = 5;
const LOCK_DURATION = 15 * 60_000;

interface Harness {
	readonly clock: TestClock;
	readonly users: MemoryUserStore;
	readonly limiter: RateLimiter;
	readonly provider: ReturnType<typeof createCredentialsProvider>;
}

const harness = (hasher: PasswordHasher = fastHasher): Harness => {
	const clock = createTestClock();
	const users = createMemoryUserStore();
	const limiter = createMemoryRateLimiter(
		{ limit: 20, windowMs: 60_000 },
		clock
	);

	const provider = createCredentialsProvider({
		users,
		hasher,
		limiter,
		clock,
		lockoutThreshold: LOCK_THRESHOLD,
		lockoutDurationMs: LOCK_DURATION,
	});

	return { clock, users, limiter, provider };
};

const seed = async (
	users: MemoryUserStore,
	hasher: PasswordHasher = fastHasher
): Promise<void> => {
	users.seed({
		subject: 'u_1',
		identifier: 'real@example.com',
		passwordHash: await hasher.hash('correct-password'),
		failedAttempts: 0,
	});
};

describe('authenticate', () => {
	let h: Harness;

	beforeEach(async () => {
		h = harness();
		await seed(h.users);
	});

	it('accepts the correct password and returns the subject', async () => {
		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.subject).toBe('u_1');
	});

	it('matches the identifier case-insensitively', async () => {
		// Otherwise `Real@example.com` is a different account with its own lockout
		// budget, and an attacker sidesteps lockout just by varying the case.
		const result = await h.provider.authenticate({
			identifier: 'REAL@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
	});

	it('rejects the wrong password', async () => {
		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('InvalidCredentialsError');
	});

	it('clears the failure count after a success', async () => {
		for (let i = 0; i < 3; i += 1) {
			await h.provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}
		expect(h.users.get('u_1')?.failedAttempts).toBe(3);

		await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(h.users.get('u_1')?.failedAttempts).toBe(0);
	});
});

describe('user enumeration', () => {
	let h: Harness;

	beforeEach(async () => {
		h = harness();
		await seed(h.users);
	});

	it('returns an identical error for an unknown address and a wrong password', async () => {
		const unknown = await h.provider.authenticate({
			identifier: 'nobody@example.com',
			password: 'whatever',
			clientIp: '203.0.113.1',
		});
		const wrong = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.2',
		});

		expect(unknown.ok).toBe(false);
		expect(wrong.ok).toBe(false);
		if (unknown.ok || wrong.ok) return;

		expect(unknown.error._tag).toBe(wrong.error._tag);
		expect(unknown.error.safeMessage).toBe(wrong.error.safeMessage);
	});

	it('performs a dummy verification for an unknown address', async () => {
		// Returning early on an unknown user is the classic enumeration leak: the
		// miss returns in microseconds while a real account pays for a hash, and
		// the difference is trivially measurable over a handful of requests.
		let hashCalls = 0;
		const counting: PasswordHasher = {
			hash: (password) => fastHasher.hash(password),
			verify: (password, stored) => {
				hashCalls += 1;
				return fastHasher.verify(password, stored);
			},
			needsRehash: (stored) => fastHasher.needsRehash(stored),
		};

		const instrumented = harness(counting);
		await seed(instrumented.users, counting);

		await instrumented.provider.authenticate({
			identifier: 'nobody@example.com',
			password: 'whatever',
			clientIp: '203.0.113.1',
		});

		expect(hashCalls).toBe(1);
	});

	it('takes a comparable amount of time for both paths', async () => {
		// Statistical rather than a single sample: one measurement on a shared CI
		// runner proves nothing either way.
		const measure = async (identifier: string): Promise<number> => {
			const started = process.hrtime.bigint();
			for (let i = 0; i < 6; i += 1) {
				await h.provider.authenticate({
					identifier,
					password: 'wrong-password',
					clientIp: `198.51.100.${String(i)}`,
				});
			}
			return Number(process.hrtime.bigint() - started);
		};

		const unknown = await measure('nobody@example.com');
		const known = await measure('real@example.com');

		const ratio = Math.max(unknown, known) / Math.min(unknown, known);
		// A genuine early return shows up as an order of magnitude, not 3x.
		expect(ratio).toBeLessThan(3);
	});
});

describe('brute force', () => {
	let h: Harness;

	beforeEach(async () => {
		h = harness();
		await seed(h.users);
	});

	it('locks the account after the configured number of failures', async () => {
		for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
			await h.provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('AccountLockedError');
	});

	it('reports how long the lock has left', async () => {
		for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
			await h.provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (result.ok || result.error._tag !== 'AccountLockedError') return;
		expect(result.error.retryAfterMs).toBeGreaterThan(0);
		expect(result.error.retryAfterMs).toBeLessThanOrEqual(LOCK_DURATION);
	});

	it('lifts the lock once its duration elapses', async () => {
		for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
			await h.provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		h.clock.advance(LOCK_DURATION + 1);

		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
	});

	it('keeps per-identifier and per-IP budgets independent', async () => {
		// Sharing one budget turns a brute-force control into a denial-of-service
		// tool: an attacker spends the victim's allowance from anywhere and locks
		// them out without ever guessing a password.
		const limiter = createMemoryRateLimiter(
			{ limit: 3, windowMs: 60_000 },
			h.clock
		);
		const provider = createCredentialsProvider({
			users: h.users,
			hasher: fastHasher,
			limiter,
			clock: h.clock,
			lockoutThreshold: 100,
			lockoutDurationMs: LOCK_DURATION,
		});

		// Exhaust one IP's budget entirely.
		for (let i = 0; i < 5; i += 1) {
			await provider.authenticate({
				identifier: `probe${String(i)}@example.com`,
				password: 'wrong',
				clientIp: '203.0.113.99',
			});
		}

		const fromExhaustedIp = await provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.99',
		});
		expect(fromExhaustedIp.ok).toBe(false);

		// The victim, from their own address, is unaffected.
		const fromCleanIp = await provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '198.51.100.7',
		});
		expect(fromCleanIp.ok).toBe(true);
	});

	it('reports a rate-limit failure with a retry budget', async () => {
		const limiter = createMemoryRateLimiter(
			{ limit: 2, windowMs: 60_000 },
			h.clock
		);
		const provider = createCredentialsProvider({
			users: h.users,
			hasher: fastHasher,
			limiter,
			clock: h.clock,
			lockoutThreshold: 100,
			lockoutDurationMs: LOCK_DURATION,
		});

		for (let i = 0; i < 3; i += 1) {
			await provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		const result = await provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (result.ok || result.error._tag !== 'RateLimitedError') {
			expect.unreachable('expected a RateLimitedError');
			return;
		}
		expect(result.error.retryAfterMs).toBeGreaterThan(0);
	});
});

describe('transparent rehash', () => {
	it('upgrades a weak stored hash on the next successful sign-in', async () => {
		// The whole reason `needsRehash` is in the port: raising cost must not
		// require a migration or a forced password reset.
		const weak = createScryptHasher({
			cost: 2 ** 12,
			blockSize: 8,
			parallelism: 1,
		});
		const strong = createScryptHasher({
			cost: 2 ** 14,
			blockSize: 8,
			parallelism: 1,
		});

		const h = harness(strong);
		h.users.seed({
			subject: 'u_1',
			identifier: 'real@example.com',
			passwordHash: await weak.hash('correct-password'),
			failedAttempts: 0,
		});

		const before = h.users.get('u_1')?.passwordHash;

		const result = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
		const after = h.users.get('u_1')?.passwordHash;
		expect(after).not.toBe(before);
		expect(strong.needsRehash(after ?? '')).toBe(false);
		// The upgraded hash must still verify the same password.
		await expect(strong.verify('correct-password', after ?? '')).resolves.toBe(
			true
		);
	});

	it('does not rehash after a failed sign-in', async () => {
		const weak = createScryptHasher({
			cost: 2 ** 12,
			blockSize: 8,
			parallelism: 1,
		});
		const strong = createScryptHasher({
			cost: 2 ** 14,
			blockSize: 8,
			parallelism: 1,
		});

		const h = harness(strong);
		h.users.seed({
			subject: 'u_1',
			identifier: 'real@example.com',
			passwordHash: await weak.hash('correct-password'),
			failedAttempts: 0,
		});

		const before = h.users.get('u_1')?.passwordHash;
		await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.1',
		});

		expect(h.users.get('u_1')?.passwordHash).toBe(before);
	});
});

describe('password policy', () => {
	it('rejects a password that fails the configured policy', async () => {
		const h = harness();
		const result = await h.provider.changePassword({
			subject: 'u_1',
			newPassword: 'short',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('PasswordPolicyError');
			expect(result.error.safeMessage).toBe(
				'Password must be at least 12 characters.'
			);
		}
	});

	it('accepts a password that satisfies the policy and stores it hashed', async () => {
		const h = harness();
		await seed(h.users);

		const result = await h.provider.changePassword({
			subject: 'u_1',
			newPassword: 'a-perfectly-reasonable-passphrase',
		});

		expect(result.ok).toBe(true);
		const stored = h.users.get('u_1')?.passwordHash ?? '';
		expect(stored).not.toContain('a-perfectly-reasonable-passphrase');
		await expect(
			fastHasher.verify('a-perfectly-reasonable-passphrase', stored)
		).resolves.toBe(true);
	});

	it('clears lockout state on a password change', async () => {
		// The user has demonstrably regained control, so keeping them locked out
		// only punishes the victim of the brute-force attempt.
		const h = harness();
		await seed(h.users);

		for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
			await h.provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		await h.provider.changePassword({
			subject: 'u_1',
			newPassword: 'a-perfectly-reasonable-passphrase',
		});

		expect(h.users.get('u_1')?.failedAttempts).toBe(0);
		expect(h.users.get('u_1')?.lockedUntil).toBeUndefined();
	});
});
