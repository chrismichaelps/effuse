import { describe, expect, it } from 'vitest';
import { createOAuthClient, type OAuthProvider } from '../server/oauth/flow.js';
import { createRedirectValidator } from '../server/oauth/redirect.js';
import { createFakeIdp, type FakeIdp } from '../testing/fake-idp.js';
import { createMemoryAuthStorage } from '../testing/storage.js';
import { createTestClock, type TestClock } from '../testing/index.js';

const REDIRECT_URI = 'https://app.example.com/auth/callback';

interface Profile {
	readonly id: string;
	readonly email: string | undefined;
}

const setup = (
	overrides: Partial<OAuthProvider<Profile>> = {}
): {
	idp: FakeIdp;
	clock: TestClock;
	client: ReturnType<typeof createOAuthClient<Profile>>;
} => {
	const clock = createTestClock();
	const idp = createFakeIdp({ now: () => clock.now() });

	const provider: OAuthProvider<Profile> = {
		id: 'fake',
		clientId: idp.audience,
		clientSecret: 'client-secret',
		issuer: idp.issuer,
		profile: (claims) => ({
			id: claims.sub,
			email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
		}),
		...overrides,
	};

	return {
		idp,
		clock,
		client: createOAuthClient<Profile>({
			provider,
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: idp.fetch(),
		}),
	};
};

/** Turns `Set-Cookie` headers into a `Cookie` request header. */
const cookieHeader = (setCookies: readonly string[]): string =>
	setCookies.map((header) => header.split(';')[0]).join('; ');

const callbackRequest = (url: string, setCookies: readonly string[]): Request =>
	new Request(url, { headers: { cookie: cookieHeader(setCookies) } });

describe('the happy path', () => {
	it('completes a full sign-in and returns the mapped profile', async () => {
		const { idp, client } = setup();

		const started = await client.start({ redirectTo: '/dashboard' });
		expect(started.ok).toBe(true);
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.profile.id).toBe('user-abc');
		expect(result.tokens.accessToken).toMatch(/^access-/);
		expect(result.tokens.refreshToken).toMatch(/^refresh-/);
		expect(result.redirectTo).toBe('https://app.example.com/dashboard');
	});

	it('sends a PKCE challenge, state, and nonce on the authorization request', async () => {
		const { client } = setup();

		const started = await client.start();
		expect(started.ok).toBe(true);
		if (!started.ok) return;

		const url = new URL(started.authorizationUrl);

		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('code_challenge')).toBeTruthy();
		expect(url.searchParams.get('state')).toBeTruthy();
		expect(url.searchParams.get('nonce')).toBeTruthy();
		expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
	});

	it('binds the flow to the browser with an HttpOnly cookie', async () => {
		const { client } = setup();

		const started = await client.start();
		expect(started.ok).toBe(true);
		if (!started.ok) return;

		expect(started.setCookies.length).toBeGreaterThan(0);
		expect(started.setCookies[0]).toContain('HttpOnly');
		expect(started.setCookies[0]).toContain('Secure');
	});

	it('clears the flow cookie once the callback completes', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.setCookies.some((header) => header.includes('Max-Age=0'))).toBe(
			true
		);
	});

	it('reports whether the provider asserts the email is verified', async () => {
		// Automatic linking on an unverified email is the most common OAuth
		// account-takeover vector, so this has to be surfaced rather than assumed.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		idp.setNextIdTokenOverrides({
			claims: { email: 'ada@example.com', email_verified: false },
		});

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.emailVerified).toBe(false);
		expect(result.profile.email).toBe('ada@example.com');
	});
});

describe('login CSRF', () => {
	it('rejects a callback with no flow cookie', async () => {
		// The attack: start a flow with your own account, hand the victim the
		// resulting callback URL, and their browser silently signs in as you.
		// The state parameter alone cannot detect this — only the browser binding
		// can.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(new Request(callbackUrl));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'state' });
	});

	it('rejects a callback whose cookie belongs to a different flow', async () => {
		const { idp, client } = setup();

		const mine = await client.start();
		const attackers = await client.start();
		if (!mine.ok || !attackers.ok) return;

		const { callbackUrl } = idp.authorize(attackers.authorizationUrl);

		// The attacker's callback, replayed into a browser holding our cookie.
		const result = await client.callback(
			callbackRequest(callbackUrl, mine.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'state' });
	});

	it('rejects a callback whose state was tampered with in transit', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl, {
			state: 'substituted-state',
		});

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
	});

	it('rejects a callback with no state at all', async () => {
		const { client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const result = await client.callback(
			callbackRequest(`${REDIRECT_URI}?code=abc`, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'state' });
	});
});

describe('replay', () => {
	it('rejects a callback URL used a second time', async () => {
		// The stored record is consumed on first use, so a replayed callback —
		// from browser history, a shared link, or a log — finds nothing.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const request = () => callbackRequest(callbackUrl, started.setCookies);

		expect((await client.callback(request())).ok).toBe(true);

		const replayed = await client.callback(request());
		expect(replayed.ok).toBe(false);
		if (replayed.ok) return;
		expect(replayed.error).toMatchObject({ code: 'state' });
	});

	it('consumes the record even when the exchange fails', async () => {
		// Otherwise a failed attempt leaves a live record an attacker can retry
		// against.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		idp.setNextIdTokenOverrides({ issuer: 'https://evil.example' });

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const request = () => callbackRequest(callbackUrl, started.setCookies);

		expect((await client.callback(request())).ok).toBe(false);

		const retried = await client.callback(request());
		expect(retried.ok).toBe(false);
		if (retried.ok) return;
		expect(retried.error).toMatchObject({ code: 'state' });
	});

	it('rejects a callback after the flow has expired', async () => {
		const { idp, clock, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);

		clock.advance(11 * 60_000);

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
	});
});

describe('mix-up', () => {
	it('rejects a callback echoing a different issuer', async () => {
		// RFC 9207. Without the check, an attacker running a malicious provider
		// can have a code from one issuer redeemed at another.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl, {
			issuer: 'https://evil.example',
		});

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'iss' });
	});

	it('still works with a provider that does not echo iss', async () => {
		// The parameter is not universally implemented, so its absence cannot be
		// treated as a failure — only a mismatch can.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl, {
			omitIssuer: true,
		});

		expect(
			(await client.callback(callbackRequest(callbackUrl, started.setCookies))).ok
		).toBe(true);
	});
});

describe('token validation in the flow', () => {
	it('rejects an ID token whose nonce does not match the flow', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		idp.setNextIdTokenOverrides({ nonce: 'a-different-nonce' });

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'nonce' });
	});

	it('rejects an ID token minted for a different client', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		idp.setNextIdTokenOverrides({ audience: 'someone-else' });

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'aud' });
	});

	it('rejects an unsigned ID token', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		idp.setNextIdTokenOverrides({ unsigned: true });

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
	});
});

describe('provider errors', () => {
	it('surfaces a provider-reported error as a typed failure', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl, {
			error: 'access_denied',
		});

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'access_denied' });
	});

	it('keeps provider diagnostics out of the client-visible message', async () => {
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl, {
			error: 'server_error',
		});

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.safeMessage).toBe('Sign-in with this provider failed.');
	});

	it('reports an unreachable token endpoint rather than throwing', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		let failTokenEndpoint = false;
		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: (input) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
				if (failTokenEndpoint && url.endsWith('/token')) {
					return Promise.reject(new Error('ECONNREFUSED'));
				}
				return idp.fetch()(input);
			},
		});

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		failTokenEndpoint = true;

		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatchObject({ code: 'network' });
		expect(result.error.detail).toBe('Token endpoint unreachable: ECONNREFUSED');
	});
});

describe('open redirect through the flow', () => {
	it('discards a hostile redirectTo at the point it is stored', async () => {
		const { idp, client } = setup();

		const started = await client.start({ redirectTo: '//evil.example/steal' });
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(new URL(result.redirectTo).origin).toBe('https://app.example.com');
	});

	it('preserves a safe relative redirectTo across the whole flow', async () => {
		const { idp, client } = setup();

		const started = await client.start({ redirectTo: '/projects/42?tab=logs' });
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);
		const result = await client.callback(
			callbackRequest(callbackUrl, started.setCookies)
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.redirectTo).toBe('https://app.example.com/projects/42?tab=logs');
	});
});

describe('pkce enforcement', () => {
	it('sends a verifier the provider actually validates', async () => {
		// The fake provider rejects a mismatched verifier, so a green result here
		// is evidence the client sent the right one — not merely that it sent
		// something.
		const { idp, client } = setup();

		const started = await client.start();
		if (!started.ok) return;

		const { callbackUrl } = idp.authorize(started.authorizationUrl);

		expect(
			(await client.callback(callbackRequest(callbackUrl, started.setCookies))).ok
		).toBe(true);
		expect(idp.tokenRequestCount()).toBe(1);
	});

	it('refuses to start against a provider without S256 support', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		const client = createOAuthClient<Profile>({
			provider: {
				id: 'legacy',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
				metadata: {
					issuer: idp.issuer,
					authorizationEndpoint: `${idp.issuer}/authorize`,
					tokenEndpoint: `${idp.issuer}/token`,
					jwksUri: `${idp.issuer}/jwks`,
					idTokenSigningAlgValues: ['RS256'],
					codeChallengeMethods: ['plain'],
				},
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: idp.fetch(),
		});

		const started = await client.start();

		expect(started.ok).toBe(false);
		if (started.ok) return;
		expect(started.error).toMatchObject({ code: 'pkce' });
	});
});

describe('discovery', () => {
	it('fetches the well-known document once and caches it', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		let discoveryRequests = 0;
		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: (input) => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
				if (url.includes('.well-known')) discoveryRequests += 1;
				return idp.fetch()(input);
			},
		});

		for (let i = 0; i < 5; i += 1) await client.start();

		expect(discoveryRequests).toBe(1);
	});

	it('refuses a discovery document declaring a different issuer', async () => {
		// Otherwise the document points every subsequent request — including the
		// key fetch — at an issuer we never chose.
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: 'https://idp.example.com',
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: () =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							...idp.discoveryDocument(),
							issuer: 'https://evil.example',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
				),
		});

		const started = await client.start();

		expect(started.ok).toBe(false);
		if (started.ok) return;
		expect(started.error).toMatchObject({ code: 'discovery' });
	});

	it('refuses a discovery document advertising a plaintext token endpoint', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });

		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: () =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							...idp.discoveryDocument(),
							token_endpoint: 'http://idp.example.com/token',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
				),
		});

		expect((await client.start()).ok).toBe(false);
	});

	it('refuses an unsafe issuer before attempting discovery', async () => {
		const clock = createTestClock();
		const fetch = vi.fn();
		const client = createOAuthClient<Profile>({
			provider: {
				id: 'unsafe',
				clientId: 'client',
				clientSecret: 'secret',
				issuer: 'http://idp.example.com',
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch,
		});

		expect((await client.start()).ok).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('refuses a discovery document advertising a plaintext userinfo endpoint', async () => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });
		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: () =>
				Promise.resolve(
					Response.json({
						...idp.discoveryDocument(),
						userinfo_endpoint: 'http://idp.example.com/userinfo',
					})
				),
		});

		expect((await client.start()).ok).toBe(false);
	});

	it.each([
		['empty authorization endpoint', { authorization_endpoint: '' }],
		['wrong algorithms shape', { id_token_signing_alg_values_supported: 'RS256' }],
		['wrong PKCE shape', { code_challenge_methods_supported: 'S256' }],
	] as const)('rejects malformed discovery metadata: %s', async (_name, override) => {
		const clock = createTestClock();
		const idp = createFakeIdp({ now: () => clock.now() });
		const client = createOAuthClient<Profile>({
			provider: {
				id: 'fake',
				clientId: idp.audience,
				clientSecret: 'secret',
				issuer: idp.issuer,
				profile: (claims) => ({ id: claims.sub, email: undefined }),
			},
			redirectUri: REDIRECT_URI,
			storage: createMemoryAuthStorage(clock),
			clock,
			redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
			fetch: () =>
				Promise.resolve(Response.json({ ...idp.discoveryDocument(), ...override })),
		});

		expect((await client.start()).ok).toBe(false);
	});
});
