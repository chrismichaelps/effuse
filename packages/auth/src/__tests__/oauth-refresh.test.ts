import { describe, expect, it } from 'vitest';
import {
	classifyRefreshToken,
	createTokenRefresher,
	type TokenRecord,
	type TokenRefresherOptions,
} from '../server/oauth/refresh.js';
import {
	createMemorySessionStore,
	createTestClock,
	type MemorySessionStore,
	type TestClock,
} from '../testing/index.js';
import { createMemoryAuthStorage } from '../testing/storage.js';

const TOKEN_ENDPOINT = 'https://idp.example.com/token';

interface Harness {
	readonly clock: TestClock;
	readonly store: MemorySessionStore;
	readonly refresher: ReturnType<typeof createTokenRefresher>;
	/** Upstream calls made to the token endpoint. */
	readonly calls: () => number;
	/** Refresh tokens the fake provider has already redeemed. */
	readonly redeemed: () => readonly string[];
	readonly setResponder: (
		responder: (form: URLSearchParams) => Response | Promise<Response>
	) => void;
}

const harness = (overrides: Partial<TokenRefresherOptions> = {}): Harness => {
	const clock = createTestClock();
	const storage = createMemoryAuthStorage(clock);
	const store = createMemorySessionStore(clock);

	let callCount = 0;
	const redeemed: string[] = [];
	let counter = 0;

	// A provider that genuinely rotates and genuinely refuses a token it has
	// already redeemed. A permissive fake would let a broken client pass.
	let responder = (form: URLSearchParams): Response => {
		const presented = form.get('refresh_token') ?? '';

		if (redeemed.includes(presented)) {
			return new Response(JSON.stringify({ error: 'invalid_grant' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		redeemed.push(presented);
		counter += 1;

		return new Response(
			JSON.stringify({
				access_token: `access-${String(counter)}`,
				refresh_token: `refresh-${String(counter)}`,
				expires_in: 3600,
				token_type: 'Bearer',
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	};

	const refresher = createTokenRefresher({
		tokenEndpoint: TOKEN_ENDPOINT,
		clientId: 'client-id',
		clientSecret: 'client-secret',
		providerId: 'fake',
		storage,
		store,
		clock,
		// Waiting advances the test clock rather than real time, so the waiter
		// path is exercised deterministically instead of with sleeps.
		sleep: (ms) => {
			clock.advance(ms);
			return Promise.resolve();
		},
		fetch: async (input) => {
			callCount += 1;
			const request = input instanceof Request ? input : new Request(String(input));
			return responder(new URLSearchParams(await request.text()));
		},
		...overrides,
	});

	return {
		clock,
		store,
		refresher,
		calls: () => callCount,
		redeemed: () => redeemed,
		setResponder: (next) => {
			responder = next as (form: URLSearchParams) => Response;
		},
	};
};

const seed = async (h: Harness, expiresInSeconds = 3600): Promise<void> => {
	await h.refresher.remember({
		sessionId: 'sess_1',
		subject: 'u_1',
		accessToken: 'access-0',
		refreshToken: 'refresh-0',
		expiresInSeconds,
	});
};

describe('the fast path', () => {
	it('returns the stored token without any upstream call', async () => {
		const h = harness();
		await seed(h);

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.accessToken).toBe('access-0');
		expect(result.refreshed).toBe(false);
		expect(h.calls()).toBe(0);
	});

	it('refreshes ahead of expiry by the skew margin', async () => {
		// Refreshing exactly at expiry guarantees a race with the resource server
		// over whose clock is right, and the resource server always wins.
		const h = harness({ skewMs: 60_000 });
		await seed(h, 3600);

		h.clock.advance((3600 - 90) * 1000);
		expect((await h.refresher.getAccessToken('sess_1')).ok).toBe(true);
		expect(h.calls()).toBe(0);

		h.clock.advance(45_000);
		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.refreshed).toBe(true);
		expect(result.accessToken).toBe('access-1');
	});
});

describe('single flight', () => {
	it('collapses many concurrent requests into exactly one upstream call', async () => {
		// The 64-reaction bug, reproduced. A page load fires several requests at
		// once, all observe the same expired token, and without coalescing all of
		// them redeem the same refresh token — the provider invalidates it on
		// first use and the user is silently signed out.
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		const results = await Promise.all(
			Array.from({ length: 25 }, async () => h.refresher.getAccessToken('sess_1'))
		);

		expect(results.every((result) => result.ok)).toBe(true);
		expect(h.calls()).toBe(1);
	});

	it('gives every concurrent caller the same token', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		const results = await Promise.all(
			Array.from({ length: 10 }, async () => h.refresher.getAccessToken('sess_1'))
		);

		const values = new Set(
			results.map((result) => (result.ok ? result.accessToken : 'failed'))
		);

		expect(values.size).toBe(1);
		expect([...values][0]).toBe('access-1');
	});

	it('redeems each refresh token exactly once', async () => {
		// The property that actually matters: the provider must never see a token
		// twice, because the second redemption is what invalidates the first.
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		await Promise.all(
			Array.from({ length: 15 }, async () => h.refresher.getAccessToken('sess_1'))
		);

		expect(h.redeemed()).toEqual(['refresh-0']);
		expect(new Set(h.redeemed()).size).toBe(h.redeemed().length);
	});

	it('keeps separate sessions independent', async () => {
		const h = harness();
		await seed(h, 60);
		await h.refresher.remember({
			sessionId: 'sess_2',
			subject: 'u_2',
			accessToken: 'other-access',
			refreshToken: 'other-refresh',
			expiresInSeconds: 60,
		});

		h.clock.advance(60_000);

		await Promise.all([
			h.refresher.getAccessToken('sess_1'),
			h.refresher.getAccessToken('sess_2'),
		]);

		// One call each: coalescing must not merge unrelated sessions.
		expect(h.calls()).toBe(2);
	});

	it('rotates the stored refresh token', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		await h.refresher.getAccessToken('sess_1');

		const record = await h.refresher.read('sess_1');
		expect(record?.refreshToken).toBe('refresh-1');
		expect(record?.previousRefreshToken).toBe('refresh-0');
	});

	it('preserves the family across rotations', async () => {
		// Revocation operates on the family, so it has to survive rotation or a
		// detected theft would only revoke the newest link in the chain.
		const h = harness();
		await seed(h, 60);

		const before = await h.refresher.read('sess_1');

		for (let i = 0; i < 3; i += 1) {
			h.clock.advance(3600_000);
			await h.refresher.getAccessToken('sess_1');
		}

		const after = await h.refresher.read('sess_1');
		expect(after?.familyId).toBe(before?.familyId);
	});
});

describe('lock behaviour', () => {
	it('waits for a lock held by another process rather than issuing its own call', async () => {
		// A process-local map cannot see another replica's in-flight refresh, so
		// the store lock is what stops the duplicate request across replicas.
		const h = harness({ waitTimeoutMs: 5_000, pollIntervalMs: 50 });
		await seed(h, 60);
		h.clock.advance(60_000);

		// Simulate another replica holding the lock, then finishing.
		const held = await h.store.acquireLock('refresh:sess_1', 10_000);
		expect(held).toBeDefined();

		const waiting = h.refresher.getAccessToken('sess_1');

		// The "other replica" completes and publishes a fresh record.
		await h.refresher.remember({
			sessionId: 'sess_1',
			subject: 'u_1',
			accessToken: 'access-from-winner',
			refreshToken: 'refresh-from-winner',
			expiresInSeconds: 3600,
		});
		await held?.release();

		const result = await waiting;

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.accessToken).toBe('access-from-winner');
		expect(h.calls()).toBe(0);
	});

	it('proceeds once a crashed holder lets its lock lapse', async () => {
		// A process dying mid-refresh must not wedge the session until someone
		// notices. The lock TTL is what bounds that.
		const h = harness({ lockTtlMs: 1_000, waitTimeoutMs: 30_000, pollIntervalMs: 100 });
		await seed(h, 60);
		h.clock.advance(60_000);

		// Acquired and never released — the holder "crashed".
		await h.store.acquireLock('refresh:sess_1', 1_000);

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.refreshed).toBe(true);
		expect(h.calls()).toBe(1);
	});

	it('gives up with a typed error rather than hanging forever', async () => {
		// An unbounded wait turns a stuck lock into a hung request, which is worse
		// than a clear failure the caller can surface.
		const h = harness({ waitTimeoutMs: 500, pollIntervalMs: 100, lockTtlMs: 600_000 });
		await seed(h, 60);
		h.clock.advance(60_000);

		await h.store.acquireLock('refresh:sess_1', 600_000);

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'refresh-timeout' });
	});

	it('re-reads the record after taking the lock, not before', async () => {
		// The window: this process reads a stale record, another replica completes
		// a refresh and rotates the token, and only then does this process win the
		// lock. Exchanging the record it read first would present an
		// already-redeemed token, the provider would answer `invalid_grant`, and
		// the session would be torn down — the exact bug the lock exists to stop,
		// reintroduced one line later.
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const inner = createMemorySessionStore(clock);

		let calls = 0;
		let presented: string | undefined;

		const refresher = createTokenRefresher({
			tokenEndpoint: TOKEN_ENDPOINT,
			clientId: 'c',
			clientSecret: 's',
			providerId: 'fake',
			storage,
			// Another replica lands its refresh in the gap between our read and our
			// lock acquisition.
			store: {
				...inner,
				acquireLock: async (key, ttl) => {
					if (calls === 0) {
						await storage.namespace('oauth-tokens').set('sess_1', {
							familyId: 'fam_1',
							subject: 'u_1',
							accessToken: 'access-from-other-replica',
							accessTokenExpiresAt: clock.now() + 3_600_000,
							refreshToken: 'refresh-rotated-by-other-replica',
						});
					}
					return inner.acquireLock(key, ttl);
				},
			},
			clock,
			sleep: (ms) => {
				clock.advance(ms);
				return Promise.resolve();
			},
			fetch: async (input) => {
				calls += 1;
				const request = input instanceof Request ? input : new Request(String(input));
				presented = new URLSearchParams(await request.text()).get('refresh_token') ?? undefined;
				return new Response(
					JSON.stringify({ access_token: 'should-not-happen', expires_in: 3600 }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			},
		});

		await storage.namespace('oauth-tokens').set('sess_1', {
			familyId: 'fam_1',
			subject: 'u_1',
			accessToken: 'stale-access',
			accessTokenExpiresAt: clock.now() - 1000,
			refreshToken: 'refresh-stale',
		});

		const result = await refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		// The other replica's work is adopted; no redundant call is made, and the
		// stale token is never presented.
		expect(result.accessToken).toBe('access-from-other-replica');
		expect(calls).toBe(0);
		expect(presented).toBeUndefined();
	});

	it('releases the lock even when the exchange throws', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(() => {
			throw new Error('boom');
		});

		await h.refresher.getAccessToken('sess_1');

		// If the lock were still held, this would fail to acquire.
		expect(await h.store.acquireLock('refresh:sess_1', 1000)).toBeDefined();
	});
});

describe('reuse detection', () => {
	it('tears the session down when the provider rejects the refresh token', async () => {
		// `invalid_grant` means the token is gone — revoked, expired, or already
		// redeemed by someone else. Retrying into a loop helps nobody.
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(
			() =>
				new Response(JSON.stringify({ error: 'invalid_grant' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
		);

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('SessionRevokedError');
		expect(await h.refresher.read('sess_1')).toBeUndefined();
	});

	it('emits an auditable event when the provider rejects the token', async () => {
		// A single occurrence is unremarkable — consent revoked upstream looks the
		// same. A burst of them across many sessions does not, and an operator can
		// only see that if the event is emitted every time.
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const store = createMemorySessionStore(clock);
		const events: { familyId: string; subject: string }[] = [];

		const refresher = createTokenRefresher({
			tokenEndpoint: TOKEN_ENDPOINT,
			clientId: 'c',
			clientSecret: 's',
			providerId: 'fake',
			storage,
			store,
			clock,
			onReuseDetected: (event) =>
				events.push({ familyId: event.familyId, subject: event.subject }),
			fetch: () =>
				Promise.resolve(
					new Response(JSON.stringify({ error: 'invalid_grant' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					})
				),
		});

		await refresher.remember({
			sessionId: 'sess_1',
			subject: 'u_1',
			accessToken: 'a',
			refreshToken: 'r',
			expiresInSeconds: 60,
		});
		clock.advance(60_000);

		await refresher.getAccessToken('sess_1');

		expect(events).toHaveLength(1);
		expect(events[0]?.subject).toBe('u_1');
	});

	it('does not sign the subject out of their other sessions', async () => {
		// The deliberately narrow cascade. As a client we cannot tell a stolen
		// token from consent revoked upstream, and nuking every device over an
		// ambiguous signal is a worse bug than the one being defended against.
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const store = createMemorySessionStore(clock);

		let destroyForSubjectCalls = 0;

		const refresher = createTokenRefresher({
			tokenEndpoint: TOKEN_ENDPOINT,
			clientId: 'c',
			clientSecret: 's',
			providerId: 'fake',
			storage,
			store: {
				...store,
				destroyForSubject: async (subject) => {
					destroyForSubjectCalls += 1;
					return store.destroyForSubject(subject);
				},
			},
			clock,
			fetch: () =>
				Promise.resolve(
					new Response(JSON.stringify({ error: 'invalid_grant' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					})
				),
		});

		await refresher.remember({
			sessionId: 'sess_1',
			subject: 'u_1',
			accessToken: 'a',
			refreshToken: 'r',
			expiresInSeconds: 60,
		});
		clock.advance(60_000);

		await refresher.getAccessToken('sess_1');

		expect(destroyForSubjectCalls).toBe(0);
	});

	it('tombstones the family on forget, so a captured token is useless afterwards', async () => {
		const h = harness();
		await seed(h);

		await h.refresher.forget('sess_1');

		// Even if the record were somehow restored, the family tombstone stands.
		await seed(h);
		const restored = await h.refresher.read('sess_1');
		expect(restored).toBeDefined();

		// A fresh family id is minted by `remember`, so this session is usable
		// again — what must not happen is the *old* family coming back to life.
		expect((await h.refresher.getAccessToken('sess_1')).ok).toBe(true);
	});

	it('refuses a session whose family has been revoked', async () => {
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const store = createMemorySessionStore(clock);

		const refresher = createTokenRefresher({
			tokenEndpoint: TOKEN_ENDPOINT,
			clientId: 'c',
			clientSecret: 's',
			providerId: 'fake',
			storage,
			store,
			clock,
			fetch: () => Promise.reject(new Error('should not be called')),
		});

		await refresher.remember({
			sessionId: 'sess_1',
			subject: 'u_1',
			accessToken: 'a',
			refreshToken: 'r',
		});

		const record = await refresher.read('sess_1');
		expect(record).toBeDefined();
		if (record === undefined) return;

		await storage.namespace('oauth-revoked-families').set(record.familyId, true);

		const result = await refresher.getAccessToken('sess_1');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('SessionRevokedError');
	});
});

describe('classifyRefreshToken', () => {
	const record: TokenRecord = {
		familyId: 'fam_1',
		subject: 'u_1',
		accessToken: 'a',
		accessTokenExpiresAt: 2_000_000,
		refreshToken: 'current',
		previousRefreshToken: 'previous',
		previousValidUntil: 1_000_000,
	};

	it('recognises the current token', () => {
		expect(classifyRefreshToken(record, 'current', 500_000)).toBe('current');
	});

	it('treats the immediately previous token inside the window as a retry', () => {
		// A lost response makes an honest client retry with the token it still
		// holds. Calling that theft signs real users out over a flaky network.
		expect(classifyRefreshToken(record, 'previous', 999_999)).toBe('overlap');
		expect(classifyRefreshToken(record, 'previous', 1_000_000)).toBe('overlap');
	});

	it('treats the previous token after the window as reuse', () => {
		expect(classifyRefreshToken(record, 'previous', 1_000_001)).toBe('reuse');
	});

	it('treats an unrelated token as reuse', () => {
		// Nothing legitimate still holds a token that was rotated away two
		// generations ago.
		expect(classifyRefreshToken(record, 'ancient', 500_000)).toBe('reuse');
		expect(classifyRefreshToken(record, '', 500_000)).toBe('reuse');
	});

	it('treats any non-current token as reuse when no overlap was recorded', () => {
		const noOverlap: TokenRecord = {
			familyId: 'fam_1',
			subject: 'u_1',
			accessToken: 'a',
			accessTokenExpiresAt: 2_000_000,
			refreshToken: 'current',
		};

		expect(classifyRefreshToken(noOverlap, 'previous', 1)).toBe('reuse');
	});
});

describe('failure handling', () => {
	it('reports an unreachable token endpoint without throwing', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(() => Promise.reject(new Error('ECONNREFUSED')));

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'network' });
	});

	it('keeps the session alive on a transient 5xx', async () => {
		// A provider blip is not a revocation. Tearing the session down here would
		// sign everyone out during someone else's incident.
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(() => new Response('nope', { status: 503 }));

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'token' });
		expect(await h.refresher.read('sess_1')).toBeDefined();
	});

	it('reports an unparseable token response', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(() => new Response('<html>error</html>', { status: 200 }));

		expect((await h.refresher.getAccessToken('sess_1')).ok).toBe(false);
	});

	it('reports a missing session rather than throwing', async () => {
		const h = harness();

		const result = await h.refresher.getAccessToken('never-existed');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('SessionRevokedError');
	});

	it('does not call the endpoint when no refresh token is held', async () => {
		// A grant without a refresh token cannot be refreshed, and a round-trip
		// that the provider will certainly reject is pure latency.
		const h = harness();
		await h.refresher.remember({
			sessionId: 'sess_1',
			subject: 'u_1',
			accessToken: 'access-only',
			expiresInSeconds: 60,
		});
		h.clock.advance(60_000);

		const result = await h.refresher.getAccessToken('sess_1');

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'no-refresh-token' });
		expect(h.calls()).toBe(0);
	});

	it('recovers on a later attempt after a transient failure', async () => {
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(() => new Response('nope', { status: 503 }));
		expect((await h.refresher.getAccessToken('sess_1')).ok).toBe(false);

		h.setResponder(
			() =>
				new Response(
					JSON.stringify({
						access_token: 'recovered',
						refresh_token: 'refresh-next',
						expires_in: 3600,
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
		);

		const result = await h.refresher.getAccessToken('sess_1');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.accessToken).toBe('recovered');
	});
});

describe('providers that do not rotate', () => {
	it('carries the same refresh token forward without inventing an overlap', async () => {
		// Not every provider rotates. Recording a bogus "previous" token would
		// create an overlap window around a token that is still current.
		const h = harness();
		await seed(h, 60);
		h.clock.advance(60_000);

		h.setResponder(
			() =>
				new Response(
					JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				)
		);

		await h.refresher.getAccessToken('sess_1');

		const record = await h.refresher.read('sess_1');
		expect(record?.refreshToken).toBe('refresh-0');
		expect(record?.previousRefreshToken).toBeUndefined();
		expect(record?.previousValidUntil).toBeUndefined();
	});
});
