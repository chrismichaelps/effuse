import { describe, expect, it } from 'vitest';
import { claim, defineAuth } from '../index.js';
import { ConfigError } from '../errors.js';
import { createSessionEngine } from '../server/session-engine.js';
import { createTokenCodec } from '../server/token-codec.js';
import { createStorageSessionStore } from '../server/storage-session-store.js';
import { createCredentialsProvider } from '../server/credentials.js';
import { createScryptHasher } from '../server/password-hasher.js';
import {
	createMemoryRateLimiter,
	createMemorySessionStore,
	createMemoryUserStore,
	createTestClock,
	type TestClock,
} from '../testing/index.js';
import { createMemoryAuthStorage } from '../testing/storage.js';
import type { SessionId, SessionStore, StoredSession } from '../contract.js';

const SECRET = 'r'.repeat(32);
const shape = { role: claim.enum(['admin', 'member']) };

const engineOver = (store: SessionStore | undefined, clock: TestClock) =>
	createSessionEngine({
		strategy: 'stateful',
		claims: shape,
		codec: createTokenCodec({ secrets: [SECRET] }),
		clock,
		...(store === undefined ? {} : { store }),
		idleTtlMs: 30 * 60_000,
		absoluteTtlMs: 8 * 60 * 60_000,
	});

describe('backend failures', () => {
	// Redis times out, Postgres drops the connection, the KV namespace is
	// rate-limited. None of these should surface as an unhandled rejection from a
	// request handler.
	const failing = (message: string): SessionStore => ({
		read: () => Promise.reject(new Error(message)),
		write: () => Promise.reject(new Error(message)),
		destroy: () => Promise.reject(new Error(message)),
		destroyForSubject: () => Promise.reject(new Error(message)),
		acquireLock: () => Promise.reject(new Error(message)),
	});

	it('reports a store failure on read as a typed error rather than rejecting', async () => {
		const clock = createTestClock();
		const working = createMemorySessionStore(clock);
		const engine = engineOver(working, clock);

		const issued = await engine.issue({
			subject: 'u_1',
			claims: { role: 'admin' },
		});
		expect(issued.ok).toBe(true);
		if (!issued.ok) return;

		const broken = engineOver(failing('ECONNRESET'), clock);
		const result = await broken.read(issued.token);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('StoreError');
	});

	it('reports a store failure on issue as a typed error', async () => {
		const clock = createTestClock();
		const engine = engineOver(failing('write timeout'), clock);

		const result = await engine.issue({
			subject: 'u_1',
			claims: { role: 'admin' },
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('StoreError');
	});

	it('keeps the backend message out of anything client-visible', async () => {
		const clock = createTestClock();
		const engine = engineOver(
			failing('postgres://admin:hunter2@db.internal:5432 refused'),
			clock
		);

		const result = await engine.issue({
			subject: 'u_1',
			claims: { role: 'admin' },
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.safeMessage).not.toContain('hunter2');
		expect(result.error.safeMessage).not.toContain('db.internal');
	});

	it('does not throw when sign-out cannot reach the store', async () => {
		// The user asked to be signed out. The cookie clear must still happen even
		// if the server-side delete fails, so the outcome degrades rather than
		// erroring in their face.
		const clock = createTestClock();
		const working = createMemorySessionStore(clock);
		const issued = await engineOver(working, clock).issue({
			subject: 'u_1',
			claims: { role: 'admin' },
		});
		expect(issued.ok).toBe(true);
		if (!issued.ok) return;

		const broken = engineOver(failing('down'), clock);

		await expect(broken.destroy(issued.token)).resolves.toBe(false);
		await expect(broken.destroyForSubject('u_1')).resolves.toBe(0);
	});
});

describe('corrupted store records', () => {
	// Records get hand-edited, half-written, or migrated badly. A single bad row
	// must fail one request, not take the endpoint down.
	const storeReturning = (record: unknown): SessionStore => ({
		read: () => Promise.resolve(record as StoredSession | undefined),
		write: () => Promise.resolve(),
		destroy: () => Promise.resolve(),
		destroyForSubject: () => Promise.resolve(0),
		acquireLock: () => Promise.resolve(undefined),
	});

	const tokenFor = async (): Promise<string> =>
		createTokenCodec({ secrets: [SECRET] }).sign({
			sid: 'x'.repeat(43),
			aex: 1_700_000_000_000 + 3_600_000,
		});

	it('rejects a record whose claims no longer match the declared shape', async () => {
		const clock = createTestClock();
		const engine = engineOver(
			storeReturning({
				id: 'x'.repeat(43),
				subject: 'u_1',
				claims: { role: 'superadmin' },
				createdAt: clock.now(),
				lastSeenAt: clock.now(),
				absoluteExpiresAt: clock.now() + 3_600_000,
			}),
			clock
		);

		const result = await engine.read(await tokenFor());

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('InvalidTokenError');
	});

	it('rejects records with missing or malformed fields without throwing', async () => {
		const clock = createTestClock();

		const broken: unknown[] = [
			null,
			{},
			{ id: 'x' },
			{ id: 'x', subject: 'u_1' },
			{ id: 'x', subject: 'u_1', claims: null },
			{ id: 'x', subject: 'u_1', claims: 'not-an-object' },
			{
				id: 'x',
				subject: 'u_1',
				claims: { role: 'admin' },
				createdAt: 'yesterday',
				lastSeenAt: null,
				absoluteExpiresAt: undefined,
			},
		];

		for (const record of broken) {
			const engine = engineOver(storeReturning(record), clock);
			const result = await engine.read(await tokenFor());

			expect(result.ok).toBe(false);
		}
	});
});

describe('schema evolution', () => {
	// A deploy changes the claims shape while sessions minted under the old one
	// are still in flight. Both outcomes below are correct; the point is that
	// which one you get is a decision you make, not a surprise.
	const clockAnd = () => {
		const clock = createTestClock();
		return { clock, storage: createMemoryAuthStorage(clock) };
	};

	const engineWith = <S extends Record<string, ReturnType<typeof claim.string>>>(
		claims: S,
		clock: TestClock,
		store: SessionStore
	) =>
		createSessionEngine({
			strategy: 'stateless',
			claims,
			codec: createTokenCodec({ secrets: [SECRET] }),
			clock,
			store,
			idleTtlMs: 30 * 60_000,
			absoluteTtlMs: 8 * 60 * 60_000,
		});

	it('fails closed when a newly required claim is absent from an existing session', async () => {
		// Fail-closed is the right default: a session missing a claim a policy is
		// about to read must not be handed over with the field undefined.
		const { clock, storage } = clockAnd();
		const store = createStorageSessionStore({
			storage,
			clock,
			ttlMs: 8 * 60 * 60_000,
		});

		const before = engineWith({ displayName: claim.string() }, clock, store);
		const issued = await before.issue({
			subject: 'u_1',
			claims: { displayName: 'Ada' },
		});
		expect(issued.ok).toBe(true);
		if (!issued.ok) return;

		const after = engineWith(
			{ displayName: claim.string(), tenantId: claim.string() },
			clock,
			store
		);

		const result = await after.read(issued.token);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('InvalidTokenError');
	});

	it('keeps existing sessions working when the new claim is optional', async () => {
		// The migration path: add the claim as optional, backfill, then make it
		// required in a later deploy. No forced sign-out at any point.
		const { clock, storage } = clockAnd();
		const store = createStorageSessionStore({
			storage,
			clock,
			ttlMs: 8 * 60 * 60_000,
		});

		const before = engineWith({ displayName: claim.string() }, clock, store);
		const issued = await before.issue({
			subject: 'u_1',
			claims: { displayName: 'Ada' },
		});
		expect(issued.ok).toBe(true);
		if (!issued.ok) return;

		const after = createSessionEngine({
			strategy: 'stateless',
			claims: {
				displayName: claim.string(),
				tenantId: claim.string().optional(),
			},
			codec: createTokenCodec({ secrets: [SECRET] }),
			clock,
			store,
			idleTtlMs: 30 * 60_000,
			absoluteTtlMs: 8 * 60 * 60_000,
		});

		const result = await after.read(issued.token);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.claims.displayName).toBe('Ada');
		expect(result.session.claims.tenantId).toBeUndefined();
	});

	it('drops a claim that has been removed from the shape', async () => {
		const { clock, storage } = clockAnd();
		const store = createStorageSessionStore({
			storage,
			clock,
			ttlMs: 8 * 60 * 60_000,
		});

		const before = engineWith(
			{ displayName: claim.string(), legacy: claim.string() },
			clock,
			store
		);
		const issued = await before.issue({
			subject: 'u_1',
			claims: { displayName: 'Ada', legacy: 'remove-me' },
		});
		expect(issued.ok).toBe(true);
		if (!issued.ok) return;

		const after = engineWith({ displayName: claim.string() }, clock, store);
		const result = await after.read(issued.token);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.session.claims).toEqual({ displayName: 'Ada' });
		expect(result.session.claims).not.toHaveProperty('legacy');
	});
});

describe('storage-backed store housekeeping', () => {
	const setup = () => {
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		return {
			clock,
			storage,
			store: createStorageSessionStore({
				storage,
				clock,
				ttlMs: 8 * 60 * 60_000,
			}),
		};
	};

	const record = (id: string, subject: string, clock: TestClock): StoredSession => ({
		id: id as SessionId,
		subject,
		claims: { role: 'member' },
		createdAt: clock.now(),
		lastSeenAt: clock.now(),
		absoluteExpiresAt: clock.now() + 8 * 60 * 60_000,
	});

	it('prunes the subject index when a session is destroyed', async () => {
		// A stale id left in the index makes every later destroyForSubject do
		// pointless work, and the index grows without bound.
		const { store, clock, storage } = setup();

		await store.write(record('s1', 'u_1', clock));
		await store.write(record('s2', 'u_1', clock));
		await store.destroy('s1' as SessionId);

		const index = await storage
			.namespace('subjects')
			.get<readonly string[]>('u_1');

		expect(index).toEqual(['s2']);
	});

	it('removes the index entry entirely when the last session goes', async () => {
		const { store, clock, storage } = setup();

		await store.write(record('s1', 'u_1', clock));
		await store.destroy('s1' as SessionId);

		expect(
			await storage.namespace('subjects').has('u_1')
		).toBe(false);
	});

	it('does not double-index a session written twice', async () => {
		// Every idle-window slide rewrites the record. An index that appended each
		// time would grow linearly with request count.
		const { store, clock, storage } = setup();

		for (let i = 0; i < 10; i += 1) {
			await store.write(record('s1', 'u_1', clock));
		}

		expect(
			await storage.namespace('subjects').get<readonly string[]>('u_1')
		).toEqual(['s1']);
	});

	it('expires records once their ttl elapses', async () => {
		const { clock, storage } = setup();
		const shortLived = createStorageSessionStore({
			storage,
			clock,
			ttlMs: 1000,
		});

		await shortLived.write(record('s1', 'u_1', clock));
		expect(await shortLived.read('s1' as SessionId)).toBeDefined();

		clock.advance(1001);
		expect(await shortLived.read('s1' as SessionId)).toBeUndefined();
	});

	it('keeps namespaces isolated', async () => {
		// Clearing sessions must not wipe the lock namespace or the index.
		const { store, clock, storage } = setup();

		await store.write(record('s1', 'u_1', clock));
		await store.acquireLock('refresh:u_1', 1000);

		await storage.namespace('sessions').clear();

		expect(await storage.namespace('locks').has('refresh:u_1')).toBe(true);
		expect(await storage.namespace('subjects').has('u_1')).toBe(true);
	});

	it('handles many sessions for one subject', async () => {
		const { store, clock } = setup();

		for (let i = 0; i < 200; i += 1) {
			await store.write(record(`s${String(i)}`, 'u_1', clock));
		}

		expect(await store.destroyForSubject('u_1')).toBe(200);
		expect(await store.read('s0' as SessionId)).toBeUndefined();
		expect(await store.read('s199' as SessionId)).toBeUndefined();
	});
});

describe('defineAuth validation', () => {
	const claims = { role: claim.enum(['admin', 'member']) };

	it('rejects an empty secret list', () => {
		try {
			defineAuth({ secrets: [], claims });
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe('secrets');
			expect((error as ConfigError).message).toContain('signing secret');
		}
	});

	it('rejects an empty claims shape', () => {
		// A session with no claims cannot express anything, and silently accepting
		// it would produce a package that appears configured but is inert.
		try {
			defineAuth({ secrets: ['a'.repeat(32)], claims: {} });
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe('claims');
			expect((error as ConfigError).message).toContain('at least one claim');
		}
	});

	it('rejects an idle window longer than the absolute lifetime', () => {
		expect(() =>
			defineAuth({
				secrets: ['a'.repeat(32)],
				claims,
				session: { idleTtlMs: 2000, absoluteTtlMs: 1000 },
			})
		).toThrow(ConfigError);
	});

	it.each([
		['session.idleTtlMs', { idleTtlMs: 0 }],
		['session.idleTtlMs', { idleTtlMs: Number.NaN }],
		['session.idleTtlMs', { idleTtlMs: Number.POSITIVE_INFINITY }],
		['session.absoluteTtlMs', { absoluteTtlMs: -1 }],
		['session.absoluteTtlMs', { absoluteTtlMs: 0 }],
		['session.absoluteTtlMs', { absoluteTtlMs: Number.NaN }],
		['session.rotationOverlapMs', { rotationOverlapMs: -1 }],
		[
			'session.rotationOverlapMs',
			{ rotationOverlapMs: Number.POSITIVE_INFINITY },
		],
	] as const)('rejects invalid duration at %s', (path, session) => {
		try {
			defineAuth({ secrets: ['a'.repeat(32)], claims, session });
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe(path);
			expect((error as ConfigError).message).toContain('finite');
		}
	});

	it('accepts a zero rotation overlap when immediate invalidation is intended', () => {
		const config = defineAuth({
			secrets: ['a'.repeat(32)],
			claims,
			session: { rotationOverlapMs: 0 },
		});

		expect(config.session.rotationOverlapMs).toBe(0);
	});

	it('accepts equal idle and absolute lifetimes', () => {
		const config = defineAuth({
			secrets: ['a'.repeat(32)],
			claims,
			session: { idleTtlMs: 1000, absoluteTtlMs: 1000 },
		});

		expect(config.session.idleTtlMs).toBe(1000);
		expect(config.session.absoluteTtlMs).toBe(1000);
	});

	it('rejects SameSite=None without Secure', () => {
		try {
			defineAuth({
				secrets: ['a'.repeat(32)],
				claims,
				cookie: { sameSite: 'none', secure: false },
			});
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe('cookie.sameSite');
			expect((error as ConfigError).message).toContain('requires Secure');
		}
	});

	it('surfaces the offending path and reason in the error message', () => {
		// A boot-time failure is read in a log with no debugger attached, so the
		// message has to carry the diagnosis on its own.
		try {
			defineAuth({
				secrets: ['a'.repeat(32)],
				claims,
				session: { idleTtlMs: 2000, absoluteTtlMs: 1000 },
			});
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe('session.idleTtlMs');
			expect((error as ConfigError).message).toContain('session.idleTtlMs');
			expect((error as ConfigError).message).toContain('idle window');
		}
	});

	it('applies secure defaults when nothing is specified', () => {
		const config = defineAuth({ secrets: ['a'.repeat(32)], claims });

		expect(config.cookie.secure).toBe(true);
		expect(config.cookie.sameSite).toBe('lax');
		expect(config.cookie.hostPrefix).toBe(true);
		expect(config.cookie.path).toBe('/');
	});

	it('preserves an explicit strategy rather than inferring one', () => {
		const config = defineAuth({
			secrets: ['a'.repeat(32)],
			claims,
			session: { strategy: 'stateless' },
		});

		expect(config.session.strategy).toBe('stateless');
	});
});

describe('credentials edge cases', () => {
	const hasher = createScryptHasher({
		cost: 2 ** 12,
		blockSize: 8,
		parallelism: 1,
	});

	const setup = async (password = 'a-perfectly-reasonable-passphrase') => {
		const clock = createTestClock();
		const users = createMemoryUserStore();

		users.seed({
			subject: 'u_1',
			identifier: 'ada@example.com',
			passwordHash: await hasher.hash(password),
			failedAttempts: 0,
		});

		return {
			clock,
			users,
			provider: createCredentialsProvider({
				users,
				hasher,
				limiter: createMemoryRateLimiter({ limit: 50, windowMs: 60_000 }, clock),
				clock,
				lockoutThreshold: 5,
				lockoutDurationMs: 15 * 60_000,
			}),
		};
	};

	it('trims surrounding whitespace from the identifier', async () => {
		// Mobile keyboards append a space after autocomplete. Failing that sign-in
		// is a support ticket, not a security control.
		const { provider } = await setup();

		const result = await provider.authenticate({
			identifier: '  ada@example.com  ',
			password: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
	});

	it('does not trim the password', async () => {
		// Leading and trailing spaces are legitimate password characters, and
		// trimming them silently shrinks the keyspace.
		const { provider } = await setup('  spaced  ');

		expect(
			(
				await provider.authenticate({
					identifier: 'ada@example.com',
					password: '  spaced  ',
					clientIp: '203.0.113.1',
				})
			).ok
		).toBe(true);

		expect(
			(
				await provider.authenticate({
					identifier: 'ada@example.com',
					password: 'spaced',
					clientIp: '203.0.113.1',
				})
			).ok
		).toBe(false);
	});

	it('rejects an empty password without special-casing it', async () => {
		const { provider } = await setup();

		const result = await provider.authenticate({
			identifier: 'ada@example.com',
			password: '',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('InvalidCredentialsError');
	});

	it('handles an extremely long password submission', async () => {
		// Without an upper bound this is free CPU exhaustion against a
		// deliberately slow KDF.
		const { provider } = await setup();

		const result = await provider.authenticate({
			identifier: 'ada@example.com',
			password: 'x'.repeat(1_000_000),
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(false);
	});

	it('rejects an over-long password at the policy boundary on change', async () => {
		const { provider } = await setup();

		expect(
			(
				await provider.changePassword({
					subject: 'u_1',
					newPassword: 'x'.repeat(257),
				})
			).ok
		).toBe(false);

		expect(
			(
				await provider.changePassword({
					subject: 'u_1',
					newPassword: 'x'.repeat(256),
				})
			).ok
		).toBe(true);
	});

	it('accepts a unicode identifier and password', async () => {
		const clock = createTestClock();
		const users = createMemoryUserStore();
		users.seed({
			subject: 'u_2',
			identifier: 'ådä@example.com',
			passwordHash: await hasher.hash('пароль-достаточно-длинный'),
			failedAttempts: 0,
		});

		const provider = createCredentialsProvider({
			users,
			hasher,
			limiter: createMemoryRateLimiter({ limit: 50, windowMs: 60_000 }, clock),
			clock,
		});

		const result = await provider.authenticate({
			identifier: 'ÅDÄ@example.com',
			password: 'пароль-достаточно-длинный',
			clientIp: '203.0.113.1',
		});

		expect(result.ok).toBe(true);
	});

	it('counts failures per account, not globally', async () => {
		// One user's failed attempts must not lock a different user out.
		const clock = createTestClock();
		const users = createMemoryUserStore();

		for (const subject of ['u_1', 'u_2']) {
			users.seed({
				subject,
				identifier: `${subject}@example.com`,
				passwordHash: await hasher.hash('a-perfectly-reasonable-passphrase'),
				failedAttempts: 0,
			});
		}

		const provider = createCredentialsProvider({
			users,
			hasher,
			limiter: createMemoryRateLimiter({ limit: 100, windowMs: 60_000 }, clock),
			clock,
			lockoutThreshold: 3,
			lockoutDurationMs: 60_000,
		});

		for (let i = 0; i < 3; i += 1) {
			await provider.authenticate({
				identifier: 'u_1@example.com',
				password: 'wrong',
				clientIp: '203.0.113.1',
			});
		}

		expect(
			(
				await provider.authenticate({
					identifier: 'u_2@example.com',
					password: 'a-perfectly-reasonable-passphrase',
					clientIp: '203.0.113.1',
				})
			).ok
		).toBe(true);
	});

	it('survives concurrent sign-in attempts for the same account', async () => {
		const { provider } = await setup();

		const results = await Promise.all(
			Array.from({ length: 12 }, async () =>
				provider.authenticate({
					identifier: 'ada@example.com',
					password: 'a-perfectly-reasonable-passphrase',
					clientIp: '203.0.113.1',
				})
			)
		);

		expect(results.every((result) => result.ok)).toBe(true);
	});
});
