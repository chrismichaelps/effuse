import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PasswordHasher, StoredSession } from '../contract.js';
import {
	DEFAULT_PASSWORD_RESET_TTL_MS,
	MAX_PASSWORD_RESET_TTL_MS,
	createPasswordResetService,
} from '../server/password-reset.js';
import {
	asSessionId,
	createMemoryPasswordResetStore,
	createMemoryRateLimiter,
	createMemorySessionStore,
	createMemoryUserStore,
	createTestClock,
} from '../testing/index.js';

const hasher: PasswordHasher = {
	hash: (password) => Promise.resolve(`hash:${password}`),
	verify: (password, storedHash) =>
		Promise.resolve(storedHash === `hash:${password}`),
	needsRehash: () => false,
};

const session = (id: string, subject: string): StoredSession => ({
	id: asSessionId(id),
	subject,
	claims: { role: 'member' },
	createdAt: 1_700_000_000_000,
	lastSeenAt: 1_700_000_000_000,
	absoluteExpiresAt: 1_700_003_600_000,
});

const harness = (
	options: { readonly limit?: number; readonly ttlMs?: number } = {}
) => {
	const clock = createTestClock();
	const store = createMemoryPasswordResetStore();
	const users = createMemoryUserStore();
	const sessions = createMemorySessionStore(clock);
	const completed = vi.fn();
	const hash = vi.fn(hasher.hash);
	const observedHasher: PasswordHasher = { ...hasher, hash };
	const limiter = createMemoryRateLimiter(
		{ limit: options.limit ?? 100, windowMs: 60_000 },
		clock
	);
	users.seed({
		subject: 'u_1',
		identifier: 'ada@example.com',
		passwordHash: 'hash:old-password',
		failedAttempts: 3,
		lockedUntil: clock.now() + 60_000,
	});

	const service = createPasswordResetService({
		store,
		users,
		hasher: observedHasher,
		sessions,
		limiter,
		clock,
		...(options.ttlMs === undefined ? {} : { tokenTtlMs: options.ttlMs }),
		onCompleted: completed,
	});

	return {
		clock,
		store,
		users,
		sessions,
		completed,
		hash,
		limiter,
		service,
	};
};

const issue = async (h: ReturnType<typeof harness>, subject = 'u_1') => {
	const result = await h.service.issue({ subject, clientIp: '203.0.113.1' });
	if (!result.ok) throw result.error;
	return result;
};

describe('password reset issuance', () => {
	it('persists only a digest of a 256-bit random token', async () => {
		const h = harness();
		const result = await issue(h);
		const records = h.store.snapshot();

		expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(DEFAULT_PASSWORD_RESET_TTL_MS).toBe(900_000);
		expect(result.expiresAt).toBe(h.clock.now() + 900_000);
		expect(records).toHaveLength(1);
		expect(records[0]?.digest).toBe(
			createHash('sha256').update(result.token).digest('hex')
		);
		expect(JSON.stringify(records)).not.toContain(result.token);
	});

	it('invalidates an older link when a replacement is issued', async () => {
		const h = harness();
		const first = await issue(h);
		const second = await issue(h);

		expect(second.token).not.toBe(first.token);
		expect(h.store.snapshot()).toHaveLength(1);
		const rejected = await h.service.redeem({
			token: first.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(rejected.ok).toBe(false);
		if (!rejected.ok)
			expect(rejected.error._tag).toBe('InvalidResetTokenError');
	});

	it('rate-limits repeated issuance independently by subject and address', async () => {
		const bySubject = harness({ limit: 1 });
		await issue(bySubject);
		const subjectResult = await bySubject.service.issue({
			subject: 'u_1',
			clientIp: '203.0.113.2',
		});
		expect(subjectResult.ok).toBe(false);
		if (!subjectResult.ok)
			expect(subjectResult.error.scope).toContain('subject');

		const byIp = harness({ limit: 1 });
		await issue(byIp);
		const ipResult = await byIp.service.issue({
			subject: 'u_2',
			clientIp: '203.0.113.1',
		});
		expect(ipResult.ok).toBe(false);
		if (!ipResult.ok) expect(ipResult.error.scope).toContain('ip');
	});

	it('supports explicit revocation before redemption', async () => {
		const h = harness();
		const issued = await issue(h);
		await h.service.revoke('u_1');

		const result = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(result.ok).toBe(false);
	});
});

describe('password reset redemption', () => {
	it('updates the password, preserves failed-auth state, revokes sessions, and emits an event', async () => {
		const h = harness();
		await h.sessions.write(session('s1', 'u_1'));
		await h.sessions.write(session('s2', 'u_1'));
		await h.sessions.write(session('s3', 'u_2'));
		const issued = await issue(h);

		const result = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});

		expect(result).toEqual({ ok: true, revokedSessions: 2 });
		expect(h.users.get('u_1')).toMatchObject({
			passwordHash: 'hash:replacement-password',
			failedAttempts: 3,
			lockedUntil: h.clock.now() + 60_000,
		});
		expect(await h.sessions.read(asSessionId('s1'))).toBeUndefined();
		expect(await h.sessions.read(asSessionId('s2'))).toBeUndefined();
		expect(await h.sessions.read(asSessionId('s3'))).toBeDefined();
		expect(h.completed).toHaveBeenCalledWith({
			subject: 'u_1',
			revokedSessions: 2,
			completedAt: h.clock.now(),
		});
	});

	it('revokes sessions before committing the new credential', async () => {
		const h = harness();
		const destroy = vi.spyOn(h.sessions, 'destroyForSubject');
		const update = vi.spyOn(h.users, 'updatePasswordHash');
		const issued = await issue(h);

		await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});

		expect(destroy).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledOnce();
		expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(
			update.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
		);
	});

	it('fails closed when credential storage fails after capability consumption', async () => {
		const h = harness();
		await h.sessions.write(session('s1', 'u_1'));
		vi.spyOn(h.users, 'updatePasswordHash').mockRejectedValueOnce(
			new Error('database unavailable')
		);
		const issued = await issue(h);

		await expect(
			h.service.redeem({
				token: issued.token,
				newPassword: 'replacement-password',
				clientIp: '203.0.113.2',
			})
		).rejects.toThrow('database unavailable');
		expect(await h.sessions.read(asSessionId('s1'))).toBeUndefined();

		const replay = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(replay.ok).toBe(false);
	});

	it('lets exactly one concurrent redemption change the password', async () => {
		const h = harness();
		const issued = await issue(h);
		const input = {
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		};
		const results = await Promise.all(
			Array.from({ length: 10 }, async () => h.service.redeem(input))
		);

		expect(results.filter((result) => result.ok)).toHaveLength(1);
		expect(h.completed).toHaveBeenCalledTimes(1);
	});

	it('leaves a valid link usable after password-policy rejection', async () => {
		const h = harness();
		const issued = await issue(h);
		const rejected = await h.service.redeem({
			token: issued.token,
			newPassword: 'short',
			clientIp: '203.0.113.2',
		});
		expect(rejected.ok).toBe(false);
		if (!rejected.ok) {
			expect(rejected.error._tag).toBe('PasswordPolicyError');
			expect(rejected.error.safeMessage).toBe(
				'Password must be at least 12 characters.'
			);
		}

		const accepted = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(accepted.ok).toBe(true);
	});

	it('treats malformed, expired, and replayed links identically', async () => {
		const h = harness();
		const issued = await issue(h);
		h.clock.advance(DEFAULT_PASSWORD_RESET_TTL_MS);
		const expired = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		const malformed = await h.service.redeem({
			token: 'not-a-token',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});

		const fresh = await issue(h);
		await h.service.redeem({
			token: fresh.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		const replayed = await h.service.redeem({
			token: fresh.token,
			newPassword: 'another-replacement',
			clientIp: '203.0.113.2',
		});

		for (const result of [expired, malformed, replayed]) {
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error._tag).toBe('InvalidResetTokenError');
				expect(result.error.safeMessage).toBe(
					'This password reset link is invalid or expired.'
				);
			}
		}
		expect(h.hash).toHaveBeenCalledTimes(1);
	});

	it.each([
		`x${'A'.repeat(43)}`,
		`${'A'.repeat(43)}x`,
		'A'.repeat(42),
		'A'.repeat(44),
	])(
		'rejects an unanchored or wrong-length token without hashing %j',
		async (token) => {
			const h = harness();
			const result = await h.service.redeem({
				token,
				newPassword: 'replacement-password',
				clientIp: '203.0.113.2',
			});

			expect(result.ok).toBe(false);
			if (!result.ok && result.error._tag === 'InvalidResetTokenError') {
				expect(result.error.detail).toBe('Malformed reset token.');
			}
			expect(h.hash).not.toHaveBeenCalled();
		}
	);

	it('rejects an unknown well-formed token before password hashing', async () => {
		const h = harness();
		const result = await h.service.redeem({
			token: 'A'.repeat(43),
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});

		expect(result.ok).toBe(false);
		if (!result.ok && result.error._tag === 'InvalidResetTokenError') {
			expect(result.error.detail).toBe(
				'Reset token is absent, expired, replaced, or consumed.'
			);
		}
		expect(h.hash).not.toHaveBeenCalled();
	});

	it('rejects a store that changes the subject during atomic consumption', async () => {
		const h = harness();
		const issued = await issue(h);
		const inconsistentStore = {
			...h.store,
			consume: async (digest: string, now: number) => {
				const record = await h.store.consume(digest, now);
				return record === undefined ? undefined : { ...record, subject: 'u_2' };
			},
		};
		const service = createPasswordResetService({
			store: inconsistentStore,
			users: h.users,
			hasher: { ...hasher, hash: h.hash },
			sessions: h.sessions,
			limiter: h.limiter,
			clock: h.clock,
			onCompleted: h.completed,
		});

		const result = await service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		expect(result.ok).toBe(false);
		if (!result.ok && result.error._tag === 'InvalidResetTokenError') {
			expect(result.error.detail).toBe(
				'Reset token lost an atomic redemption race.'
			);
		}
		expect(h.users.get('u_1')?.passwordHash).toBe('hash:old-password');
	});

	it('rate-limits token verification by client address', async () => {
		const h = harness({ limit: 1 });
		const issued = await issue(h);
		await h.service.redeem({
			token: 'not-a-token',
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});
		const result = await h.service.redeem({
			token: issued.token,
			newPassword: 'replacement-password',
			clientIp: '203.0.113.2',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error._tag).toBe('RateLimitedError');
			if (result.error._tag === 'RateLimitedError') {
				expect(result.error.scope).toBe('password-reset:redeem:ip');
			}
		}
	});
});

describe('password reset configuration', () => {
	it.each([0, -1, Number.POSITIVE_INFINITY, MAX_PASSWORD_RESET_TTL_MS + 1])(
		'rejects an unsafe token lifetime %s',
		(tokenTtlMs) => {
			expect(() => harness({ ttlMs: tokenTtlMs })).toThrowError(
				`[@effuse/auth] passwordReset.tokenTtlMs: Expected a positive finite duration no greater than ${String(MAX_PASSWORD_RESET_TTL_MS)}ms.`
			);
		}
	);

	it('accepts the 24-hour maximum', () => {
		expect(() => harness({ ttlMs: MAX_PASSWORD_RESET_TTL_MS })).not.toThrow();
	});
});
