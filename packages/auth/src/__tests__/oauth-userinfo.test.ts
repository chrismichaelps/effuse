/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { describe, expect, it, vi } from 'vitest';
import {
	createOAuthClient,
	type OAuthResolvedIdentity,
	type OAuthUserInfoProvider,
} from '../server/oauth/flow.js';
import { github, type StandardProfile } from '../server/oauth/presets.js';
import { createRedirectValidator } from '../server/oauth/redirect.js';
import { createMemoryAuthStorage } from '../testing/storage.js';
import { createTestClock } from '../testing/index.js';
import { isSafeOAuthEndpoint, parseJsonResponse } from '../server/oauth/utils.js';
import { githubUserSchema } from '../server/oauth/schemas.js';

interface Profile {
	readonly id: string;
	readonly email?: string;
}

const metadata = {
	issuer: 'https://oauth.example.com',
	authorizationEndpoint: 'https://oauth.example.com/authorize',
	tokenEndpoint: 'https://oauth.example.com/token',
	codeChallengeMethods: ['S256'],
} as const;

const identity = (
	overrides: Partial<OAuthResolvedIdentity<Profile>> = {}
): OAuthResolvedIdentity<Profile> => ({
	profile: { id: 'user-42', email: 'ada@example.com' },
	claims: { sub: 'user-42', email: 'ada@example.com', email_verified: true },
	emailVerified: true,
	...overrides,
});

const provider = (
	overrides: Partial<OAuthUserInfoProvider<Profile>> = {}
): OAuthUserInfoProvider<Profile> => ({
	mode: 'oauth',
	id: 'plain',
	issuer: metadata.issuer,
	clientId: 'client-id',
	clientSecret: 'client-secret',
	metadata,
	resolveIdentity: () => Promise.resolve(identity()),
	...overrides,
});

const cookieHeader = (setCookies: readonly string[]): string =>
	setCookies.map((header) => header.split(';')[0]).join('; ');

const complete = async (
	providerDefinition: OAuthUserInfoProvider<Profile>,
	tokenBody: Record<string, unknown> = {
		access_token: 'access-secret',
		token_type: 'bearer',
		scope: 'profile email',
	}
) => {
	const tokenRequests: Request[] = [];
	const client = createOAuthClient({
		provider: providerDefinition,
		redirectUri: 'https://app.example.com/auth/callback',
		storage: createMemoryAuthStorage(createTestClock()),
		clock: createTestClock(),
		redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
		fetch: (input, init) => {
			const request = input instanceof Request ? input : new Request(input, init);
			tokenRequests.push(request);
			return Promise.resolve(Response.json(tokenBody));
		},
	});
	const started = await client.start({ redirectTo: '/account' });
	if (!started.ok) return { started, tokenRequests };

	const authorization = new URL(started.authorizationUrl);
	const callback = new URL('https://app.example.com/auth/callback');
	callback.searchParams.set('code', 'code-1');
	callback.searchParams.set('state', authorization.searchParams.get('state') ?? '');
	callback.searchParams.set('iss', metadata.issuer);
	const result = await client.callback(
		new Request(callback, { headers: { cookie: cookieHeader(started.setCookies) } })
	);
	return { started, result, tokenRequests };
};

describe('plain OAuth identity resolution', () => {
	it('completes without an ID token and returns the server-resolved identity', async () => {
		const resolveIdentity = vi.fn(() => Promise.resolve(identity()));
		const flow = await complete(provider({ resolveIdentity }));

		expect(flow.started.ok).toBe(true);
		if (!('result' in flow)) return;
		expect(flow.result).toMatchObject({
			ok: true,
			profile: { id: 'user-42', email: 'ada@example.com' },
			claims: { sub: 'user-42' },
			emailVerified: true,
			redirectTo: 'https://app.example.com/account',
		});
		expect(resolveIdentity).toHaveBeenCalledWith({
			accessToken: 'access-secret',
			fetch: expect.any(Function),
		});
		if (!flow.result.ok) return;
		expect(flow.result.tokens.idToken).toBeUndefined();
	});

	it('gives custom resolvers the native two-argument fetch contract', async () => {
		const flow = await complete(
			provider({
				resolveIdentity: async ({ fetch }) => {
					await fetch('https://oauth.example.com/user', {
						headers: { Authorization: 'Bearer access-secret' },
					});
					return identity();
				},
			})
		);

		expect(flow.result).toMatchObject({ ok: true });
		expect(flow.tokenRequests[1]?.url).toBe('https://oauth.example.com/user');
		expect(flow.tokenRequests[1]?.headers.get('authorization')).toBe(
			'Bearer access-secret'
		);
	});

	it('does not request the OpenID scope by default', async () => {
		const flow = await complete(provider());
		expect(flow.started.ok).toBe(true);
		if (!flow.started.ok) return;
		expect(new URL(flow.started.authorizationUrl).searchParams.get('scope')).toBe('');
		expect(new URL(flow.started.authorizationUrl).searchParams.has('nonce')).toBe(false);
	});

	it('supports provider-required client secret form authentication', async () => {
		const flow = await complete(
			provider({ tokenEndpointAuthMethod: 'client_secret_post' })
		);
		if (!('result' in flow)) return;
		const request = flow.tokenRequests[0];
		expect(request?.method).toBe('POST');
		expect(request?.headers.get('accept')).toBe('application/json');
		expect(request?.headers.get('content-type')).toBe(
			'application/x-www-form-urlencoded'
		);
		expect(request?.headers.get('authorization')).toBeNull();
		const form = new URLSearchParams(await request?.clone().text());
		expect(form.get('grant_type')).toBe('authorization_code');
		expect(form.get('code')).toBe('code-1');
		expect(form.get('client_id')).toBe('client-id');
		expect(form.get('redirect_uri')).toBe(
			'https://app.example.com/auth/callback'
		);
		expect(form.get('client_secret')).toBe('client-secret');
		expect(form.get('code_verifier')).toBeTruthy();
	});

	it('uses HTTP Basic by default and does not duplicate the secret in the body', async () => {
		const flow = await complete(provider());
		const request = flow.tokenRequests[0];
		expect(request?.headers.get('authorization')).toBe(
			`Basic ${Buffer.from('client-id:client-secret').toString('base64')}`
		);
		expect(new URLSearchParams(await request?.clone().text()).has('client_secret')).toBe(
			false
		);
	});

	it('projects every optional token field exactly', async () => {
		const flow = await complete(provider(), {
			access_token: 'access-secret',
			token_type: 'Bearer',
			id_token: 'opaque-provider-token',
			expires_in: 3600,
			refresh_token: 'refresh-secret',
			scope: '',
		});
		if (!('result' in flow) || !flow.result.ok) return;
		expect(flow.result.tokens).toEqual({
			accessToken: 'access-secret',
			tokenType: 'Bearer',
			idToken: 'opaque-provider-token',
			expiresInSeconds: 3600,
			refreshToken: 'refresh-secret',
			scope: '',
		});
	});

	it('omits absent optional token fields', async () => {
		const flow = await complete(provider(), {
			access_token: 'access-secret',
			token_type: 'bearer',
		});
		if (!('result' in flow) || !flow.result.ok) return;
		expect(flow.result.tokens).toEqual({
			accessToken: 'access-secret',
			tokenType: 'bearer',
		});
		for (const key of [
			'idToken',
			'expiresInSeconds',
			'refreshToken',
			'scope',
		] as const) {
			expect(Object.hasOwn(flow.result.tokens, key)).toBe(false);
		}
	});

	it('rejects failed and unparseable token responses', async () => {
		for (const [response, detail] of [
			[new Response('denied', { status: 401 }), 'Token endpoint returned 401.'],
			[
				new Response('{', {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}),
				'Token endpoint returned unparseable JSON.',
			],
		] as const) {
			const client = createOAuthClient({
				provider: provider(),
				redirectUri: 'https://app.example.com/auth/callback',
				storage: createMemoryAuthStorage(createTestClock()),
				clock: createTestClock(),
				redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
				fetch: () => Promise.resolve(response.clone()),
			});
			const started = await client.start();
			if (!started.ok) continue;
			const authorization = new URL(started.authorizationUrl);
			const callback = new URL('https://app.example.com/auth/callback');
			callback.searchParams.set('code', 'code-1');
			callback.searchParams.set('state', authorization.searchParams.get('state') ?? '');
			callback.searchParams.set('iss', metadata.issuer);
			const result = await client.callback(
				new Request(callback, {
					headers: { cookie: cookieHeader(started.setCookies) },
				})
			);
			expect(result).toMatchObject({ ok: false, error: { code: 'token' } });
			if (!result.ok) expect(result.error.detail).toBe(detail);
		}
	});

	it.each([
		['missing identity', () => Promise.resolve(undefined)],
		['empty subject', () => Promise.resolve(identity({ claims: { sub: '' } }))],
	] as const)('rejects %s', async (_name, resolveIdentity) => {
		const flow = await complete(provider({ resolveIdentity }));
		if (!('result' in flow)) return;
		expect(flow.result).toMatchObject({ ok: false, error: { code: 'userinfo' } });
		if (!flow.result.ok) {
			expect(flow.result.error.detail).toBe('Provider returned an invalid identity.');
		}
	});

	it('turns identity endpoint exceptions into safe provider failures', async () => {
		const flow = await complete(
			provider({ resolveIdentity: () => Promise.reject(new Error('upstream secret')) })
		);
		if (!('result' in flow) || flow.result.ok) return;
		expect(flow.result.error).toMatchObject({ code: 'userinfo' });
		expect(flow.result.error.detail).toBe(
			'Provider identity endpoint failed: upstream secret'
		);
		expect(flow.result.error.safeMessage).not.toContain('upstream secret');
	});

	it('rejects unsupported access-token types before resolving identity', async () => {
		const resolveIdentity = vi.fn(() => Promise.resolve(identity()));
		const flow = await complete(provider({ resolveIdentity }), {
			access_token: 'access-secret',
			token_type: 'mac',
		});
		if (!('result' in flow)) return;
		expect(flow.result).toMatchObject({ ok: false, error: { code: 'token' } });
		if (!flow.result.ok) {
			expect(flow.result.error.detail).toBe(
				'Token response carried an unsupported token type.'
			);
		}
		expect(resolveIdentity).not.toHaveBeenCalled();
	});

	it.each([
		['missing access token', { token_type: 'bearer' }],
		['empty access token', { access_token: '', token_type: 'bearer' }],
		['empty token type', { access_token: 'token', token_type: '' }],
		['negative expiry', { access_token: 'token', expires_in: -1 }],
		['non-object payload', []],
	] as const)('rejects malformed token payloads: %s', async (_name, tokenBody) => {
		const flow = await complete(provider(), tokenBody as Record<string, unknown>);
		if (!('result' in flow)) return;
		expect(flow.result).toMatchObject({ ok: false, error: { code: 'token' } });
		if (!flow.result.ok) {
			expect(flow.result.error.detail).toBe('Token response has an invalid shape.');
		}
	});

	it.each([
		['issuer mismatch', { ...metadata, issuer: 'https://other.example.com' }],
		[
			'plaintext authorization endpoint',
			{ ...metadata, authorizationEndpoint: 'http://oauth.example.com/authorize' },
		],
		[
			'plaintext token endpoint',
			{ ...metadata, tokenEndpoint: 'http://oauth.example.com/token' },
		],
	] as const)('refuses unsafe static metadata: %s', async (_name, unsafe) => {
		const flow = await complete(provider({ metadata: unsafe }));
		expect(flow.started).toMatchObject({ ok: false, error: { code: 'discovery' } });
	});
});

describe('GitHub preset', () => {
	it('uses the numeric account id and only a verified primary email', async () => {
		const preset = github({ clientId: 'github-id', clientSecret: 'github-secret' });
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({ id: 42, login: 'ada', name: 'Ada', avatar_url: 'https://img/42' })
			)
			.mockResolvedValueOnce(
				Response.json([
					{ email: 'old@example.com', primary: false, verified: true },
					{ email: 'ada@example.com', primary: true, verified: true },
				])
			);

		const result = await preset.resolveIdentity({ accessToken: 'github-token', fetch });
		expect(result).toMatchObject({
			claims: { sub: '42', login: 'ada', email_verified: true },
			profile: {
				providerAccountId: '42',
				email: 'ada@example.com',
				emailVerified: true,
			},
			emailVerified: true,
		});
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(preset).toMatchObject({
		mode: 'oauth',
		id: 'github',
		issuer: 'https://github.com',
		tokenEndpointAuthMethod: 'client_secret_post',
		scopes: ['read:user', 'user:email'],
		metadata: {
			authorizationEndpoint: 'https://github.com/login/oauth/authorize',
			tokenEndpoint: 'https://github.com/login/oauth/access_token',
			codeChallengeMethods: ['S256'],
		},
	});
		for (const [request] of fetch.mock.calls) {
			expect((request as Request).headers.get('authorization')).toBe(
				'Bearer github-token'
			);
		}
	});

	it('does not trust unverified, non-primary, or profile email fields', async () => {
		const preset = github({ clientId: 'id', clientSecret: 'secret' });
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ id: 'node-id', login: 'ada', email: 'public@example.com' }))
			.mockResolvedValueOnce(
				Response.json([
					{ email: 'unverified@example.com', primary: true, verified: false },
					{ email: 'secondary@example.com', primary: false, verified: true },
				])
			);
		const result = await preset.resolveIdentity({ accessToken: 'token', fetch });

		expect(result?.profile.email).toBeUndefined();
		expect(result?.profile.emailVerified).toBe(false);
		expect(result?.claims['email_verified']).toBe(false);
		expect(result?.emailVerified).toBe(false);
	});

	it('preserves optional profile fields and falls back from name to login', async () => {
		const preset = github({ clientId: 'id', clientSecret: 'secret' });
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({ id: 7, login: 'ada', name: null, avatar_url: null })
			)
			.mockResolvedValueOnce(Response.json([]));
		const result = await preset.resolveIdentity({ accessToken: 'token', fetch });

		expect(result?.claims).toMatchObject({
			name: undefined,
			picture: undefined,
		});
		expect(result?.profile).toMatchObject({
			name: 'ada',
			picture: undefined,
		});
	});

	it('rejects failed APIs, malformed documents, and missing stable ids', async () => {
		const preset = github({ clientId: 'id', clientSecret: 'secret' });
		for (const responses of [
			[
				Response.json({ id: 42, login: 'ada' }, { status: 401 }),
				Response.json([]),
			],
			[
				Response.json({ id: 42, login: 'ada' }),
				Response.json([], { status: 403 }),
			],
			[Response.json([]), Response.json([])],
			[Response.json({ login: 'missing-id' }), Response.json([])],
			[Response.json({ id: 42 }), Response.json({ email: 'not-an-array' })],
			[Response.json({ id: Number.POSITIVE_INFINITY }), Response.json([])],
		] as const) {
			let index = 0;
			const result = await preset.resolveIdentity({
				accessToken: 'token',
				fetch: () => Promise.resolve(responses[index++] ?? new Response()),
			});
			expect(result).toBeUndefined();
		}
	});
});

describe('OAuth boundary utilities', () => {
	it.each([
		['https://provider.example/token', true],
		['http://localhost/token', true],
		['http://127.0.0.1/token', true],
		['http://[::1]/token', true],
		['http://provider.example/token', false],
		['ftp://provider.example/token', false],
		['ftp://localhost/token', false],
		['ws://127.0.0.1/token', false],
		['not a url', false],
	] as const)('classifies endpoint %s', (endpoint, expected) => {
		expect(isSafeOAuthEndpoint(endpoint)).toBe(expected);
	});

	it('parses valid JSON with the supplied Zod schema', async () => {
		await expect(
			parseJsonResponse(Response.json({ id: 42, login: 'ada' }), githubUserSchema)
		).resolves.toMatchObject({ id: 42, login: 'ada' });
	});

	it('returns undefined for invalid shapes and invalid JSON', async () => {
		await expect(
			parseJsonResponse(Response.json({ login: 'missing-id' }), githubUserSchema)
		).resolves.toBeUndefined();
		await expect(
			parseJsonResponse(new Response('{'), githubUserSchema)
		).resolves.toBeUndefined();
	});
});
