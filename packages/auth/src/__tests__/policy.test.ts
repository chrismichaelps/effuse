import { describe, expect, expectTypeOf, it } from 'vitest';
import { claim, type InferClaims } from '../claims.js';
import { createPolicies, type PolicyContext } from '../server/policy/predicates.js';
import { createPolicyRegistry } from '../server/policy/registry.js';
import {
	PolicyCoverageError,
	assertPolicyCoverage,
	auditPolicyCoverage,
	formatCoverageReport,
} from '../server/policy/audit.js';
import { createPolicyGuard } from '../server/policy/guard.js';
import type { Session } from '../server/session-engine.js';
import type { SessionId } from '../contract.js';

const shape = {
	role: claim.enum(['admin', 'editor', 'member']),
	tenantId: claim.string(),
	seats: claim.number(),
};

type Shape = typeof shape;

const p = createPolicies<Shape>();

const sessionWith = (
	claims: Partial<InferClaims<Shape>> = {}
): Session<Shape> => ({
	id: 'sid' as SessionId,
	subject: 'u_1',
	claims: {
		role: 'member',
		tenantId: 'tenant_1',
		seats: 3,
		...claims,
	} as InferClaims<Shape>,
	createdAt: 0,
	lastSeenAt: 0,
	absoluteExpiresAt: Number.MAX_SAFE_INTEGER,
});

const context = (
	session: Session<Shape> | undefined,
	overrides: Partial<PolicyContext<Shape>> = {}
): PolicyContext<Shape> => ({
	session,
	method: 'GET',
	path: '/',
	...overrides,
});

describe('type safety', () => {
	it('narrows claim values to the declared union', () => {
		// The point of binding builders to the shape: a typo in a role name is a
		// build failure, not a comparison that is silently always false — which
		// looks exactly like a working deny and is why these survive review.
		expectTypeOf(p.claim<'role'>).parameter(1).toEqualTypeOf<
			'admin' | 'editor' | 'member'
		>();
	});

	it('rejects an unknown claim key at compile time', () => {
		// @ts-expect-error 'nope' is not a declared claim
		p.claim('nope', 'x');

		// @ts-expect-error 'superadmin' is not in the declared union
		p.claim('role', 'superadmin');

		// @ts-expect-error seats is a number, not a string
		p.claim('seats', 'three');

		expect(true).toBe(true);
	});
});

describe('authenticated', () => {
	it('permits a session and denies anonymity with 401', async () => {
		expect(await p.authenticated().evaluate(context(sessionWith()))).toEqual({
			allowed: true,
		});

		const denied = await p.authenticated().evaluate(context(undefined));
		expect(denied.allowed).toBe(false);
		if (denied.allowed) return;
		expect(denied.status).toBe(401);
	});
});

describe('claim', () => {
	it('permits a matching claim and denies a mismatch with 403', async () => {
		const policy = p.claim('role', 'admin');

		expect(
			await policy.evaluate(context(sessionWith({ role: 'admin' })))
		).toEqual({ allowed: true });

		const denied = await policy.evaluate(
			context(sessionWith({ role: 'member' }))
		);
		expect(denied.allowed).toBe(false);
		if (denied.allowed) return;
		// 403, not 401: they are signed in, and signing in again will not help.
		expect(denied.status).toBe(403);
	});

	it('denies anonymity with 401 rather than reading undefined', async () => {
		// A claim policy used without `authenticated()` beside it must not compare
		// against an absent session and fall through.
		const denied = await p.claim('role', 'admin').evaluate(context(undefined));

		expect(denied.allowed).toBe(false);
		if (denied.allowed) return;
		expect(denied.status).toBe(401);
	});

	it('accepts any of several values with claimIn', async () => {
		const policy = p.claimIn('role', ['admin', 'editor']);

		expect((await policy.evaluate(context(sessionWith({ role: 'editor' })))).allowed).toBe(true);
		expect((await policy.evaluate(context(sessionWith({ role: 'member' })))).allowed).toBe(false);
	});
});

describe('composition', () => {
	it('requires every member of all()', async () => {
		const policy = p.all(p.authenticated(), p.claim('role', 'admin'));

		expect((await policy.evaluate(context(sessionWith({ role: 'admin' })))).allowed).toBe(true);
		expect((await policy.evaluate(context(sessionWith({ role: 'member' })))).allowed).toBe(false);
	});

	it('reports the first failure, so status reflects the earliest reason', async () => {
		// An anonymous caller should get 401 from the authentication check, not
		// 403 from a later claim check that only failed because nobody is signed in.
		const policy = p.all(p.authenticated(), p.claim('role', 'admin'));

		const denied = await policy.evaluate(context(undefined));
		expect(denied.allowed).toBe(false);
		if (denied.allowed) return;
		expect(denied.status).toBe(401);
	});

	it('requires one member of any()', async () => {
		const policy = p.any(p.claim('role', 'admin'), p.claim('role', 'editor'));

		expect((await policy.evaluate(context(sessionWith({ role: 'editor' })))).allowed).toBe(true);
		expect((await policy.evaluate(context(sessionWith({ role: 'member' })))).allowed).toBe(false);
	});

	it('denies an empty any() rather than permitting everything', async () => {
		// A disjunction over nothing permits nothing. Returning allow here would
		// mean `any()` silently opened a route.
		expect((await p.any().evaluate(context(sessionWith()))).allowed).toBe(false);
	});

	it('denies an empty all() rather than permitting everything', async () => {
		// Vacuous truth would be technically defensible and operationally awful:
		// `all(...roles)` with an empty list would open the route.
		const policy = p.all();
		expect(policy.isPublic).toBe(false);
	});

	it('requires a session even under not()', async () => {
		// Without this, `not(claim('role','banned'))` permits anonymous callers,
		// because an absent session trivially fails the inner policy.
		const policy = p.not(p.claim('role', 'admin'));

		const denied = await policy.evaluate(context(undefined));
		expect(denied.allowed).toBe(false);
		if (denied.allowed) return;
		expect(denied.status).toBe(401);

		expect((await policy.evaluate(context(sessionWith({ role: 'member' })))).allowed).toBe(true);
		expect((await policy.evaluate(context(sessionWith({ role: 'admin' })))).allowed).toBe(false);
	});

	it('treats a conjunction as public only when every member is', async () => {
		expect(p.all(p.public(), p.public()).isPublic).toBe(true);
		expect(p.all(p.public(), p.authenticated()).isPublic).toBe(false);
	});
});

describe('custom predicates', () => {
	it('permits when the predicate holds', async () => {
		const policy = p.custom(
			'same-tenant',
			({ session }) => session?.claims.tenantId === 'tenant_1'
		);

		expect((await policy.evaluate(context(sessionWith()))).allowed).toBe(true);
	});

	it('denies when the predicate throws, rather than failing open', async () => {
		// A bug in someone's policy must not become an authorization bypass.
		const policy = p.custom('throws', () => {
			throw new Error('boom');
		});

		expect((await policy.evaluate(context(sessionWith()))).allowed).toBe(false);
	});

	it('receives the request context, so method and path are inspectable', async () => {
		const seen: string[] = [];
		const policy = p.custom('records', ({ method, path }) => {
			seen.push(`${method} ${path}`);
			return true;
		});

		await policy.evaluate(context(sessionWith(), { method: 'POST', path: '/x' }));

		expect(seen).toEqual(['POST /x']);
	});
});

describe('registry matching', () => {
	it('matches an exact path', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/admin',
			policy: p.claim('role', 'admin'),
		});

		expect(registry.resolve('/admin', 'GET').policy).toBeDefined();
		expect(registry.resolve('/admin/users', 'GET').policy).toBeUndefined();
	});

	it('matches a trailing wildcard', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/admin/*',
			policy: p.claim('role', 'admin'),
		});

		expect(registry.resolve('/api/admin', 'GET').policy).toBeDefined();
		expect(registry.resolve('/api/admin/users', 'GET').policy).toBeDefined();
		expect(registry.resolve('/api/admin/users/42', 'GET').policy).toBeDefined();
		expect(registry.resolve('/api/public', 'GET').policy).toBeUndefined();
	});

	it('matches a parameter segment but not an absent one', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/users/:id',
			policy: p.authenticated(),
		});

		expect(registry.resolve('/users/42', 'GET').policy).toBeDefined();
		expect(registry.resolve('/users', 'GET').policy).toBeUndefined();
		expect(registry.resolve('/users/42/posts', 'GET').policy).toBeUndefined();
	});

	it('applies to every method when none are declared', () => {
		// Guarding only the methods someone remembered to list is how a route ends
		// up with a protected GET and an open POST.
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/admin',
			policy: p.claim('role', 'admin'),
		});

		for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
			expect(registry.resolve('/admin', method).policy).toBeDefined();
		}
	});

	it('narrows to declared methods when they are given', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/admin',
			methods: ['POST'],
			policy: p.claim('role', 'admin'),
		});

		expect(registry.resolve('/admin', 'POST').policy).toBeDefined();
		expect(registry.resolve('/admin', 'GET').policy).toBeUndefined();
	});

	it('matches methods case-insensitively', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/admin',
			methods: ['post'],
			policy: p.authenticated(),
		});

		expect(registry.resolve('/admin', 'POST').policy).toBeDefined();
	});
});

describe('rule combination', () => {
	it('combines overlapping rules with AND, so adding one can only narrow', async () => {
		// The security property. With most-specific-wins, adding a rule to a
		// specific path silently widens what a broad rule was guarding, and the
		// diff only shows a rule being added.
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/*', policy: p.authenticated() })
			.protect({ path: '/api/admin/*', policy: p.claim('role', 'admin') });

		const match = registry.resolve('/api/admin/users', 'GET');
		expect(match.rules).toHaveLength(2);

		const policy = match.policy;
		expect(policy).toBeDefined();
		if (policy === undefined) return;

		expect((await policy.evaluate(context(undefined))).allowed).toBe(false);
		expect(
			(await policy.evaluate(context(sessionWith({ role: 'member' })))).allowed
		).toBe(false);
		expect(
			(await policy.evaluate(context(sessionWith({ role: 'admin' })))).allowed
		).toBe(true);
	});

	it('orders rules least specific first', () => {
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/admin/users', policy: p.claim('role', 'admin') })
			.protect({ path: '/api/*', policy: p.authenticated() });

		const match = registry.resolve('/api/admin/users', 'GET');

		expect(match.rules[0]?.path).toBe('/api/*');
		expect(match.rules[1]?.path).toBe('/api/admin/users');
	});

	it('lets an explicit override discard broader rules', async () => {
		// The escape hatch for making one route more permissive than its prefix.
		// Explicit, because a silent override is a widening nobody reviewed.
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/*', policy: p.claim('role', 'admin') })
			.protect({ path: '/api/health', policy: p.public(), override: true });

		const policy = registry.resolve('/api/health', 'GET').policy;
		expect(policy).toBeDefined();
		if (policy === undefined) return;

		expect((await policy.evaluate(context(undefined))).allowed).toBe(true);
	});

	it('keeps the broad rule in force for paths the override does not cover', async () => {
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/*', policy: p.claim('role', 'admin') })
			.protect({ path: '/api/health', policy: p.public(), override: true });

		const policy = registry.resolve('/api/secrets', 'GET').policy;
		expect(policy).toBeDefined();
		if (policy === undefined) return;

		expect((await policy.evaluate(context(undefined))).allowed).toBe(false);
	});
});

describe('coverage audit', () => {
	const manifest = {
		routes: [
			{ layer: 'app', path: '/api/admin/users', methods: ['GET', 'POST'] },
			{ layer: 'app', path: '/api/profile', methods: ['GET'] },
			{ layer: 'app', path: '/health', methods: ['GET'] },
		],
		actions: [{ layer: 'app', name: 'deleteAccount', path: '/_action/delete' }],
	};

	it('enumerates every route and method', () => {
		// The question scattered conditionals cannot answer: which routes are open?
		const registry = createPolicyRegistry<Shape>();
		const report = auditPolicyCoverage(manifest, registry);

		expect(report.totals.routes).toBe(5);
		expect(report.entries.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
			'GET /api/admin/users',
			'POST /api/admin/users',
			'GET /api/profile',
			'GET /health',
			'POST /_action/delete',
		]);
	});

	it('reports a route whose GET is guarded and whose POST is not', () => {
		// The hole that "the route is covered" would hide.
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/admin/users',
			methods: ['GET'],
			policy: p.claim('role', 'admin'),
		});

		const report = auditPolicyCoverage(manifest, registry);
		const holes = report.unprotected.map(
			(entry) => `${entry.method} ${entry.path}`
		);

		expect(holes).toContain('POST /api/admin/users');
		expect(holes).not.toContain('GET /api/admin/users');
	});

	it('distinguishes deliberately public from simply undeclared', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/health',
			policy: p.public(),
		});

		const report = auditPolicyCoverage(manifest, registry);

		expect(report.publicEntries.map((entry) => entry.path)).toEqual(['/health']);
		expect(report.unprotected.map((entry) => entry.path)).not.toContain('/health');
	});

	it('covers server actions, which are state-changing by definition', () => {
		const registry = createPolicyRegistry<Shape>();
		const report = auditPolicyCoverage(manifest, registry);

		const action = report.entries.find((entry) => entry.path === '/_action/delete');
		expect(action?.method).toBe('POST');
		expect(action?.unprotected).toBe(true);
	});

	it('honours an explicit exemption list', () => {
		const registry = createPolicyRegistry<Shape>();
		const report = auditPolicyCoverage(manifest, registry, {
			allowUnprotected: ['/health'],
		});

		expect(report.unprotected.map((entry) => entry.path)).not.toContain('/health');
	});

	it('records which rules applied', () => {
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/*', policy: p.authenticated() })
			.protect({ path: '/api/admin/*', policy: p.claim('role', 'admin') });

		const report = auditPolicyCoverage(manifest, registry);
		const entry = report.entries.find(
			(candidate) => candidate.path === '/api/admin/users'
		);

		expect(entry?.rules).toEqual(['authenticated', 'claim:role=admin']);
	});
});

describe('deny by default', () => {
	const manifest = {
		routes: [{ path: '/api/secrets', methods: ['GET'] }],
	};

	it('throws when a route has no policy', () => {
		// The setting that turns a forgotten check from an incident into a failed
		// CI run.
		expect(() =>
			assertPolicyCoverage(manifest, createPolicyRegistry<Shape>())
		).toThrow(PolicyCoverageError);
	});

	it('names the offending routes in the message', () => {
		try {
			assertPolicyCoverage(manifest, createPolicyRegistry<Shape>());
			expect.unreachable('expected a PolicyCoverageError');
		} catch (error) {
			expect(error).toBeInstanceOf(PolicyCoverageError);
			expect((error as Error).message).toContain('GET /api/secrets');
		}
	});

	it('passes once every route is declared', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/secrets',
			policy: p.claim('role', 'admin'),
		});

		expect(() => assertPolicyCoverage(manifest, registry)).not.toThrow();
	});

	it('accepts an explicitly public declaration', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/secrets',
			policy: p.public(),
		});

		expect(() => assertPolicyCoverage(manifest, registry)).not.toThrow();
	});

	it('renders a readable report', () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/secrets',
			policy: p.claim('role', 'admin'),
		});

		const rendered = formatCoverageReport(
			auditPolicyCoverage(manifest, registry)
		);

		expect(rendered).toContain('/api/secrets');
		expect(rendered).toContain('protected');
	});
});

describe('the request guard', () => {
	const buildGuard = (
		session: Session<Shape> | undefined,
		unmatched: 'deny' | 'allow' = 'deny'
	) => {
		const registry = createPolicyRegistry<Shape>()
			.protect({ path: '/api/*', policy: p.authenticated() })
			.protect({ path: '/api/admin/*', policy: p.claim('role', 'admin') });

		return createPolicyGuard<Shape>({
			registry,
			resolveSession: () => Promise.resolve({ session }),
			unmatched,
		});
	};

	const request = (path: string, method = 'GET'): Request =>
		new Request(`https://app.example.com${path}`, { method });

	it('permits an authorised request', async () => {
		const guard = buildGuard(sessionWith({ role: 'admin' }));

		const outcome = await guard.check(request('/api/admin/users'));
		expect(outcome.allowed).toBe(true);
	});

	it('denies an under-privileged request with 403', async () => {
		const guard = buildGuard(sessionWith({ role: 'member' }));

		const outcome = await guard.check(request('/api/admin/users'));
		expect(outcome.allowed).toBe(false);
		if (outcome.allowed) return;
		expect(outcome.status).toBe(403);
		expect(outcome.error._tag).toBe('ForbiddenError');
	});

	it('denies an anonymous request with 401', async () => {
		const guard = buildGuard(undefined);

		const outcome = await guard.check(request('/api/admin/users'));
		expect(outcome.allowed).toBe(false);
		if (outcome.allowed) return;
		expect(outcome.status).toBe(401);
	});

	it('denies an unmatched route by default', async () => {
		// Defaulting open for exactly the routes nobody declared is the wrong way
		// round.
		const guard = buildGuard(sessionWith({ role: 'admin' }));

		const outcome = await guard.check(request('/undeclared'));
		expect(outcome.allowed).toBe(false);
	});

	it('permits an unmatched route only when explicitly configured to', async () => {
		const guard = buildGuard(sessionWith({ role: 'admin' }), 'allow');

		expect((await guard.check(request('/undeclared'))).allowed).toBe(true);
	});

	it('guards every method of a matched path', async () => {
		// The bypass this closes: a guard bound to GET leaving POST open.
		const guard = buildGuard(sessionWith({ role: 'member' }));

		for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
			const outcome = await guard.check(request('/api/admin/users', method));
			expect(outcome.allowed).toBe(false);
		}
	});

	it('produces a response whose body names no policy', async () => {
		// A message naming the missing role tells a prober exactly what to obtain.
		const guard = buildGuard(sessionWith({ role: 'member' }));

		const { response } = await guard.protect(request('/api/admin/users'));
		expect(response).toBeDefined();
		if (response === undefined) return;

		expect(response.status).toBe(403);
		const body = (await response.json()) as { message: string };
		expect(body.message).toBe('You do not have access to this resource.');
		expect(JSON.stringify(body)).not.toContain('admin');
	});

	it('returns no response when the request is permitted', async () => {
		const guard = buildGuard(sessionWith({ role: 'admin' }));

		const { response, session } = await guard.protect(request('/api/admin/users'));

		expect(response).toBeUndefined();
		expect(session?.subject).toBe('u_1');
	});

	it('carries session-renewal cookies through a denial', async () => {
		// The session may have slid its idle window even though the policy refused.
		// Dropping the cookie there would expire a session the user still holds.
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/api/*',
			policy: p.claim('role', 'admin'),
		});

		const guard = createPolicyGuard<Shape>({
			registry,
			resolveSession: () =>
				Promise.resolve({
					session: sessionWith({ role: 'member' }),
					setCookies: ['effuse.session=renewed'],
				}),
		});

		const outcome = await guard.check(request('/api/thing'));
		expect(outcome.setCookies).toEqual(['effuse.session=renewed']);
	});

	it('reports who was denied, not just that someone was', async () => {
		// "Which user was refused what" is the question an audit log has to answer.
		// Omitting the session on the denial branch makes every 403 anonymous.
		const guard = buildGuard(sessionWith({ role: 'member' }));

		const outcome = await guard.check(request('/api/admin/users'));
		expect(outcome.allowed).toBe(false);
		if (outcome.allowed) return;
		expect(outcome.session?.subject).toBe('u_1');
		expect(outcome.reason).toContain('role');

		const { session } = await guard.protect(request('/api/admin/users'));
		expect(session?.subject).toBe('u_1');
	});

	it('denies when the policy itself throws', async () => {
		const registry = createPolicyRegistry<Shape>().protect({
			path: '/*',
			policy: {
				name: 'explodes',
				isPublic: false,
				evaluate: () => {
					throw new Error('boom');
				},
			},
		});

		const guard = createPolicyGuard<Shape>({
			registry,
			resolveSession: () => Promise.resolve({ session: sessionWith() }),
		});

		expect((await guard.check(request('/anything'))).allowed).toBe(false);
	});

	it('evaluates internal and external callers identically', async () => {
		// Confused deputy: an internal caller must not reach a resource the
		// external path guards. There is no "trusted" flag to set.
		const guard = buildGuard(sessionWith({ role: 'member' }));

		const external = await guard.check(request('/api/admin/users'));
		const internal = await guard.check(
			new Request('https://app.example.com/api/admin/users', {
				headers: { 'x-internal': 'true' },
			})
		);

		expect(external.allowed).toBe(internal.allowed);
		expect(external.allowed).toBe(false);
	});
});
