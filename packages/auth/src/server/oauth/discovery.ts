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
 * OpenID Connect discovery.
 *
 * One correct implementation, configured per provider, rather than a directory
 * of hand-maintained provider files. A preset here is data — endpoints and a
 * profile mapper — so a provider bug is a data fix rather than a code fix, and a
 * provider nobody has written a preset for is still fully supported.
 */

import type { Clock } from '../../contract.js';
import { DEFAULT_ID_TOKEN_ALGORITHMS } from './constants.js';
import { oidcDiscoveryDocumentSchema } from './schemas.js';
import { isSafeOAuthEndpoint, parseJsonResponse } from './utils.js';
import type { OAuthFetch } from './types.js';

export interface OAuthProviderMetadata {
	readonly issuer: string;
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly codeChallengeMethods: readonly string[];
}

export interface ProviderMetadata extends OAuthProviderMetadata {
	readonly jwksUri: string;
	readonly userinfoEndpoint?: string;
	/** Algorithms the provider says it signs ID tokens with. */
	readonly idTokenSigningAlgValues: readonly string[];
}

export interface DiscoveryOptions {
	/** The issuer identifier, without the well-known suffix. */
	readonly issuer: string;
	readonly clock: Clock;
	/** How long a fetched document is reused. Defaults to 24 hours. */
	readonly cacheTtlMs?: number;
	readonly fetch?: OAuthFetch;
}

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60_000;

export interface DiscoveryClient {
	/** Fetches and caches the provider's metadata. */
	load(): Promise<ProviderMetadata | undefined>;
}

/**
 * Builds a discovery client for an issuer.
 *
 * The document is cached because it changes rarely and a fetch on every sign-in
 * would put the provider's availability directly in the path of ours.
 */
export const createDiscoveryClient = (
	options: DiscoveryOptions
): DiscoveryClient => {
	const {
		issuer,
		clock,
		cacheTtlMs = DEFAULT_CACHE_TTL_MS,
		fetch: fetchImpl,
	} = options;

	let cached: ProviderMetadata | undefined;
	let fetchedAt = Number.NEGATIVE_INFINITY;
	let inFlight: Promise<ProviderMetadata | undefined> | undefined;

	const wellKnown = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

	const doLoad = async (): Promise<ProviderMetadata | undefined> => {
		// Validate the issuer before the first network request. Otherwise an invalid
		// configuration could make discovery contact a plaintext remote origin even
		// though the endpoints in its response would later be rejected.
		if (!isSafeOAuthEndpoint(issuer)) return undefined;

		const run = fetchImpl ?? globalThis.fetch;

		const response = await run(wellKnown);
		if (!response.ok) return undefined;

		const body = await parseJsonResponse(response, oidcDiscoveryDocumentSchema);
		if (body === undefined) return undefined;

		// The document declares its own issuer, and it must match the one we asked
		// about. A mismatch means the discovery endpoint is serving metadata for
		// somebody else — accepting it would point every subsequent request,
		// including the key fetch, at an issuer we never chose.
		const declaredIssuer = body.issuer;
		if (declaredIssuer !== issuer) return undefined;

		const authorizationEndpoint = body.authorization_endpoint;
		const tokenEndpoint = body.token_endpoint;
		const jwksUri = body.jwks_uri;

		// Every endpoint we will subsequently talk to must be https. A provider
		// advertising a plaintext token endpoint would have us post an
		// authorization code in the clear.
		for (const endpoint of [
			authorizationEndpoint,
			tokenEndpoint,
			jwksUri,
			...(body.userinfo_endpoint === undefined ? [] : [body.userinfo_endpoint]),
		]) {
			if (!isSafeOAuthEndpoint(endpoint)) return undefined;
		}

		const metadata: ProviderMetadata = {
			issuer: declaredIssuer,
			authorizationEndpoint,
			tokenEndpoint,
			jwksUri,
			...(body.userinfo_endpoint === undefined
				? {}
				: { userinfoEndpoint: body.userinfo_endpoint }),
			// Defaulted rather than left empty: a provider that omits the field
			// almost certainly means RS256, and an empty allowlist would reject
			// every token it issues.
			idTokenSigningAlgValues:
				body.id_token_signing_alg_values_supported.length > 0
					? body.id_token_signing_alg_values_supported
					: DEFAULT_ID_TOKEN_ALGORITHMS,
			codeChallengeMethods: body.code_challenge_methods_supported,
		};

		cached = metadata;
		fetchedAt = clock.now();

		return metadata;
	};

	return {
		load: async () => {
			if (cached !== undefined && clock.now() - fetchedAt <= cacheTtlMs) {
				return cached;
			}

			// Concurrent misses collapse into one request.
			inFlight ??= doLoad().finally(() => {
				inFlight = undefined;
			});

			try {
				return await inFlight;
			} catch {
				// A failed refresh keeps the previous document rather than failing
				// every sign-in over a provider blip.
				return cached;
			}
		},
	};
};
