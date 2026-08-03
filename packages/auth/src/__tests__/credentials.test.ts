import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCredentialsProvider,
	defaultPasswordPolicy,
} from '../server/credentials.js';
import { createScryptHasher } from '../server/password-hasher.js';
import {
	createMemoryRateLimiter,
	createMemorySessionStore,
	createMemoryUserStore,
	createTestClock,
	type MemoryUserStore,
	type TestClock,
} from '../testing/index.js';
import type {
	PasswordHasher,
	RateLimiter,
	SessionStore,
	StoredSession,
} from '../contract.js';

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
	readonly sessions: SessionStore;
	readonly passwordChanged: ReturnType<typeof vi.fn>;
	readonly provider: ReturnType<typeof createCredentialsProvider>;
}

const harness = (hasher: PasswordHasher = fastHasher, limit = 20): Harness => {
	const clock = createTestClock();
	const users = createMemoryUserStore();
	const sessions = createMemorySessionStore(clock);
	const passwordChanged = vi.fn();
	const limiter = createMemoryRateLimiter({ limit, windowMs: 60_000 }, clock);

	const provider = createCredentialsProvider({
		users,
		hasher,
		limiter,
		clock,
		lockoutThreshold: LOCK_THRESHOLD,
		lockoutDurationMs: LOCK_DURATION,
		revokeSessions: (subject) => sessions.destroyForSubject(subject),
		onPasswordChanged: passwordChanged,
	});

	return { clock, users, limiter, sessions, passwordChanged, provider };
};

const session = (id: string, subject = 'u_1'): StoredSession => ({
	id: id as StoredSession['id'],
	subject,
	claims: { role: 'member' },
	createdAt: 1_700_000_000_000,
	lastSeenAt: 1_700_000_000_000,
	absoluteExpiresAt: 1_700_003_600_000,
});

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

	it('uses a stable dummy secret and keeps diagnostic detail internal', async () => {
		const hash = vi.fn(fastHasher.hash);
		const observed: PasswordHasher = { ...fastHasher, hash };
		const h = harness(observed);
		await seed(h.users);

		const unknown = await h.provider.authenticate({
			identifier: ' Nobody@Example.com ',
			password: 'wrong',
			clientIp: '203.0.113.1',
		});
		const wrong = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.2',
		});

		expect(hash).toHaveBeenCalledWith('effuse-dummy-verification-password');
		expect(unknown.ok).toBe(false);
		expect(wrong.ok).toBe(false);
		if (!unknown.ok && !wrong.ok) {
			expect(unknown.error.detail).toBe(
				'No credential record for "nobody@example.com".'
			);
			expect(wrong.error.detail).toBe('Password mismatch for subject u_1.');
		}
	});

	it('passes a trimmed lowercase identifier to the user-store port', async () => {
		const h = harness();
		const find = vi.spyOn(h.users, 'findByIdentifier');
		await seed(h.users);

		await h.provider.authenticate({
			identifier: ' REAL@EXAMPLE.COM ',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(find).toHaveBeenCalledWith('real@example.com');
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
			revokeSessions: (subject) => h.sessions.destroyForSubject(subject),
			onPasswordChanged: h.passwordChanged,
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
			revokeSessions: (subject) => h.sessions.destroyForSubject(subject),
			onPasswordChanged: h.passwordChanged,
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

	it('reports the exact exhausted sign-in budget', async () => {
		const byIdentifier = harness(fastHasher, 1);
		await seed(byIdentifier.users);
		await byIdentifier.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.1',
		});
		const subjectResult = await byIdentifier.provider.authenticate({
			identifier: 'real@example.com',
			password: 'wrong',
			clientIp: '203.0.113.2',
		});
		expect(subjectResult.ok).toBe(false);
		if (!subjectResult.ok && subjectResult.error._tag === 'RateLimitedError') {
			expect(subjectResult.error.scope).toBe('credentials:identifier');
			expect(subjectResult.error.retryAfterMs).toBe(60_000);
		}

		const byIp = harness(fastHasher, 1);
		await byIp.provider.authenticate({
			identifier: 'one@example.com',
			password: 'wrong',
			clientIp: '203.0.113.9',
		});
		const ipResult = await byIp.provider.authenticate({
			identifier: 'two@example.com',
			password: 'wrong',
			clientIp: '203.0.113.9',
		});
		expect(ipResult.ok).toBe(false);
		if (!ipResult.ok && ipResult.error._tag === 'RateLimitedError') {
			expect(ipResult.error.scope).toBe('credentials:ip');
			expect(ipResult.error.retryAfterMs).toBe(60_000);
		}
	});

	it('treats the exact lock expiry as usable and the instant before as locked', async () => {
		const h = harness();
		await seed(h.users);
		const record = h.users.get('u_1');
		if (record === undefined) throw new Error('missing fixture');
		h.users.seed({ ...record, lockedUntil: h.clock.now() + 1 });

		const locked = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});
		expect(locked.ok).toBe(false);
		if (!locked.ok && locked.error._tag === 'AccountLockedError') {
			expect(locked.error.retryAfterMs).toBe(1);
			expect(locked.error.detail).toBe('Subject u_1 is locked.');
		}

		h.clock.advance(1);
		const boundary = await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.2',
		});
		expect(boundary.ok).toBe(true);
	});

	it('uses the 15-minute default lock duration', async () => {
		const clock = createTestClock();
		const users = createMemoryUserStore();
		await seed(users);
		const sessions = createMemorySessionStore(clock);
		const provider = createCredentialsProvider({
			users,
			hasher: fastHasher,
			limiter: createMemoryRateLimiter({ limit: 100, windowMs: 60_000 }, clock),
			clock,
			revokeSessions: (subject) => sessions.destroyForSubject(subject),
			onPasswordChanged: () => undefined,
		});

		for (let attempt = 0; attempt < 10; attempt += 1) {
			await provider.authenticate({
				identifier: 'real@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}
		expect(users.get('u_1')?.lockedUntil).toBe(clock.now() + 15 * 60_000);
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

	it('does not hash again when a successful credential is current', async () => {
		const hash = vi.fn(fastHasher.hash);
		const observed: PasswordHasher = { ...fastHasher, hash };
		const h = harness(observed);
		await seed(h.users);

		await h.provider.authenticate({
			identifier: 'real@example.com',
			password: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(hash).not.toHaveBeenCalled();
	});
});

describe('server-side password change', () => {
	it('defines exact inclusive password-length boundaries', () => {
		expect(defaultPasswordPolicy('x'.repeat(11))).toBe(
			'Password must be at least 12 characters.'
		);
		expect(defaultPasswordPolicy('x'.repeat(12))).toBeUndefined();
		expect(defaultPasswordPolicy('x'.repeat(256))).toBeUndefined();
		expect(defaultPasswordPolicy('x'.repeat(257))).toBe(
			'Password must be at most 256 characters.'
		);
	});

	it('does dummy verification for an unknown subject', async () => {
		const verify = vi.fn(fastHasher.verify);
		const h = harness({ ...fastHasher, verify });
		const result = await h.provider.changePassword({
			subject: 'missing',
			currentPassword: 'submitted-current-password',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('InvalidCredentialsError');
			expect(result.error.detail).toBe(
				'No credential record for subject missing.'
			);
		}
		expect(verify).toHaveBeenCalledOnce();
	});

	it('honors account lockout and its exact expiry boundary', async () => {
		const h = harness();
		await seed(h.users);
		const record = h.users.get('u_1');
		if (record === undefined) throw new Error('missing fixture');
		h.users.seed({ ...record, lockedUntil: h.clock.now() + 1 });

		const locked = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.1',
		});
		expect(locked.ok).toBe(false);
		if (!locked.ok && locked.error._tag === 'AccountLockedError') {
			expect(locked.error.retryAfterMs).toBe(1);
			expect(locked.error.detail).toBe('Subject u_1 is locked.');
		}

		h.clock.advance(1);
		const boundary = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(boundary.ok).toBe(true);
	});

	it('locks at the configured failed-reauthentication threshold', async () => {
		const h = harness();
		await seed(h.users);

		for (let attempt = 1; attempt <= LOCK_THRESHOLD; attempt += 1) {
			const result = await h.provider.changePassword({
				subject: 'u_1',
				currentPassword: 'wrong',
				newPassword: 'replacement-password',
				clientIp: `203.0.113.${String(attempt)}`,
			});
			expect(result.ok).toBe(false);
		}

		expect(h.users.get('u_1')?.failedAttempts).toBe(LOCK_THRESHOLD);
		expect(h.users.get('u_1')?.lockedUntil).toBe(h.clock.now() + LOCK_DURATION);
	});

	it('requires the current password before evaluating the new password', async () => {
		const h = harness();
		await seed(h.users);
		const result = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'wrong-password',
			newPassword: 'short',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('InvalidCredentialsError');
			expect(result.error.detail).toBe(
				'Password-change reauthentication failed for subject u_1.'
			);
		}
		expect(h.users.get('u_1')?.failedAttempts).toBe(1);
		expect(h.passwordChanged).not.toHaveBeenCalled();
	});

	it('rejects a password that fails policy without revoking sessions', async () => {
		const h = harness();
		await seed(h.users);
		await h.sessions.write(session('s1'));

		const result = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'short',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('PasswordPolicyError');
			expect(result.error.safeMessage).toBe(
				'Password must be at least 12 characters.'
			);
		}
		expect(await h.sessions.read(session('s1').id)).toBeDefined();
	});

	it('rejects reuse of the current password', async () => {
		const h = harness();
		await seed(h.users);

		const result = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'correct-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('PasswordPolicyError');
			expect(result.error.safeMessage).toBe(
				'New password must be different from the current password.'
			);
		}
	});

	it('stores the new hash, clears failures, revokes sessions, and emits one event', async () => {
		const h = harness();
		await seed(h.users);
		await h.sessions.write(session('s1'));
		await h.sessions.write(session('s2'));
		await h.sessions.write(session('s3', 'u_2'));
		await h.users.recordFailedAttempt('u_1', h.clock.now() + LOCK_DURATION);
		h.clock.advance(LOCK_DURATION + 1);

		const result = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.1',
		});

		expect(result).toEqual({ ok: true, revokedSessions: 2 });
		const stored = h.users.get('u_1')?.passwordHash ?? '';
		expect(stored).not.toContain('a-perfectly-reasonable-passphrase');
		await expect(
			fastHasher.verify('a-perfectly-reasonable-passphrase', stored)
		).resolves.toBe(true);
		expect(h.users.get('u_1')?.failedAttempts).toBe(0);
		expect(h.users.get('u_1')?.lockedUntil).toBeUndefined();
		expect(await h.sessions.read(session('s1').id)).toBeUndefined();
		expect(await h.sessions.read(session('s2').id)).toBeUndefined();
		expect(await h.sessions.read(session('s3').id)).toBeDefined();
		expect(h.passwordChanged).toHaveBeenCalledOnce();
		expect(h.passwordChanged).toHaveBeenCalledWith({
			subject: 'u_1',
			revokedSessions: 2,
			completedAt: h.clock.now(),
		});
	});

	it('allows exactly one concurrent replacement of the same current hash', async () => {
		const h = harness();
		await seed(h.users);

		const results = await Promise.all([
			h.provider.changePassword({
				subject: 'u_1',
				currentPassword: 'correct-password',
				newPassword: 'first-replacement-password',
				clientIp: '203.0.113.1',
			}),
			h.provider.changePassword({
				subject: 'u_1',
				currentPassword: 'correct-password',
				newPassword: 'second-replacement-password',
				clientIp: '203.0.113.2',
			}),
		]);

		expect(results.filter((result) => result.ok)).toHaveLength(1);
		expect(h.passwordChanged).toHaveBeenCalledOnce();
	});

	it('leaves the old credential unchanged when session revocation fails', async () => {
		const h = harness();
		await seed(h.users);
		const provider = createCredentialsProvider({
			users: h.users,
			hasher: fastHasher,
			limiter: h.limiter,
			clock: h.clock,
			revokeSessions: () => Promise.reject(new Error('session store down')),
			onPasswordChanged: h.passwordChanged,
		});
		const before = h.users.get('u_1')?.passwordHash;

		await expect(
			provider.changePassword({
				subject: 'u_1',
				currentPassword: 'correct-password',
				newPassword: 'replacement-password',
				clientIp: '203.0.113.1',
			})
		).rejects.toThrow('session store down');
		expect(h.users.get('u_1')?.passwordHash).toBe(before);
	});

	it('fails closed when credential persistence loses a race', async () => {
		const h = harness();
		await seed(h.users);
		await h.sessions.write(session('s1'));
		vi.spyOn(h.users, 'replacePasswordHash').mockResolvedValueOnce(false);

		const result = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.detail).toBe(
				'Credential changed concurrently for subject u_1.'
			);
		}
		expect(await h.sessions.read(session('s1').id)).toBeUndefined();
		expect(h.passwordChanged).not.toHaveBeenCalled();
	});

	it('leaves sessions revoked when credential persistence rejects', async () => {
		const h = harness();
		await seed(h.users);
		await h.sessions.write(session('s1'));
		const before = h.users.get('u_1')?.passwordHash;
		vi.spyOn(h.users, 'replacePasswordHash').mockRejectedValueOnce(
			new Error('credential store down')
		);

		await expect(
			h.provider.changePassword({
				subject: 'u_1',
				currentPassword: 'correct-password',
				newPassword: 'replacement-password',
				clientIp: '203.0.113.1',
			})
		).rejects.toThrow('credential store down');
		expect(await h.sessions.read(session('s1').id)).toBeUndefined();
		expect(h.users.get('u_1')?.passwordHash).toBe(before);
		expect(h.passwordChanged).not.toHaveBeenCalled();
	});

	it('keeps the committed security state when notification enqueue rejects', async () => {
		const h = harness();
		await seed(h.users);
		await h.sessions.write(session('s1'));
		const provider = createCredentialsProvider({
			users: h.users,
			hasher: fastHasher,
			limiter: h.limiter,
			clock: h.clock,
			revokeSessions: (subject) => h.sessions.destroyForSubject(subject),
			onPasswordChanged: () => Promise.reject(new Error('outbox down')),
		});

		await expect(
			provider.changePassword({
				subject: 'u_1',
				currentPassword: 'correct-password',
				newPassword: 'replacement-password',
				clientIp: '203.0.113.1',
			})
		).rejects.toThrow('outbox down');
		expect(await h.sessions.read(session('s1').id)).toBeUndefined();
		await expect(
			fastHasher.verify(
				'replacement-password',
				h.users.get('u_1')?.passwordHash ?? ''
			)
		).resolves.toBe(true);
	});

	it('rate-limits change attempts independently by subject and address', async () => {
		const h = harness(fastHasher, 1);
		await seed(h.users);
		await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'wrong',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.1',
		});

		const subjectLimited = await h.provider.changePassword({
			subject: 'u_1',
			currentPassword: 'correct-password',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(subjectLimited.ok).toBe(false);
		if (
			!subjectLimited.ok &&
			subjectLimited.error._tag === 'RateLimitedError'
		) {
			expect(subjectLimited.error.scope).toBe('credentials:change:subject');
			expect(subjectLimited.error.retryAfterMs).toBe(60_000);
		}

		const ipLimited = await h.provider.changePassword({
			subject: 'u_2',
			currentPassword: 'irrelevant',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.1',
		});
		expect(ipLimited.ok).toBe(false);
		if (!ipLimited.ok && ipLimited.error._tag === 'RateLimitedError') {
			expect(ipLimited.error.scope).toBe('credentials:change:ip');
			expect(ipLimited.error.retryAfterMs).toBe(60_000);
		}
	});
});
