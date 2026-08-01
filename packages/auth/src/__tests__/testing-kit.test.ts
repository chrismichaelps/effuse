import { describe, expect, it } from 'vitest';
import { claim } from '../claims.js';
import { createAuthServer } from '../server/create-auth-server.js';
import { createPolicies, createPolicyRegistry } from '../server/index.js';
import { createPolicyGuard } from '../server/policy/guard.js';
import {
	createTestEnvironment,
	createTestSession,
	TEST_SECRET,
} from '../testing/index.js';
import { defineAuth } from '../config.js';

const claims = {
	role: claim.enum(['admin', 'member']),
	displayName: claim.string(),
	email: claim.string({ expose: false }),
};

const values = {
	role: 'admin',
	displayName: 'Ada',
	email: 'ada@example.com',
} as const;

describe('createTestSession', () => {
	it('produces a session the real engine accepts', async () => {
		// The property that matters. A stub returning `{ user: ... }` would prove
		// only that a test double matches its author's assumptions; this proves the
		// production code path accepts the cookie because it is genuinely valid.
		const fixture = await createTestSession({ claims, values });

		const resolved = await fixture.auth.fromRequest(fixture.request());

		expect(resolved.error).toBeUndefined();
		expect(resolved.session?.subject).toBe('test-subject');
		expect(resolved.session?.claims.role).toBe('admin');
	});

	it('is accepted by an independently constructed server', async () => {
		// Stronger still: a server built from scratch, sharing only the secret and
		// the storage, reads the session. Nothing about the fixture's own instance
		// is doing the work.
		const { clock, storage } = createTestEnvironment();
		const fixture = await createTestSession({ claims, values, clock, storage });

		const independent = createAuthServer(
			defineAuth({
				secrets: [TEST_SECRET],
				claims,
				cookie: { secure: false, hostPrefix: false },
			}),
			{ storage, clock }
		);

		const resolved = await independent.fromRequest(fixture.request());

		expect(resolved.session?.claims.displayName).toBe('Ada');
	});

	it('hands back a token that verifies', async () => {
		const fixture = await createTestSession({ claims, values });

		expect(fixture.token.length).toBeGreaterThan(0);

		const read = await fixture.auth.engine.read(fixture.token);
		expect(read.ok).toBe(true);
	});

	it('reassembles a token from a chunked session', async () => {
		// A large session is split across cookies. Returning only the first
		// fragment would give a token that never verifies, and the failure would
		// look like a signing bug rather than a helper bug.
		const fixture = await createTestSession({
			claims,
			values: { ...values, displayName: 'A'.repeat(9000) },
			config: { session: { strategy: 'stateless' } },
		});

		expect(fixture.setCookies.length).toBeGreaterThan(1);

		const read = await fixture.auth.engine.read(fixture.token);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(read.session.claims.displayName).toBe('A'.repeat(9000));
	});

	it('builds requests carrying the session, with the caller\'s own headers kept', async () => {
		const fixture = await createTestSession({ claims, values });

		const request = fixture.request('https://app.example.com/api/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
		});

		expect(request.method).toBe('POST');
		expect(request.headers.get('content-type')).toBe('application/json');
		expect(request.headers.get('cookie')).toContain('effuse.session');
	});

	it('preserves headers supplied in every HeadersInit form', async () => {
		// `HeadersInit` is a union, and an object spread over the `Headers` or
		// `string[][]` forms yields numeric indices — silently dropping everything
		// the caller set.
		const fixture = await createTestSession({ claims, values });

		const fromHeaders = fixture.request('https://app.example.com/', {
			headers: new Headers({ 'x-trace': 'abc' }),
		});
		const fromEntries = fixture.request('https://app.example.com/', {
			headers: [['x-trace', 'abc']],
		});
		const fromObject = fixture.request('https://app.example.com/', {
			headers: { 'x-trace': 'abc' },
		});

		for (const request of [fromHeaders, fromEntries, fromObject]) {
			expect(request.headers.get('x-trace')).toBe('abc');
			expect(request.headers.get('cookie')).toContain('effuse.session');
		}
	});

	it('accepts a custom subject', async () => {
		const fixture = await createTestSession({
			claims,
			values,
			subject: 'u_custom',
		});

		expect(fixture.session.subject).toBe('u_custom');
	});

	it('shares its clock, so expiry is testable without sleeping', async () => {
		const { clock, storage } = createTestEnvironment();
		const fixture = await createTestSession({
			claims,
			values,
			clock,
			storage,
			config: { session: { idleTtlMs: 60_000, absoluteTtlMs: 120_000 } },
		});

		expect((await fixture.auth.fromRequest(fixture.request())).session).toBeDefined();

		clock.advance(61_000);

		const expired = await fixture.auth.fromRequest(fixture.request());
		expect(expired.session).toBeUndefined();
		expect(expired.error?._tag).toBe('SessionExpiredError');
	});

	it('throws with a useful message when the claims do not match the shape', async () => {
		// A helper that silently returns an unusable session produces failures
		// pointing at the wrong place.
		await expect(
			createTestSession({
				claims,
				// @ts-expect-error deliberately wrong, to exercise the runtime guard
				values: { role: 'superadmin', displayName: 'Ada', email: 'a@b.c' },
			})
		).rejects.toThrow(/createTestSession/);
	});
});

describe('driving a guarded route end to end', () => {
	// The whole point of the kit: testing an authenticated, authorised route
	// should be three lines, not a sign-in flow.
	const buildGuard = () => {
		const p = createPolicies<typeof claims>();

		return createPolicyRegistry<typeof claims>()
			.protect({ path: '/api/*', policy: p.authenticated() })
			.protect({ path: '/api/admin/*', policy: p.claim('role', 'admin') });
	};

	it('permits an admin fixture through an admin-only route', async () => {
		const fixture = await createTestSession({ claims, values });

		const guard = createPolicyGuard({
			registry: buildGuard(),
			resolveSession: (request) => fixture.auth.fromRequest(request),
		});

		const outcome = await guard.check(
			fixture.request('https://app.example.com/api/admin/users')
		);

		expect(outcome.allowed).toBe(true);
	});

	it('refuses a member fixture on the same route', async () => {
		const fixture = await createTestSession({
			claims,
			values: { ...values, role: 'member' },
		});

		const guard = createPolicyGuard({
			registry: buildGuard(),
			resolveSession: (request) => fixture.auth.fromRequest(request),
		});

		const outcome = await guard.check(
			fixture.request('https://app.example.com/api/admin/users')
		);

		expect(outcome.allowed).toBe(false);
		if (outcome.allowed) return;
		expect(outcome.status).toBe(403);
	});

	it('refuses a request carrying no fixture cookie', async () => {
		const fixture = await createTestSession({ claims, values });

		const guard = createPolicyGuard({
			registry: buildGuard(),
			resolveSession: (request) => fixture.auth.fromRequest(request),
		});

		const outcome = await guard.check(
			new Request('https://app.example.com/api/admin/users')
		);

		expect(outcome.allowed).toBe(false);
		if (outcome.allowed) return;
		expect(outcome.status).toBe(401);
	});
});

describe('createTestEnvironment', () => {
	it('pairs a controllable clock with storage that honours it', async () => {
		const { clock, storage } = createTestEnvironment();

		await storage.set('k', 'v', { ttlMs: 1000 });
		expect(await storage.get('k')).toBe('v');

		clock.advance(1001);

		expect(await storage.get('k')).toBeUndefined();
	});

	it('starts at a fixed instant, so fixtures are reproducible', () => {
		expect(createTestEnvironment().clock.now()).toBe(
			createTestEnvironment().clock.now()
		);
	});
});
