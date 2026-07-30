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
 * Signing and verification for stateless tokens.
 *
 * The design is deliberately narrower than JWT, and the omissions are the
 * point:
 *
 * - **The algorithm is fixed at HMAC-SHA256 and never read from the token.**
 *   Reading an algorithm out of attacker-supplied input is the root of both
 *   `alg: none` acceptance and RS256-to-HS256 confusion. A token here has no
 *   header to lie in.
 * - **There is no `kid`.** Every configured secret is tried, so an attacker
 *   cannot steer key selection, and secret rotation still works.
 * - **Comparison is constant-time.** A byte-by-byte early exit leaks the
 *   correct signature one byte at a time to anyone who can measure responses.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigError } from '../errors.js';
import type { TokenCodec } from '../contract.js';

export interface TokenCodecOptions {
	/**
	 * Signing secrets, strongest-intent first.
	 *
	 * The first entry signs; every entry verifies. That ordering is what makes
	 * rotation a two-deploy operation with no forced sign-out: deploy with the
	 * new secret prepended, wait out the session lifetime, then drop the old one.
	 */
	readonly secrets: readonly string[];
}

/**
 * Minimum secret length in characters.
 *
 * 32 is not arbitrary: below roughly 128 bits of entropy an offline attack
 * against a captured token becomes tractable, and a session cookie is exactly
 * the kind of thing an attacker gets to keep and grind on offline.
 */
const MIN_SECRET_LENGTH = 32;

const encoder = new TextEncoder();

const base64UrlEncode = (input: string): string =>
	Buffer.from(input, 'utf8').toString('base64url');

const base64UrlDecode = (input: string): string | undefined => {
	// Reject anything outside the base64url alphabet before decoding. Node's
	// decoder is lenient and would silently accept padded or standard-base64
	// input, which lets two distinct strings produce the same payload — a
	// signature-bypass primitive.
	if (!/^[A-Za-z0-9_-]+$/.test(input)) return undefined;

	try {
		const decoded = Buffer.from(input, 'base64url').toString('utf8');
		// Round-trip check, closing the same malleability hole from the other side.
		return Buffer.from(decoded, 'utf8').toString('base64url') === input
			? decoded
			: undefined;
	} catch {
		return undefined;
	}
};

const sign = (payload: string, secret: string): string =>
	createHmac('sha256', secret).update(payload).digest('base64url');

/**
 * Compares two signatures without leaking their contents through timing.
 *
 * Both sides are hashed to a fixed width first. `timingSafeEqual` throws on a
 * length mismatch, and catching that throw would itself be a timing signal, so
 * normalising the length is what makes the comparison genuinely constant-time.
 */
const signaturesMatch = (a: string, b: string): boolean => {
	const digest = (value: string): Buffer =>
		createHmac('sha256', 'signature-comparison').update(value).digest();

	return timingSafeEqual(digest(a), digest(b));
};

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
	typeof input === 'object' && input !== null && !Array.isArray(input);

/**
 * Builds a {@link TokenCodec} over the supplied secrets.
 *
 * Throws {@link ConfigError} on a weak or absent secret. This is intentionally
 * eager: a deploy that boots healthy and only reveals its missing secret under
 * traffic is far worse than one that refuses to start.
 */
export const createTokenCodec = (options: TokenCodecOptions): TokenCodec => {
	const { secrets } = options;

	if (secrets.length === 0) {
		throw new ConfigError({
			path: 'secrets',
			reason:
				'At least one signing secret is required. Generate one with `openssl rand -base64 32`.',
		});
	}

	secrets.forEach((secret, index) => {
		if (secret.length < MIN_SECRET_LENGTH) {
			throw new ConfigError({
				path: `secrets[${String(index)}]`,
				reason: `Signing secrets must be at least ${String(MIN_SECRET_LENGTH)} characters. A shorter secret is brute-forceable offline against a captured token.`,
			});
		}
	});

	const [signingSecret] = secrets;
	// Narrowed above, but `noUncheckedIndexedAccess` needs it stated.
	if (signingSecret === undefined) {
		throw new ConfigError({ path: 'secrets', reason: 'No signing secret.' });
	}

	return {
		sign: (payload) => {
			const encoded = base64UrlEncode(JSON.stringify(payload));
			return Promise.resolve(`${encoded}.${sign(encoded, signingSecret)}`);
		},

		verify: (token) => {
			// Every early return yields `undefined` rather than throwing. This runs
			// on every request against fully attacker-controlled input, so a throw
			// would be an unhandled 500 and a one-line denial of service.
			if (typeof token !== 'string' || token.length === 0) {
				return Promise.resolve(undefined);
			}

			const separator = token.indexOf('.');
			if (separator <= 0 || separator === token.length - 1) {
				return Promise.resolve(undefined);
			}

			const encodedPayload = token.slice(0, separator);
			const signature = token.slice(separator + 1);

			// A second separator means the token is not the shape this codec emits.
			if (signature.includes('.')) return Promise.resolve(undefined);

			// Verify before decoding. Parsing an unverified payload would expose the
			// JSON parser to input no secret has vouched for.
			const trusted = secrets.some((secret) =>
				signaturesMatch(sign(encodedPayload, secret), signature)
			);
			if (!trusted) return Promise.resolve(undefined);

			const decoded = base64UrlDecode(encodedPayload);
			if (decoded === undefined) return Promise.resolve(undefined);

			try {
				const parsed: unknown = JSON.parse(decoded);
				// Arrays and primitives are valid JSON but not valid claim sets;
				// accepting them would push a shape error into every consumer.
				return Promise.resolve(isPlainObject(parsed) ? parsed : undefined);
			} catch {
				return Promise.resolve(undefined);
			}
		},
	};
};

/** Exported for the conformance suite. */
export const TOKEN_CODEC_MIN_SECRET_LENGTH = MIN_SECRET_LENGTH;

/** Not part of the public surface; used by the cookie codec for chunk naming. */
export const utf8ByteLength = (value: string): number =>
	encoder.encode(value).length;
