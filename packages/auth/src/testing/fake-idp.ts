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

/**
 * A fake OpenID Provider for tests.
 *
 * Exists so ID-token validation can be exercised against real signatures rather
 * than mocks. A mocked verifier proves that the code calls the function it was
 * written to call; it proves nothing about whether a forged token is rejected,
 * which is the only property that matters here.
 *
 * It can also produce deliberately malformed tokens — wrong issuer, wrong
 * audience, `alg: none`, a signature from a key it does not publish — so the
 * hostile cases are generated rather than hand-written.
 */

import {
	createHash,
	createPublicKey,
	generateKeyPairSync,
	randomBytes,
	sign as cryptoSign,
	type KeyObject,
} from 'node:crypto';

export interface FakeIdpOptions {
	readonly issuer?: string;
	readonly audience?: string;
	readonly keyId?: string;
	/** Epoch millis. Defaults to a fixed instant so tokens are reproducible. */
	readonly now?: () => number;
}

/** Overrides for minting a deliberately wrong token. */
export interface MintOptions {
	readonly subject?: string;
	readonly issuer?: string;
	readonly audience?: string | readonly string[];
	readonly nonce?: string;
	/** Seconds until expiry. Negative mints an already-expired token. */
	readonly expiresInSeconds?: number;
	/** Seconds to offset `iat` by. Positive puts it in the future. */
	readonly issuedAtOffsetSeconds?: number;
	/** Additional claims, merged last. */
	readonly claims?: Readonly<Record<string, unknown>>;
	/** Override the header `alg`, to test algorithm confusion. */
	readonly algorithm?: string;
	/** Override the header `kid`, to test unknown-key handling. */
	readonly keyId?: string;
	/** Sign with a key the provider does not publish. */
	readonly signWithForeignKey?: boolean;
	/** Emit no signature at all, in the `alg: none` shape. */
	readonly unsigned?: boolean;
	/** Include an `at_hash` binding to this access token. */
	readonly accessToken?: string;
}

export interface FakeIdp {
	readonly issuer: string;
	readonly audience: string;
	readonly keyId: string;
	/** The provider's public JWKS, as the discovery document would serve it. */
	jwks(): { readonly keys: readonly Record<string, unknown>[] };
	/** The OIDC discovery document. */
	discoveryDocument(): Record<string, unknown>;
	/** Mints an ID token. With no overrides, a completely valid one. */
	mint(options?: MintOptions): string;
	/**
	 * A `fetch` serving this provider's discovery, JWKS, and token endpoints.
	 *
	 * The token endpoint really does check the PKCE verifier against the stored
	 * challenge, so a flow that omits or mangles it fails here rather than
	 * passing because the fake was permissive.
	 */
	fetch(): (input: string | URL | Request) => Promise<Response>;
	/** How many times the JWKS endpoint has been requested. */
	readonly jwksRequestCount: () => number;
	/** How many times the token endpoint has been requested. */
	readonly tokenRequestCount: () => number;
	/**
	 * Plays the user's part: consumes an authorization URL and returns the
	 * callback URL the browser would be redirected to.
	 */
	authorize(
		authorizationUrl: string,
		options?: AuthorizeOptions
	): { readonly code: string; readonly callbackUrl: string };
	/** Overrides applied to the next ID token the token endpoint mints. */
	setNextIdTokenOverrides(overrides: MintOptions | undefined): void;
}

/** Controls how the fake provider answers an authorization request. */
export interface AuthorizeOptions {
	/** Return this error instead of a code. */
	readonly error?: string;
	/** Echo a different `state`, simulating tampering. */
	readonly state?: string;
	/** Echo an `iss` parameter. Set to a foreign issuer to simulate a mix-up. */
	readonly issuer?: string;
	/** Omit the `iss` parameter entirely. */
	readonly omitIssuer?: boolean;
}

const base64url = (value: string | Buffer): string =>
	Buffer.from(value as string, typeof value === 'string' ? 'utf8' : undefined)
		.toString('base64url');

const DEFAULT_NOW = 1_700_000_000_000;

interface TestKeys {
	readonly publicKey: KeyObject;
	readonly privateKey: KeyObject;
	/** A key the provider never publishes, for forging attempts. */
	readonly foreign: {
		readonly publicKey: KeyObject;
		readonly privateKey: KeyObject;
	};
}

/**
 * Generated once per process and shared by every fake IdP.
 *
 * RSA-2048 generation is a probabilistic prime search: measured here at 50ms to
 * 369ms per pair on an idle machine, twice per IdP, once per test. That put the
 * OAuth suites' entire runtime in key generation and left them one unlucky
 * search away from a timeout under a loaded parallel run.
 *
 * Sharing is sound because the keys carry no per-instance meaning. No test
 * compares two IdPs against each other, and `foreign` only has to differ from
 * the signing key, which a shared pair satisfies just as well.
 */
let testKeys: TestKeys | undefined;

const getTestKeys = (): TestKeys => {
	testKeys ??= {
		...generateKeyPairSync('rsa', { modulusLength: 2048 }),
		foreign: generateKeyPairSync('rsa', { modulusLength: 2048 }),
	};
	return testKeys;
};

export const createFakeIdp = (options: FakeIdpOptions = {}): FakeIdp => {
	const issuer = options.issuer ?? 'https://idp.example.com';
	const audience = options.audience ?? 'client-id-123';
	const keyId = options.keyId ?? 'test-key-1';
	const now = options.now ?? (() => DEFAULT_NOW);

	const { publicKey, privateKey, foreign } = getTestKeys();

	let jwksRequests = 0;
	let tokenRequests = 0;
	let nextIdTokenOverrides: MintOptions | undefined;

	interface PendingCode {
		readonly nonce: string | undefined;
		readonly challenge: string | undefined;
		readonly redirectUri: string | undefined;
	}

	const pending = new Map<string, PendingCode>();

	const publicJwk = (key: KeyObject, kid: string): Record<string, unknown> => ({
		...(key.export({ format: 'jwk' }) as Record<string, unknown>),
		kid,
		use: 'sig',
		alg: 'RS256',
	});

	const jwks = () => ({ keys: [publicJwk(publicKey, keyId)] });

	const discoveryDocument = (): Record<string, unknown> => ({
		issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/token`,
		jwks_uri: `${issuer}/jwks`,
		userinfo_endpoint: `${issuer}/userinfo`,
		response_types_supported: ['code'],
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: ['RS256'],
		code_challenge_methods_supported: ['S256'],
	});

	const mint = (mintOptions: MintOptions = {}): string => {
		const issuedAtSeconds =
			Math.floor(now() / 1000) + (mintOptions.issuedAtOffsetSeconds ?? 0);
		const expiresIn = mintOptions.expiresInSeconds ?? 3600;

		const header = {
			alg: mintOptions.unsigned === true ? 'none' : (mintOptions.algorithm ?? 'RS256'),
			typ: 'JWT',
			kid: mintOptions.keyId ?? keyId,
		};

		const payload: Record<string, unknown> = {
			iss: mintOptions.issuer ?? issuer,
			aud: mintOptions.audience ?? audience,
			sub: mintOptions.subject ?? 'user-abc',
			iat: issuedAtSeconds,
			exp: issuedAtSeconds + expiresIn,
			...(mintOptions.nonce === undefined ? {} : { nonce: mintOptions.nonce }),
			...(mintOptions.accessToken === undefined
				? {}
				: {
						// at_hash is the left-most half of the SHA-256 of the access
						// token, base64url-encoded.
						at_hash: createHash('sha256')
							.update(mintOptions.accessToken)
							.digest()
							.subarray(0, 16)
							.toString('base64url'),
					}),
			...mintOptions.claims,
		};

		const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
			JSON.stringify(payload)
		)}`;

		if (mintOptions.unsigned === true) return `${signingInput}.`;

		const key = mintOptions.signWithForeignKey === true ? foreign.privateKey : privateKey;
		const signature = cryptoSign('sha256', Buffer.from(signingInput), key).toString(
			'base64url'
		);

		return `${signingInput}.${signature}`;
	};

	const handleToken = async (input: string | URL | Request): Promise<Response> => {
		const oauthError = (code: string): Response =>
			new Response(JSON.stringify({ error: code }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});

		if (!(input instanceof Request)) return oauthError('invalid_request');

		const form = new URLSearchParams(await input.text());
		const code = form.get('code') ?? '';
		const record = pending.get(code);

		if (record === undefined) return oauthError('invalid_grant');

		// Single-use, exactly as a real provider treats an authorization code.
		pending.delete(code);

		// The verifier is genuinely checked. A fake that skipped this would let a
		// client with broken PKCE handling pass its own tests.
		if (record.challenge !== undefined) {
			const verifier = form.get('code_verifier');
			if (verifier === null) return oauthError('invalid_grant');

			const derived = createHash('sha256').update(verifier).digest('base64url');
			if (derived !== record.challenge) return oauthError('invalid_grant');
		}

		// The redirect_uri must match the one the flow started with.
		if (
			record.redirectUri !== undefined &&
			form.get('redirect_uri') !== record.redirectUri
		) {
			return oauthError('invalid_grant');
		}

		const accessToken = `access-${code}`;
		const overrides = nextIdTokenOverrides;
		nextIdTokenOverrides = undefined;

		const idToken = mint({
			...(record.nonce === undefined ? {} : { nonce: record.nonce }),
			accessToken,
			...overrides,
		});

		return new Response(
			JSON.stringify({
				access_token: accessToken,
				token_type: 'Bearer',
				expires_in: 3600,
				id_token: idToken,
				refresh_token: `refresh-${code}`,
				scope: 'openid email profile',
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	};

	const fetchImpl = () => (input: string | URL | Request): Promise<Response> => {
		const url =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.toString()
					: input.url;

		const json = (body: unknown): Response =>
			new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

		if (url === `${issuer}/.well-known/openid-configuration`) {
			return Promise.resolve(json(discoveryDocument()));
		}

		if (url === `${issuer}/jwks`) {
			jwksRequests += 1;
			return Promise.resolve(json(jwks()));
		}

		if (url === `${issuer}/token`) {
			tokenRequests += 1;
			return handleToken(input);
		}

		return Promise.resolve(new Response('Not Found', { status: 404 }));
	};

	const authorize = (
		authorizationUrl: string,
		authorizeOptions: AuthorizeOptions = {}
	): { code: string; callbackUrl: string } => {
		const url = new URL(authorizationUrl);
		const redirectUri = url.searchParams.get('redirect_uri') ?? '';
		const state = authorizeOptions.state ?? url.searchParams.get('state') ?? '';

		const callback = new URL(redirectUri);
		if (state !== '') callback.searchParams.set('state', state);

		// RFC 9207: a conforming provider echoes its own issuer so the client can
		// detect a mix-up. Configurable here so that check can be tested.
		if (authorizeOptions.omitIssuer !== true) {
			callback.searchParams.set('iss', authorizeOptions.issuer ?? issuer);
		}

		if (authorizeOptions.error !== undefined) {
			callback.searchParams.set('error', authorizeOptions.error);
			return { code: '', callbackUrl: callback.toString() };
		}

		const code = `code-${String(pending.size + 1)}-${randomBytes(8).toString('hex')}`;
		pending.set(code, {
			nonce: url.searchParams.get('nonce') ?? undefined,
			challenge: url.searchParams.get('code_challenge') ?? undefined,
			redirectUri: redirectUri === '' ? undefined : redirectUri,
		});

		callback.searchParams.set('code', code);

		return { code, callbackUrl: callback.toString() };
	};

	return {
		issuer,
		audience,
		keyId,
		jwks,
		discoveryDocument,
		mint,
		fetch: fetchImpl,
		jwksRequestCount: () => jwksRequests,
		tokenRequestCount: () => tokenRequests,
		authorize,
		setNextIdTokenOverrides: (overrides) => {
			nextIdTokenOverrides = overrides;
		},
	};
};

/** Converts a published JWK into a usable public key, for assertions in tests. */
export const publicKeyFromJwk = (jwk: Record<string, unknown>): KeyObject =>
	createPublicKey({ key: jwk as never, format: 'jwk' });
