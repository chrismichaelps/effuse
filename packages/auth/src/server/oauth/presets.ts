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
 * Provider presets.
 *
 * Each is a thin data object over the generic OIDC implementation — an issuer,
 * a scope list, and a profile mapper. Nothing here is provider-specific *code*.
 *
 * That is a deliberate contrast with maintaining eighty hand-written provider
 * modules, where each one accumulates its own quirks, its own bugs, and its own
 * drift from the others. When a provider changes something here, the fix is a
 * changed string. A provider nobody has written a preset for is not
 * second-class: pass an issuer and a mapper and it works identically.
 *
 * Only OpenID Connect providers are covered. Plain OAuth 2.0 services that issue
 * no ID token — GitHub being the obvious one — need a userinfo-based path that
 * has not shipped yet, and pretending otherwise here would produce a preset that
 * fails at the first callback.
 */

import type { IdTokenClaims } from './id-token.js';
import type { OAuthProvider } from './flow.js';

/** The profile shape the built-in presets produce. */
export interface StandardProfile {
	/** The provider's stable identifier for this user. Unique only within the issuer. */
	readonly providerAccountId: string;
	readonly email: string | undefined;
	/**
	 * Whether the provider asserts the email is verified.
	 *
	 * Never link accounts on an unverified email. Anyone able to register the
	 * address at a provider that does not verify it would take over the matching
	 * local account.
	 */
	readonly emailVerified: boolean;
	readonly name: string | undefined;
	readonly picture: string | undefined;
}

const asString = (value: unknown): string | undefined =>
	typeof value === 'string' && value.length > 0 ? value : undefined;

/** The default mapper, covering the standard OIDC claims. */
export const standardProfile = (claims: IdTokenClaims): StandardProfile => ({
	providerAccountId: claims.sub,
	email: asString(claims['email']),
	// Strictly `=== true`. Some providers send the string "true", and coercing it
	// would mean a provider's formatting choice silently decides whether account
	// linking is safe.
	emailVerified: claims['email_verified'] === true,
	name: asString(claims['name']),
	picture: asString(claims['picture']),
});

/** Fields a caller must supply to complete a preset. */
export interface PresetCredentials {
	readonly clientId: string;
	readonly clientSecret: string;
}

/** Google. Verified emails are asserted via `email_verified`. */
export const google = (
	credentials: PresetCredentials
): OAuthProvider<StandardProfile> => ({
	id: 'google',
	issuer: 'https://accounts.google.com',
	scopes: ['openid', 'email', 'profile'],
	profile: standardProfile,
	...credentials,
});

/**
 * Microsoft Entra ID.
 *
 * `tenant` defaults to `common`, which admits any Entra tenant *and* personal
 * Microsoft accounts. For a single-organisation application, pass the tenant id:
 * with `common`, the `tid` claim is the only thing distinguishing one
 * organisation from another, and nothing checks it for you.
 */
export const microsoft = (
	credentials: PresetCredentials & { readonly tenant?: string }
): OAuthProvider<StandardProfile> => ({
	id: 'microsoft',
	issuer: `https://login.microsoftonline.com/${credentials.tenant ?? 'common'}/v2.0`,
	scopes: ['openid', 'email', 'profile'],
	profile: standardProfile,
	clientId: credentials.clientId,
	clientSecret: credentials.clientSecret,
});

/** Auth0. `domain` is the tenant domain, e.g. `example.eu.auth0.com`. */
export const auth0 = (
	credentials: PresetCredentials & { readonly domain: string }
): OAuthProvider<StandardProfile> => ({
	id: 'auth0',
	issuer: `https://${credentials.domain}/`,
	scopes: ['openid', 'email', 'profile'],
	profile: standardProfile,
	clientId: credentials.clientId,
	clientSecret: credentials.clientSecret,
});

/** Okta. `domain` is the org domain, e.g. `example.okta.com`. */
export const okta = (
	credentials: PresetCredentials & { readonly domain: string }
): OAuthProvider<StandardProfile> => ({
	id: 'okta',
	issuer: `https://${credentials.domain}`,
	scopes: ['openid', 'email', 'profile'],
	profile: standardProfile,
	clientId: credentials.clientId,
	clientSecret: credentials.clientSecret,
});

/** Keycloak. `baseUrl` is the server root; `realm` the realm name. */
export const keycloak = (
	credentials: PresetCredentials & {
		readonly baseUrl: string;
		readonly realm: string;
	}
): OAuthProvider<StandardProfile> => ({
	id: 'keycloak',
	issuer: `${credentials.baseUrl.replace(/\/$/, '')}/realms/${credentials.realm}`,
	scopes: ['openid', 'email', 'profile'],
	profile: standardProfile,
	clientId: credentials.clientId,
	clientSecret: credentials.clientSecret,
});

/**
 * Any OIDC-conforming provider.
 *
 * The escape hatch that makes the preset list a convenience rather than a
 * gate — an unlisted provider is configured exactly as a listed one is.
 */
export const oidc = (
	options: PresetCredentials & {
		readonly id: string;
		readonly issuer: string;
		readonly scopes?: readonly string[];
	}
): OAuthProvider<StandardProfile> => ({
	id: options.id,
	issuer: options.issuer,
	scopes: options.scopes ?? ['openid', 'email', 'profile'],
	profile: standardProfile,
	clientId: options.clientId,
	clientSecret: options.clientSecret,
});
