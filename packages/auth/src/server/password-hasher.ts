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
 * Password hashing on `node:crypto`'s scrypt.
 *
 * scrypt rather than Argon2id purely because it is in the standard library.
 * Argon2id is the stronger choice and is fully supported — supply an
 * implementation of {@link PasswordHasher} — but a default that needs a native
 * module is a default that gets skipped, and skipped hashing is worse than
 * merely good hashing.
 *
 * The stored format is self-describing:
 *
 * ```
 * scrypt$<N>$<r>$<p>$<salt-base64url>$<derived-key-base64url>
 * ```
 *
 * Recording the parameters alongside the hash is what makes cost increases
 * possible without a migration. An old row still carries everything needed to
 * verify it, so old and new coexist while {@link PasswordHasher.needsRehash}
 * upgrades records opportunistically as users sign in.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../contract.js';

export interface ScryptParameters {
	/** CPU/memory cost, `N`. Must be a power of two. */
	readonly cost: number;
	/** Block size, `r`. */
	readonly blockSize: number;
	/** Parallelism, `p`. */
	readonly parallelism: number;
}

/**
 * OWASP's current floor for scrypt: N=2^17, r=8, p=1.
 *
 * Defaults are what most deployments run, so the default has to be the
 * recommended setting rather than a comfortable one.
 */
export const DEFAULT_SCRYPT_PARAMETERS: ScryptParameters = {
	cost: 2 ** 17,
	blockSize: 8,
	parallelism: 1,
};

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = 'scrypt';

/**
 * Ceiling on the work a *stored* hash may demand.
 *
 * Verification takes its parameters from the stored hash, which means a tampered
 * or corrupted row could otherwise ask for gigabytes of memory and turn the
 * sign-in endpoint into a denial-of-service lever. scrypt's memory use is
 * roughly `128 * N * r` bytes, so this caps a single verification near 1 GiB.
 */
const MAX_MEMORY_BYTES = 1024 * 1024 * 1024;

const derive = (
	password: string,
	salt: Buffer,
	parameters: ScryptParameters
): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		scrypt(
			password,
			salt,
			KEY_LENGTH,
			{
				N: parameters.cost,
				r: parameters.blockSize,
				p: parameters.parallelism,
				// Node's default maxmem is 32 MiB, which N=2^17 exceeds. Raised to
				// the ceiling we enforce ourselves rather than left to reject valid
				// parameters at random.
				maxmem: MAX_MEMORY_BYTES + 1024 * 1024,
			},
			(error, derivedKey) => {
				if (error !== null) {
					reject(error instanceof Error ? error : new Error(String(error)));
					return;
				}
				resolve(derivedKey);
			}
		);
	});

interface ParsedHash {
	readonly parameters: ScryptParameters;
	readonly salt: Buffer;
	readonly derivedKey: Buffer;
}

const isPowerOfTwo = (value: number): boolean =>
	Number.isInteger(value) && value > 1 && (value & (value - 1)) === 0;

/** Returns `undefined` for anything that is not a well-formed hash of ours. */
const parse = (stored: string): ParsedHash | undefined => {
	if (typeof stored !== 'string') return undefined;

	const parts = stored.split('$');
	if (parts.length !== 6) return undefined;

	const [prefix, costRaw, blockSizeRaw, parallelismRaw, saltRaw, keyRaw] = parts;
	if (prefix !== PREFIX) return undefined;
	if (
		costRaw === undefined ||
		blockSizeRaw === undefined ||
		parallelismRaw === undefined ||
		saltRaw === undefined ||
		keyRaw === undefined
	) {
		return undefined;
	}

	const cost = Number(costRaw);
	const blockSize = Number(blockSizeRaw);
	const parallelism = Number(parallelismRaw);

	if (!isPowerOfTwo(cost)) return undefined;
	if (!Number.isInteger(blockSize) || blockSize < 1) return undefined;
	if (!Number.isInteger(parallelism) || parallelism < 1) return undefined;

	// Enforced before any derivation is attempted, so a hostile row is rejected
	// rather than allocated for.
	if (128 * cost * blockSize > MAX_MEMORY_BYTES) return undefined;

	const salt = Buffer.from(saltRaw, 'base64url');
	const derivedKey = Buffer.from(keyRaw, 'base64url');

	if (salt.length === 0 || derivedKey.length === 0) return undefined;
	// Guard against a truncated or padded encoding that decodes to a
	// different-length buffer than it claims.
	if (salt.toString('base64url') !== saltRaw) return undefined;
	if (derivedKey.toString('base64url') !== keyRaw) return undefined;

	return { parameters: { cost, blockSize, parallelism }, salt, derivedKey };
};

/**
 * Builds a {@link PasswordHasher} over scrypt.
 *
 * `verify` never throws. A corrupted or foreign row in the users table should
 * fail one sign-in, not take the endpoint down for everyone.
 */
export const createScryptHasher = (
	parameters: ScryptParameters = DEFAULT_SCRYPT_PARAMETERS
): PasswordHasher => ({
	hash: async (password) => {
		const salt = randomBytes(SALT_LENGTH);
		const derivedKey = await derive(password, salt, parameters);

		return [
			PREFIX,
			String(parameters.cost),
			String(parameters.blockSize),
			String(parameters.parallelism),
			salt.toString('base64url'),
			derivedKey.toString('base64url'),
		].join('$');
	},

	verify: async (password, storedHash) => {
		const parsed = parse(storedHash);
		if (parsed === undefined) return false;

		try {
			const candidate = await derive(password, parsed.salt, parsed.parameters);

			// Length is checked first because `timingSafeEqual` throws on a
			// mismatch, and a thrown comparison is itself an observable signal.
			if (candidate.length !== parsed.derivedKey.length) return false;

			return timingSafeEqual(candidate, parsed.derivedKey);
		} catch {
			return false;
		}
	},

	needsRehash: (storedHash) => {
		const parsed = parse(storedHash);

		// Unparseable means either corruption or a hash from another system. Both
		// want replacing at the next opportunity, and saying "no rehash needed"
		// would freeze a foreign or broken hash in place forever.
		if (parsed === undefined) return true;

		return (
			parsed.parameters.cost < parameters.cost ||
			parsed.parameters.blockSize < parameters.blockSize ||
			parsed.parameters.parallelism < parameters.parallelism
		);
	},
});
