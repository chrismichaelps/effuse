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
 * Proof Key for Code Exchange (RFC 7636).
 *
 * Mandatory here, and S256 only. OAuth 2.1 requires PKCE for every client, and
 * the `plain` method it permits for legacy reasons offers no protection at all:
 * it transmits the secret through the same channel as the authorization code, so
 * anyone positioned to intercept one has the other. Supporting `plain` would
 * only give an attacker a downgrade to negotiate.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** The only challenge method this package accepts. */
export type PkceMethod = 'S256';

export interface PkcePair {
	/** The secret, retained by the client and sent only on token exchange. */
	readonly verifier: string;
	/** The public derivation, sent on the authorization request. */
	readonly challenge: string;
	readonly method: PkceMethod;
}

/** RFC 7636 bounds. Below 43 characters the verifier is brute-forceable. */
const MIN_VERIFIER_LENGTH = 43;
const MAX_VERIFIER_LENGTH = 128;

const UNRESERVED = /^[A-Za-z0-9\-._~]+$/;

const challengeFor = (verifier: string): string =>
	createHash('sha256').update(verifier).digest('base64url');

/**
 * Creates a verifier and its challenge.
 *
 * 32 random bytes encode to 43 base64url characters — exactly the specified
 * minimum, and 256 bits of entropy. base64url's alphabet is a subset of the
 * unreserved set the spec requires, so no further encoding is needed.
 */
export const createPkcePair = (): Promise<PkcePair> => {
	const verifier = randomBytes(32).toString('base64url');

	return Promise.resolve({
		verifier,
		challenge: challengeFor(verifier),
		method: 'S256',
	});
};

const constantTimeEquals = (a: string, b: string): boolean => {
	const digest = (value: string): Buffer =>
		createHash('sha256').update(value).digest();

	return timingSafeEqual(digest(a), digest(b));
};

/**
 * Checks a verifier against the challenge recorded when the flow started.
 *
 * Returns `false` rather than throwing for every rejection, including an
 * unrecognised method. This runs against callback parameters an attacker
 * controls, so a throw would be an unhandled 500 on the busiest path in the
 * flow.
 */
export const verifyPkce = (
	verifier: string | undefined | null,
	challenge: string,
	// Typed as a plain string, not `PkceMethod`, precisely because the value
	// arrives from a stored record or a provider response rather than from our
	// own code. Narrowing the parameter to the one permitted value would make the
	// check below dead as far as the compiler is concerned, and delete the
	// runtime guard that actually rejects a `plain` downgrade.
	method: string
): Promise<boolean> => {
	// Anything other than S256 is refused, `plain` included. There is no
	// fall-through and no default, so a provider echoing an unexpected method
	// cannot steer verification.
	if (method !== 'S256') return Promise.resolve(false);

	if (typeof verifier !== 'string') return Promise.resolve(false);
	if (
		verifier.length < MIN_VERIFIER_LENGTH ||
		verifier.length > MAX_VERIFIER_LENGTH
	) {
		return Promise.resolve(false);
	}
	if (!UNRESERVED.test(verifier)) return Promise.resolve(false);

	return Promise.resolve(constantTimeEquals(challengeFor(verifier), challenge));
};

export { MIN_VERIFIER_LENGTH, MAX_VERIFIER_LENGTH };
