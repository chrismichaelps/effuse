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
 * ID token validation.
 *
 * An ID token is an assertion about who signed in, supplied over a channel the
 * user's browser touched. Every field has to be checked, and the checks have a
 * required order: signature first, claims second. Reading claims from an
 * unverified token — even to decide which key to fetch — is how "we validate the
 * issuer" becomes "we validate the issuer the attacker told us about".
 *
 * On algorithm selection specifically. The header's `alg` is attacker-supplied,
 * so it can never *choose* the verification routine. What it may do is be
 * checked against the set the provider's own metadata advertises, and rejected
 * if absent from it. The key's type is then confirmed to match. That combination
 * closes both classic attacks:
 *
 * - **`alg: none`** — never in an allowlist, and a signature-free token is
 *   rejected before any comparison.
 * - **RS256 to HS256 confusion** — an attacker re-signs with the provider's
 *   *public* key as an HMAC secret and claims it is symmetric. Here HMAC
 *   algorithms are never permitted for ID tokens, and the key material is an
 *   asymmetric `KeyObject` that cannot be used as an HMAC secret.
 */

import { createHash, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';
import { ProviderError, type AuthError } from '../../errors.js';
import type { Clock } from '../../contract.js';

/** Signature algorithms this package will verify. */
export type IdTokenAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384';

const ALGORITHM_DIGESTS: Readonly<Record<IdTokenAlgorithm, string>> = {
	RS256: 'sha256',
	RS384: 'sha384',
	RS512: 'sha512',
	ES256: 'sha256',
	ES384: 'sha384',
};

const SUPPORTED: ReadonlySet<string> = new Set(Object.keys(ALGORITHM_DIGESTS));

/** Resolves a signing key by `kid`. */
export interface JwksResolver {
	/** Returns the JWK for a key id, refetching once if it is unknown. */
	get(keyId: string | undefined): Promise<Record<string, unknown> | undefined>;
}

export interface VerifyIdTokenOptions {
	/** The issuer the discovery document declared. Compared exactly. */
	readonly issuer: string;
	/** This client's id. The token's `aud` must contain it. */
	readonly audience: string;
	/** The nonce sent on the authorization request. Required for OIDC. */
	readonly nonce?: string;
	readonly jwks: JwksResolver;
	readonly clock: Clock;
	/**
	 * Tolerance for clock disagreement between us and the provider. Defaults to
	 * 60 seconds — enough for ordinary NTP drift, short enough that an expired
	 * token is not usable for long.
	 */
	readonly clockSkewMs?: number;
	/**
	 * Algorithms the provider's metadata advertises. Defaults to RS256 only.
	 *
	 * Narrower is safer: this is the set an attacker's header value is checked
	 * against, so listing an algorithm the provider never uses only widens what a
	 * forger may attempt.
	 */
	readonly allowedAlgorithms?: readonly IdTokenAlgorithm[];
	/** When present, `at_hash` is required and checked against it. */
	readonly accessToken?: string;
	/** Required maximum age of the authentication, in seconds. */
	readonly maxAgeSeconds?: number;
}

export interface IdTokenClaims {
	readonly sub: string;
	readonly iss: string;
	readonly aud: string | readonly string[];
	readonly exp: number;
	readonly iat: number;
	readonly [claim: string]: unknown;
}

export type VerifyIdTokenResult =
	| { readonly ok: true; readonly claims: IdTokenClaims }
	| { readonly ok: false; readonly error: AuthError };

const DEFAULT_CLOCK_SKEW_MS = 60_000;

const fail = (provider: string, detail: string, code?: string): VerifyIdTokenResult => ({
	ok: false,
	error: new ProviderError({
		provider,
		detail,
		...(code === undefined ? {} : { code }),
	}),
});

const decodeSegment = (segment: string): unknown => {
	if (!/^[A-Za-z0-9_-]+$/.test(segment)) return undefined;

	try {
		return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
	} catch {
		return undefined;
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Verifies an ID token and returns its claims.
 *
 * Never throws. Callback parameters are attacker-controlled, and an exception on
 * this path would be an unhandled 500 in the middle of a sign-in.
 */
export const verifyIdToken = async (
	token: string,
	options: VerifyIdTokenOptions
): Promise<VerifyIdTokenResult> => {
	const {
		issuer,
		audience,
		nonce,
		jwks,
		clock,
		clockSkewMs = DEFAULT_CLOCK_SKEW_MS,
		allowedAlgorithms = ['RS256'],
		accessToken,
		maxAgeSeconds,
	} = options;

	if (typeof token !== 'string' || token.length === 0) {
		return fail(issuer, 'No ID token supplied.');
	}

	const segments = token.split('.');
	if (segments.length !== 3) {
		return fail(issuer, 'ID token is not a three-segment JWS.');
	}

	const [encodedHeader, encodedPayload, encodedSignature] = segments;
	if (
		encodedHeader === undefined ||
		encodedPayload === undefined ||
		encodedSignature === undefined
	) {
		return fail(issuer, 'ID token is malformed.');
	}

	// A signature-free token is rejected here, before anything reads a claim.
	// This is the `alg: none` shape, and treating it as merely "unsigned but
	// otherwise fine" is the whole attack.
	if (encodedSignature.length === 0) {
		return fail(issuer, 'ID token carries no signature.', 'unsigned');
	}

	const header = decodeSegment(encodedHeader);
	if (!isRecord(header)) return fail(issuer, 'ID token header is not an object.');

	const algorithm = header['alg'];
	if (typeof algorithm !== 'string') {
		return fail(issuer, 'ID token header declares no algorithm.');
	}

	// The header may not choose the routine; it may only be checked against what
	// the provider says it uses. Anything outside that set — `none`, an HMAC
	// algorithm, an algorithm this package does not implement — is refused.
	if (!SUPPORTED.has(algorithm)) {
		return fail(issuer, `Unsupported ID token algorithm "${algorithm}".`, 'alg');
	}
	if (!(allowedAlgorithms as readonly string[]).includes(algorithm)) {
		return fail(
			issuer,
			`Algorithm "${algorithm}" is not advertised by this provider.`,
			'alg'
		);
	}

	const keyId = typeof header['kid'] === 'string' ? header['kid'] : undefined;
	const jwk = await jwks.get(keyId);
	if (jwk === undefined) {
		return fail(issuer, `No signing key for kid "${keyId ?? '(none)'}".`, 'kid');
	}

	let verified = false;
	try {
		const key = createPublicKey({ key: jwk as never, format: 'jwk' });

		// The key type must match the algorithm family. Without this an EC key
		// could be presented for an RS256 header, and the mismatch would surface
		// as a confusing crypto error rather than a rejection.
		const expectedType = algorithm.startsWith('ES') ? 'ec' : 'rsa';
		if (key.asymmetricKeyType !== expectedType) {
			return fail(issuer, 'Signing key type does not match the algorithm.', 'alg');
		}

		verified = cryptoVerify(
			ALGORITHM_DIGESTS[algorithm as IdTokenAlgorithm],
			Buffer.from(`${encodedHeader}.${encodedPayload}`),
			// ECDSA JWS signatures are raw r||s, not DER, which is what Node
			// expects by default.
			algorithm.startsWith('ES')
				? { key, dsaEncoding: 'ieee-p1363' }
				: key,
			Buffer.from(encodedSignature, 'base64url')
		);
	} catch {
		return fail(issuer, 'ID token signature could not be verified.');
	}

	if (!verified) {
		return fail(issuer, 'ID token signature did not verify.', 'signature');
	}

	// Only now are the claims trustworthy enough to read.
	const payload = decodeSegment(encodedPayload);
	if (!isRecord(payload)) return fail(issuer, 'ID token payload is not an object.');

	if (payload['iss'] !== issuer) {
		// Exact match. A prefix or suffix comparison lets
		// `https://idp.example.com.evil.example` pass.
		return fail(issuer, 'ID token issuer does not match the provider.', 'iss');
	}

	const rawAudience = payload['aud'];
	const audiences =
		typeof rawAudience === 'string'
			? [rawAudience]
			: Array.isArray(rawAudience)
				? rawAudience.filter((entry): entry is string => typeof entry === 'string')
				: [];

	if (!audiences.includes(audience)) {
		// Token substitution: an assertion minted for a different client must not
		// be redeemable here.
		return fail(issuer, 'ID token audience does not include this client.', 'aud');
	}

	// With multiple audiences, `azp` must name us — otherwise a token issued to a
	// third party that merely lists us is accepted as our own.
	if (audiences.length > 1) {
		const authorizedParty = payload['azp'];
		if (authorizedParty !== audience) {
			return fail(issuer, 'ID token has multiple audiences and azp is not this client.', 'azp');
		}
	}

	const expiry = payload['exp'];
	if (typeof expiry !== 'number' || !Number.isFinite(expiry)) {
		return fail(issuer, 'ID token has no usable expiry.', 'exp');
	}
	if (clock.now() > expiry * 1000 + clockSkewMs) {
		return fail(issuer, 'ID token has expired.', 'exp');
	}

	const issuedAt = payload['iat'];
	if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt)) {
		return fail(issuer, 'ID token has no usable issued-at.', 'iat');
	}
	// A token issued in the future is either a badly skewed provider or a forged
	// claim intended to extend usable lifetime.
	if (issuedAt * 1000 > clock.now() + clockSkewMs) {
		return fail(issuer, 'ID token was issued in the future.', 'iat');
	}

	if (typeof payload['sub'] !== 'string' || payload['sub'].length === 0) {
		return fail(issuer, 'ID token has no subject.', 'sub');
	}

	// Replay protection. Required whenever a nonce was sent, and a token that
	// simply omits it must not pass — that would make the check opt-out for
	// anyone able to strip a claim.
	if (nonce !== undefined) {
		const presented = payload['nonce'];
		if (typeof presented !== 'string') {
			return fail(issuer, 'ID token is missing the nonce.', 'nonce');
		}
		if (
			presented.length !== nonce.length ||
			!timingSafeEqual(Buffer.from(presented), Buffer.from(nonce))
		) {
			return fail(issuer, 'ID token nonce does not match.', 'nonce');
		}
	}

	// Binds the ID token to the access token issued alongside it, so one cannot
	// be swapped for another party's.
	if (accessToken !== undefined) {
		const presented = payload['at_hash'];
		if (typeof presented !== 'string') {
			return fail(issuer, 'ID token is missing at_hash.', 'at_hash');
		}

		const expected = createHash('sha256')
			.update(accessToken)
			.digest()
			.subarray(0, 16)
			.toString('base64url');

		if (
			presented.length !== expected.length ||
			!timingSafeEqual(Buffer.from(presented), Buffer.from(expected))
		) {
			return fail(issuer, 'ID token at_hash does not match the access token.', 'at_hash');
		}
	}

	if (maxAgeSeconds !== undefined) {
		const authTime = payload['auth_time'];
		if (typeof authTime !== 'number') {
			return fail(issuer, 'max_age was requested but auth_time is absent.', 'auth_time');
		}
		if (clock.now() - authTime * 1000 > maxAgeSeconds * 1000 + clockSkewMs) {
			return fail(issuer, 'Authentication is older than the requested max_age.', 'auth_time');
		}
	}

	return { ok: true, claims: payload as unknown as IdTokenClaims };
};
