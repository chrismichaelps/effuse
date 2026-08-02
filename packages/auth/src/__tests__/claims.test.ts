import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	claim,
	decodeClaims,
	exposedClaims,
	type InferClaims,
} from '../claims.js';

const shape = {
	userId: claim.string(),
	role: claim.enum(['admin', 'member']),
	seats: claim.number(),
	verified: claim.boolean(),
	// Present on the server, never serialised to the browser.
	email: claim.string({ expose: false }),
	orgId: claim.string().optional(),
};

type Session = InferClaims<typeof shape>;

describe('claim inference', () => {
	it('infers the session type from the declaration alone', () => {
		// The whole point: one declaration, no `declare module` augmentation, no
		// second callback to keep in sync. If this compiles, the DX claim holds.
		expectTypeOf<Session>().toEqualTypeOf<{
			userId: string;
			role: 'admin' | 'member';
			seats: number;
			verified: boolean;
			email: string;
			orgId?: string;
		}>();
	});

	it('narrows enum claims to a literal union rather than string', () => {
		expectTypeOf<Session['role']>().toEqualTypeOf<'admin' | 'member'>();
	});
});

describe('decodeClaims', () => {
	const valid = {
		userId: 'u_1',
		role: 'admin',
		seats: 5,
		verified: true,
		email: 'a@example.com',
	};

	it('accepts a well-formed payload and drops unknown keys', () => {
		const result = decodeClaims(shape, { ...valid, injected: 'evil' });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual(valid);
		// An attacker who influences a payload must not be able to smuggle extra
		// keys through into anything that later reads the session by index.
		expect(result.value).not.toHaveProperty('injected');
	});

	it('rejects a missing required claim', () => {
		const { userId: _omitted, ...withoutUserId } = valid;
		const result = decodeClaims(shape, withoutUserId);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain('userId');
	});

	it('rejects a claim of the wrong type instead of coercing it', () => {
		// Coercion here would let `seats: "5"` from a tampered payload pass, and
		// downstream arithmetic would silently misbehave.
		expect(decodeClaims(shape, { ...valid, seats: '5' }).ok).toBe(false);
		expect(decodeClaims(shape, { ...valid, verified: 'true' }).ok).toBe(false);
		expect(decodeClaims(shape, { ...valid, seats: Number.NaN }).ok).toBe(false);
	});

	it('rejects an enum value outside the declared set', () => {
		const result = decodeClaims(shape, { ...valid, role: 'superadmin' });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain('role');
	});

	it('allows an omitted optional claim but still checks it when present', () => {
		expect(decodeClaims(shape, valid).ok).toBe(true);
		expect(decodeClaims(shape, { ...valid, orgId: 'org_1' }).ok).toBe(true);
		expect(decodeClaims(shape, { ...valid, orgId: 42 }).ok).toBe(false);
	});

	it('rejects a non-object payload without throwing', () => {
		expect(decodeClaims(shape, null).ok).toBe(false);
		expect(decodeClaims(shape, 'string').ok).toBe(false);
		expect(decodeClaims(shape, []).ok).toBe(false);
	});

	it('rejects prototype-polluting keys', () => {
		// `__proto__` arriving from a decoded token must never reach an object
		// assignment that could alter Object.prototype for the whole process.
		const hostile = JSON.parse(
			`{"userId":"u_1","role":"admin","seats":1,"verified":true,"email":"a@b.c","__proto__":{"polluted":true}}`
		) as unknown;
		const result = decodeClaims(shape, hostile);

		expect(result.ok).toBe(true);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});
});

describe('exposedClaims', () => {
	it('omits claims not marked for exposure', () => {
		// This is what stops a token, hash, or internal claim from being written
		// into server-rendered HTML for anyone to read.
		const session: Session = {
			userId: 'u_1',
			role: 'admin',
			seats: 5,
			verified: true,
			email: 'a@example.com',
		};

		const exposed = exposedClaims(shape, session);

		expect(exposed).toEqual({
			userId: 'u_1',
			role: 'admin',
			seats: 5,
			verified: true,
		});
		expect(exposed).not.toHaveProperty('email');
	});

	it('exposes by default so opting out is explicit and reviewable', () => {
		expect(claim.string().expose).toBe(true);
		expect(claim.string({ expose: false }).expose).toBe(false);
		// Optionality must not silently reset exposure.
		expect(claim.string({ expose: false }).optional().expose).toBe(false);
	});
});
