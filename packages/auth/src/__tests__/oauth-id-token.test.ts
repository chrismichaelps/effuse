import { describe, expect, it } from 'vitest';
import { verifyIdToken } from '../server/oauth/id-token.js';
import { createJwksResolver } from '../server/oauth/jwks.js';
import { createFakeIdp, type FakeIdp } from '../testing/fake-idp.js';
import { createTestClock, type TestClock } from '../testing/index.js';

const setup = (): {
	idp: FakeIdp;
	clock: TestClock;
	verify: (token: string, overrides?: Record<string, unknown>) => ReturnType<typeof verifyIdToken>;
} => {
	const clock = createTestClock();
	const idp = createFakeIdp({ now: () => clock.now() });

	const jwks = createJwksResolver({
		jwksUri: `${idp.issuer}/jwks`,
		clock,
		fetch: idp.fetch(),
	});

	return {
		idp,
		clock,
		verify: (token, overrides = {}) =>
			verifyIdToken(token, {
				issuer: idp.issuer,
				audience: idp.audience,
				jwks,
				clock,
				...overrides,
			}),
	};
};

describe('valid tokens', () => {
	it('accepts a correctly signed token and returns its claims', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ subject: 'user-1' }));

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.claims.sub).toBe('user-1');
		expect(result.claims.iss).toBe(idp.issuer);
	});

	it('accepts a token whose nonce matches', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ nonce: 'n-123' }), { nonce: 'n-123' });

		expect(result.ok).toBe(true);
	});

	it('accepts an audience array containing this client, with azp naming us', async () => {
		const { idp, verify } = setup();

		const result = await verify(
			idp.mint({
				audience: [idp.audience, 'other-client'],
				claims: { azp: idp.audience },
			})
		);

		expect(result.ok).toBe(true);
	});

	it('accepts a matching at_hash', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ accessToken: 'access-token-value' }), {
			accessToken: 'access-token-value',
		});

		expect(result.ok).toBe(true);
	});
});

describe('signature forgery', () => {
	it('rejects a token signed with a key the provider does not publish', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ signWithForeignKey: true }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error._tag).toBe('ProviderError');
	});

	it('rejects a token with no signature at all', async () => {
		// The `alg: none` shape. Treating a signature-free token as merely
		// unsigned-but-otherwise-fine is the entire attack.
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ unsigned: true }));

		expect(result.ok).toBe(false);
	});

	it('rejects an HMAC algorithm, closing RS256-to-HS256 confusion', async () => {
		// The classic: re-sign with the provider's public key as an HMAC secret and
		// declare the algorithm symmetric. No HMAC algorithm is ever permitted for
		// an ID token here, so the header value has nowhere to go.
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ algorithm: 'HS256' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'alg' });
	});

	it('rejects an algorithm the provider does not advertise', async () => {
		const { idp, verify } = setup();

		// RS512 is implemented, but this provider only advertises RS256, so the
		// allowlist must still refuse it.
		const result = await verify(idp.mint({ algorithm: 'RS512' }), {
			allowedAlgorithms: ['RS256'],
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'alg' });
	});

	it('rejects a payload edited after signing', async () => {
		const { idp, verify } = setup();
		const token = idp.mint({ subject: 'user-1' });

		const [header, , signature] = token.split('.');
		const forged = Buffer.from(
			JSON.stringify({
				iss: idp.issuer,
				aud: idp.audience,
				sub: 'admin',
				iat: 1_699_999_000,
				exp: 1_799_999_000,
			}),
			'utf8'
		).toString('base64url');

		const result = await verify(`${header ?? ''}.${forged}.${signature ?? ''}`);

		expect(result.ok).toBe(false);
	});

	it('rejects a token referencing an unpublished key id', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ keyId: 'not-a-real-key' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'kid' });
	});
});

describe('claim validation', () => {
	it('rejects a token from a different issuer', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ issuer: 'https://evil.example' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'iss' });
	});

	it('rejects an issuer that merely shares a prefix with ours', async () => {
		const { idp, verify } = setup();

		const result = await verify(
			idp.mint({ issuer: `${idp.issuer}.evil.example` })
		);

		expect(result.ok).toBe(false);
	});

	it('rejects a token minted for a different client', async () => {
		// Token substitution: an assertion for another client must not be
		// redeemable here.
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ audience: 'someone-else' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'aud' });
	});

	it('rejects multiple audiences when azp does not name this client', async () => {
		// Otherwise a token issued to a third party that merely lists us is
		// accepted as our own.
		const { idp, verify } = setup();

		const result = await verify(
			idp.mint({
				audience: [idp.audience, 'other-client'],
				claims: { azp: 'other-client' },
			})
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'azp' });
	});

	it('rejects an expired token', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ expiresInSeconds: -3600 }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'exp' });
	});

	it('tolerates expiry within the clock-skew allowance', async () => {
		// Providers drift. Rejecting a token that expired thirty seconds ago would
		// produce sporadic, unexplainable sign-in failures.
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ expiresInSeconds: -30 }), {
			clockSkewMs: 60_000,
		});

		expect(result.ok).toBe(true);
	});

	it('rejects a token issued in the future beyond the skew allowance', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ issuedAtOffsetSeconds: 3600 }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'iat' });
	});

	it('rejects a token with no subject', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ claims: { sub: undefined } }));

		expect(result.ok).toBe(false);
	});
});

describe('replay protection', () => {
	it('rejects a mismatched nonce', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ nonce: 'attacker-nonce' }), {
			nonce: 'our-nonce',
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'nonce' });
	});

	it('rejects a token that omits the nonce entirely', async () => {
		// Stripping the claim must not turn the check off, or it becomes opt-out
		// for anyone able to influence the token.
		const { idp, verify } = setup();

		const result = await verify(idp.mint(), { nonce: 'our-nonce' });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'nonce' });
	});

	it('rejects a mismatched at_hash', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ accessToken: 'a-different-token' }), {
			accessToken: 'access-token-value',
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'at_hash' });
	});

	it('requires at_hash when an access token is supplied', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint(), { accessToken: 'access-token-value' });

		expect(result.ok).toBe(false);
	});

	it('enforces max_age against auth_time', async () => {
		const { idp, clock, verify } = setup();

		const token = idp.mint({
			claims: { auth_time: Math.floor(clock.now() / 1000) - 7200 },
		});

		const result = await verify(token, { maxAgeSeconds: 3600 });

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'auth_time' });
	});
});

describe('malformed input', () => {
	it('never throws, whatever arrives', async () => {
		const { verify } = setup();

		const inputs = [
			'',
			'.',
			'..',
			'a.b',
			'a.b.c.d',
			'not-a-token',
			'%%%.%%%.%%%',
			'\0',
			'a'.repeat(100_000),
			`${Buffer.from('{}').toString('base64url')}..`,
		];

		for (const input of inputs) {
			await expect(verify(input)).resolves.toMatchObject({ ok: false });
		}
	});

	it('keeps provider diagnostics out of the client-visible message', async () => {
		const { idp, verify } = setup();

		const result = await verify(idp.mint({ issuer: 'https://evil.example' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.safeMessage).toBe('Sign-in with this provider failed.');
		expect(result.error.safeMessage).not.toContain('evil.example');
	});
});

describe('jwks resolver', () => {
	it('caches keys rather than refetching per verification', async () => {
		const { idp, verify } = setup();

		for (let i = 0; i < 5; i += 1) {
			expect((await verify(idp.mint())).ok).toBe(true);
		}

		expect(idp.jwksRequestCount()).toBe(1);
	});

	it('rate-limits refetches triggered by unknown key ids', async () => {
		// Without the interval, a stream of forged tokens carrying random key ids
		// becomes a stream of requests to the provider — a denial-of-service lever
		// pointed at someone else's infrastructure.
		const { idp, verify } = setup();

		await verify(idp.mint());
		const afterFirst = idp.jwksRequestCount();

		for (let i = 0; i < 20; i += 1) {
			await verify(idp.mint({ keyId: `forged-${String(i)}` }));
		}

		expect(idp.jwksRequestCount() - afterFirst).toBeLessThanOrEqual(1);
	});

	it('refetches once the refetch interval has elapsed', async () => {
		const { idp, clock, verify } = setup();

		await verify(idp.mint());
		const afterFirst = idp.jwksRequestCount();

		clock.advance(6 * 60_000);
		await verify(idp.mint({ keyId: 'rotated-key' }));

		expect(idp.jwksRequestCount()).toBeGreaterThan(afterFirst);
	});

	it('refuses a plaintext jwks endpoint', async () => {
		// Keys fetched over http can be swapped in transit, at which point every
		// signature check is theatre.
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		const insecure = createJwksResolver({
			jwksUri: 'http://idp.example.com/jwks',
			clock,
			fetch: idp.fetch(),
		});

		expect(await insecure.get(idp.keyId)).toBeUndefined();
	});

	it('keeps serving cached keys when a refetch fails', async () => {
		// A provider blip must not sign every user out.
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		let failing = false;
		const jwks = createJwksResolver({
			jwksUri: `${idp.issuer}/jwks`,
			clock,
			fetch: (input) =>
				failing
					? Promise.reject(new Error('network down'))
					: idp.fetch()(input),
		});

		expect(await jwks.get(idp.keyId)).toBeDefined();

		failing = true;
		clock.advance(2 * 60 * 60_000);

		expect(await jwks.get(idp.keyId)).toBeDefined();
	});

	it('collapses concurrent fetches into one request', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		const jwks = createJwksResolver({
			jwksUri: `${idp.issuer}/jwks`,
			clock,
			fetch: idp.fetch(),
		});

		await Promise.all(
			Array.from({ length: 10 }, async () => jwks.get(idp.keyId))
		);

		expect(idp.jwksRequestCount()).toBe(1);
	});
});
