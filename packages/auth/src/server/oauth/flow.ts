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
 * The authorization-code flow, with PKCE.
 *
 * Two properties drive the design.
 *
 * **The flow's state is bound to the browser, not just remembered.** The `state`
 * parameter alone proves a callback corresponds to *a* request we made, not that
 * it corresponds to one *this* browser made. Without that second half, an
 * attacker can start a flow with their own account and feed the victim the
 * resulting callback URL — the victim's browser silently links or signs in to the
 * attacker's identity. Here the state id also travels in an HttpOnly cookie, and
 * the callback requires both to be present and equal.
 *
 * **The authorization request is single-use.** The stored record is consumed on
 * the first callback, so a replayed callback URL finds nothing.
 */

import { randomBytes } from 'node:crypto';
import { ProviderError, type AuthError } from '../../errors.js';
import { createPkcePair, verifyPkce } from './pkce.js';
import { verifyIdToken, type IdTokenAlgorithm, type IdTokenClaims } from './id-token.js';
import { createJwksResolver } from './jwks.js';
import {
	createDiscoveryClient,
	type OAuthProviderMetadata,
	type ProviderMetadata,
} from './discovery.js';
import { serializeCookieChunks, parseCookieHeader, clearCookieChunks } from '../cookies.js';
import type { AuthStorage, Clock } from '../../contract.js';
import type { RedirectValidator } from './redirect.js';
import {
	OAUTH_PROVIDER_MODE,
	OAUTH_TOKEN_TYPE,
	OIDC_DEFAULT_SCOPES,
	PKCE_METHOD,
	SUPPORTED_ID_TOKEN_ALGORITHMS,
	TOKEN_ENDPOINT_AUTH_METHOD,
} from './constants.js';
import {
	oauthResolvedIdentitySchema,
	oauthTokenResponseSchema,
} from './schemas.js';
import { isSafeOAuthEndpoint } from './utils.js';
import type { OAuthFetch } from './types.js';

interface OAuthProviderBase {
	/** Stable identifier, used in storage keys and to detect mix-ups. */
	readonly id: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly tokenEndpointAuthMethod?:
		| typeof TOKEN_ENDPOINT_AUTH_METHOD.BASIC
		| typeof TOKEN_ENDPOINT_AUTH_METHOD.POST;
	/** Discovered from this issuer unless `metadata` is supplied outright. */
	readonly issuer: string;
	/** Skips discovery. Useful for providers with no well-known document. */
	readonly scopes?: readonly string[];
	/** Extra authorization-request parameters, e.g. `prompt` or `hd`. */
	readonly authorizationParams?: Readonly<Record<string, string>>;
}

/** An OpenID Connect provider whose identity is carried by a signed ID token. */
export interface OidcProvider<Profile> extends OAuthProviderBase {
	readonly mode?: typeof OAUTH_PROVIDER_MODE.OIDC;
	/** Skips discovery. Useful for providers with no well-known document. */
	readonly metadata?: ProviderMetadata;
	/** Maps verified ID-token claims into the shape the application wants. */
	readonly profile: (claims: IdTokenClaims) => Profile;
}

export interface OAuthIdentityClaims {
	readonly sub: string;
	readonly [claim: string]: unknown;
}

export interface OAuthResolvedIdentity<Profile> {
	readonly profile: Profile;
	readonly claims: OAuthIdentityClaims;
	readonly emailVerified: boolean;
}

export interface OAuthIdentityContext {
	readonly accessToken: string;
	readonly fetch: OAuthFetch;
}

/** A plain OAuth provider whose identity is resolved server-side from its API. */
export interface OAuthUserInfoProvider<Profile> extends OAuthProviderBase {
	readonly mode: typeof OAUTH_PROVIDER_MODE.OAUTH;
	/** Plain OAuth has no discovery contract, so endpoints must be explicit. */
	readonly metadata: OAuthProviderMetadata;
	/**
	 * Exchanges the bearer token for a normalized identity. This callback runs
	 * only on the server and must reject malformed or ambiguous provider data.
	 */
	readonly resolveIdentity: (
		context: OAuthIdentityContext
	) => Promise<OAuthResolvedIdentity<Profile> | undefined>;
}

/** A provider definition. OIDC remains the default for backwards compatibility. */
export type OAuthProvider<Profile> =
	| OidcProvider<Profile>
	| OAuthUserInfoProvider<Profile>;

export interface OAuthClientOptions<Profile> {
	readonly provider: OAuthProvider<Profile>;
	/** Where the provider will send the browser back. Must be registered with them. */
	readonly redirectUri: string;
	readonly storage: AuthStorage;
	readonly clock: Clock;
	readonly redirects: RedirectValidator;
	/** How long an in-flight authorization request stays valid. Defaults to 10 minutes. */
	readonly flowTtlMs?: number;
	readonly fetch?: OAuthFetch;
	/** Cookie name carrying the state id. Defaults to `effuse.oauth`. */
	readonly cookieName?: string;
	/** Set false only for local http development. */
	readonly secureCookies?: boolean;
}

export interface StartResult {
	readonly ok: true;
	readonly authorizationUrl: string;
	readonly setCookies: readonly string[];
}

export interface OAuthTokens {
	readonly accessToken: string;
	readonly tokenType: string;
	readonly expiresInSeconds?: number;
	readonly refreshToken?: string;
	readonly idToken?: string;
	readonly scope?: string;
}

export interface CallbackSuccess<Profile> {
	readonly ok: true;
	readonly profile: Profile;
	readonly claims: IdTokenClaims | OAuthIdentityClaims;
	readonly tokens: OAuthTokens;
	/** Validated destination. Always safe to redirect to. */
	readonly redirectTo: string;
	/** Cookies clearing the flow state. Must be applied to the response. */
	readonly setCookies: readonly string[];
	/**
	 * Whether the provider asserts the email is verified.
	 *
	 * Automatic account linking on an unverified email is the most common OAuth
	 * account-takeover vector — anyone who can register the address at a provider
	 * that does not verify it takes over the matching local account. This is
	 * surfaced so the decision is explicit rather than implied.
	 */
	readonly emailVerified: boolean;
}

export type StartOutcome = StartResult | { readonly ok: false; readonly error: AuthError };
export type CallbackOutcome<Profile> =
	| CallbackSuccess<Profile>
	| { readonly ok: false; readonly error: AuthError; readonly setCookies: readonly string[] };

interface FlowRecord {
	readonly providerId: string;
	readonly nonce: string;
	readonly codeVerifier: string;
	readonly codeChallenge: string;
	readonly redirectTo: string;
	readonly createdAt: number;
}

const DEFAULT_FLOW_TTL_MS = 10 * 60_000;
const FLOW_NAMESPACE = 'oauth-flows';

export interface OAuthClient<Profile> {
	/** Begins a sign-in. Apply `setCookies`, then redirect to `authorizationUrl`. */
	start(options?: { readonly redirectTo?: string }): Promise<StartOutcome>;
	/** Completes a sign-in from the provider's callback request. */
	callback(request: Request): Promise<CallbackOutcome<Profile>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const createOAuthClient = <Profile>(
	options: OAuthClientOptions<Profile>
): OAuthClient<Profile> => {
	const {
		provider,
		redirectUri,
		storage,
		clock,
		redirects,
		flowTtlMs = DEFAULT_FLOW_TTL_MS,
		fetch: fetchImpl,
		cookieName = 'effuse.oauth',
		secureCookies = true,
	} = options;

	const flows = storage.namespace(FLOW_NAMESPACE);

	const discovery = createDiscoveryClient({
		issuer: provider.issuer,
		clock,
		...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
	});

	const cookieOptions = {
		name: cookieName,
		path: '/',
		secure: secureCookies,
		// The callback is a top-level cross-site navigation from the provider, and
		// a Strict cookie is not sent on those — the flow would break on every
		// sign-in. Lax is the correct setting here, and the state binding plus the
		// single-use record are what actually carry the security.
		sameSite: 'lax' as const,
		maxAgeSeconds: Math.floor(flowTtlMs / 1000),
		hostPrefix: true,
	};

	const metadataFor = async (): Promise<OAuthProviderMetadata | ProviderMetadata | undefined> => {
		const metadata = provider.metadata ?? (await discovery.load());
		if (metadata === undefined || metadata.issuer !== provider.issuer) return undefined;
		if (
			![metadata.authorizationEndpoint, metadata.tokenEndpoint].every(
				isSafeOAuthEndpoint
			)
		) {
			return undefined;
		}
		if (
			provider.mode !== OAUTH_PROVIDER_MODE.OAUTH &&
			(!('jwksUri' in metadata) ||
				typeof metadata.jwksUri !== 'string' ||
				!isSafeOAuthEndpoint(metadata.jwksUri))
		) {
			return undefined;
		}
		return metadata;
	};

	const failure = (detail: string, code?: string): AuthError =>
		new ProviderError({
			provider: provider.id,
			detail,
			...(code === undefined ? {} : { code }),
		});

	return {
		start: async (startOptions = {}) => {
			const metadata = await metadataFor();
			if (metadata === undefined) {
				return { ok: false, error: failure('Provider metadata is unavailable.', 'discovery') };
			}

			// The provider must support S256. Proceeding without PKCE against a
			// provider that cannot enforce it would leave the authorization code
			// interceptable, which is the thing PKCE exists to prevent.
			if (
				metadata.codeChallengeMethods.length > 0 &&
				!metadata.codeChallengeMethods.includes(PKCE_METHOD.S256)
			) {
				return {
					ok: false,
					error: failure('Provider does not support PKCE with S256.', 'pkce'),
				};
			}

			const state = randomBytes(32).toString('base64url');
			const nonce = randomBytes(32).toString('base64url');
			const pkce = await createPkcePair();

			// Validated at the point it is stored, so an unsafe destination never
			// even reaches the record — let alone the redirect at the end.
			const redirectTo = redirects.resolve(startOptions.redirectTo);

			const record: FlowRecord = {
				providerId: provider.id,
				nonce,
				codeVerifier: pkce.verifier,
				codeChallenge: pkce.challenge,
				redirectTo,
				createdAt: clock.now(),
			};

			await flows.set(state, record, { ttlMs: flowTtlMs });

			const url = new URL(metadata.authorizationEndpoint);
			url.searchParams.set('response_type', 'code');
			url.searchParams.set('client_id', provider.clientId);
			url.searchParams.set('redirect_uri', redirectUri);
			url.searchParams.set(
				'scope',
				(
					provider.scopes ??
					(provider.mode === OAUTH_PROVIDER_MODE.OAUTH ? [] : OIDC_DEFAULT_SCOPES)
				).join(' ')
			);
			url.searchParams.set('state', state);
			if (provider.mode !== OAUTH_PROVIDER_MODE.OAUTH) {
				url.searchParams.set('nonce', nonce);
			}
			url.searchParams.set('code_challenge', pkce.challenge);
			url.searchParams.set('code_challenge_method', pkce.method);

			for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
				url.searchParams.set(key, value);
			}

			return {
				ok: true,
				authorizationUrl: url.toString(),
				setCookies: serializeCookieChunks(state, cookieOptions),
			};
		},

		callback: async (request) => {
			const jar = parseCookieHeader(request.headers.get('cookie'));
			const clearing = clearCookieChunks(jar, cookieOptions);

			const reject = (detail: string, code?: string): CallbackOutcome<Profile> => ({
				ok: false,
				error: failure(detail, code),
				setCookies: clearing,
			});

			const url = new URL(request.url);

			// A provider-reported error arrives as query parameters. Surfaced as a
			// typed failure rather than being mistaken for a missing code.
			const providerError = url.searchParams.get('error');
			if (providerError !== null) {
				return reject(
					`Provider returned "${providerError}": ${url.searchParams.get('error_description') ?? ''}`,
					providerError
				);
			}

			const state = url.searchParams.get('state');
			const code = url.searchParams.get('code');

			if (state === null || state.length === 0) {
				return reject('Callback carried no state.', 'state');
			}
			if (code === null || code.length === 0) {
				return reject('Callback carried no authorization code.', 'code');
			}

			// The browser binding. Without it, an attacker can hand a victim a
			// callback URL from a flow the attacker started and have the victim's
			// browser complete a sign-in as the attacker.
			const cookieState =
				jar[cookieName] ?? jar[`__Host-${cookieName}`];
			if (cookieState === undefined) {
				return reject('No flow cookie; this callback did not start here.', 'state');
			}
			if (cookieState !== state) {
				return reject('Flow cookie does not match the callback state.', 'state');
			}

			const stored = await flows.get<FlowRecord>(state);
			if (stored === undefined || !isRecord(stored)) {
				return reject('Unknown or expired authorization request.', 'state');
			}

			// Single-use. Consumed before anything else can fail, so a replayed
			// callback finds nothing regardless of how the rest turns out.
			await flows.delete(state);

			if (clock.now() - stored.createdAt > flowTtlMs) {
				return reject('Authorization request expired.', 'state');
			}
			if (stored.providerId !== provider.id) {
				return reject('Authorization request belongs to another provider.', 'state');
			}

			const metadata = await metadataFor();
			if (metadata === undefined) {
				return reject('Provider metadata is unavailable.', 'discovery');
			}

			// Mix-up defence (RFC 9207). When the provider echoes `iss`, it must be
			// the one that started this flow. Without the check, an attacker running
			// a malicious provider can have a code from one issuer redeemed at
			// another.
			const returnedIssuer = url.searchParams.get('iss');
			if (returnedIssuer !== null && returnedIssuer !== metadata.issuer) {
				return reject('Callback issuer does not match the provider.', 'iss');
			}

			// Belt and braces: the stored verifier must still match its challenge.
			// Catches a tampered or partially-overwritten record.
			if (
				!(await verifyPkce(
					stored.codeVerifier,
					stored.codeChallenge,
					PKCE_METHOD.S256
				))
			) {
				return reject('Stored PKCE verifier does not match its challenge.', 'pkce');
			}

			const run = fetchImpl ?? globalThis.fetch;

			const tokenBody: Record<string, string> = {
				grant_type: 'authorization_code',
				code,
				redirect_uri: redirectUri,
				client_id: provider.clientId,
				code_verifier: stored.codeVerifier,
			};
			if (provider.tokenEndpointAuthMethod === TOKEN_ENDPOINT_AUTH_METHOD.POST) {
				tokenBody['client_secret'] = provider.clientSecret;
			}

			let tokenResponse: Response;
			try {
				tokenResponse = await run(
					new Request(metadata.tokenEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							Accept: 'application/json',
							// Basic is the secure default because it keeps the secret out of
							// request logs that record form bodies. POST remains available for
							// providers, such as GitHub, that require body credentials.
							...(provider.tokenEndpointAuthMethod === TOKEN_ENDPOINT_AUTH_METHOD.POST
								? {}
								: {
										Authorization: `Basic ${Buffer.from(
											`${encodeURIComponent(provider.clientId)}:${encodeURIComponent(provider.clientSecret)}`
										).toString('base64')}`,
									}),
						},
						body: new URLSearchParams(tokenBody).toString(),
					})
				);
			} catch (cause) {
				return reject(
					`Token endpoint unreachable: ${cause instanceof Error ? cause.message : String(cause)}`,
					'network'
				);
			}

			if (!tokenResponse.ok) {
				return reject(
					`Token endpoint returned ${String(tokenResponse.status)}.`,
					'token'
				);
			}

			let rawBody: unknown;
			try {
				rawBody = await tokenResponse.json();
			} catch {
				return reject('Token endpoint returned unparseable JSON.', 'token');
			}

			const parsedToken = oauthTokenResponseSchema.safeParse(rawBody);
			if (!parsedToken.success) {
				return reject('Token response has an invalid shape.', 'token');
			}
			const body = parsedToken.data;
			const accessToken = body.access_token;
			const tokenType = body.token_type;
			if (tokenType.toLowerCase() !== OAUTH_TOKEN_TYPE.BEARER) {
				return reject('Token response carried an unsupported token type.', 'token');
			}

			const tokens: OAuthTokens = {
				accessToken,
				tokenType,
				...(body.id_token === undefined ? {} : { idToken: body.id_token }),
				...(body.expires_in === undefined
					? {}
					: { expiresInSeconds: body.expires_in }),
				...(body.refresh_token === undefined
					? {}
					: { refreshToken: body.refresh_token }),
				...(body.scope === undefined ? {} : { scope: body.scope }),
			};

			if (provider.mode === OAUTH_PROVIDER_MODE.OAUTH) {
				let identity: OAuthResolvedIdentity<Profile> | undefined;
				try {
					identity = await provider.resolveIdentity({ accessToken, fetch: run });
				} catch (cause) {
					return reject(
						`Provider identity endpoint failed: ${cause instanceof Error ? cause.message : String(cause)}`,
						'userinfo'
					);
				}

				const parsedIdentity = oauthResolvedIdentitySchema.safeParse(identity);
				if (!parsedIdentity.success) {
					return reject('Provider returned an invalid identity.', 'userinfo');
				}
				identity = parsedIdentity.data as OAuthResolvedIdentity<Profile>;

				return {
					ok: true,
					profile: identity.profile,
					claims: identity.claims,
					tokens,
					redirectTo: redirects.resolve(stored.redirectTo),
					setCookies: clearing,
					emailVerified: identity.emailVerified,
				};
			}

			const idToken = body.id_token;
			if (idToken === undefined) {
				return reject('Token response carried no ID token.', 'token');
			}

			const jwks = createJwksResolver({
				jwksUri: 'jwksUri' in metadata ? metadata.jwksUri : '',
				clock,
				...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
			});

			const verified = await verifyIdToken(idToken, {
				issuer: metadata.issuer,
				audience: provider.clientId,
				nonce: stored.nonce,
				jwks,
				clock,
				accessToken,
				// Narrowed to what the provider itself advertises, intersected with
				// what this package implements.
				allowedAlgorithms: ('idTokenSigningAlgValues' in metadata
					? metadata.idTokenSigningAlgValues
					: []
				).filter(
					(algorithm): algorithm is IdTokenAlgorithm =>
						(SUPPORTED_ID_TOKEN_ALGORITHMS as readonly string[]).includes(algorithm)
				),
			});

			if (!verified.ok) {
				return { ok: false, error: verified.error, setCookies: clearing };
			}

			return {
				ok: true,
				profile: provider.profile(verified.claims),
				claims: verified.claims,
				tokens,
				// Re-validated on the way out. The stored value was checked when it
				// went in, but a store is a mutable surface and this costs nothing.
				redirectTo: redirects.resolve(stored.redirectTo),
				setCookies: clearing,
				emailVerified: verified.claims['email_verified'] === true,
			};
		},
	};
};
