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
 * Signing-key retrieval.
 *
 * Providers rotate keys, which means an unknown `kid` is an ordinary event
 * rather than an attack — refusing to refetch would break sign-in every time a
 * provider rolled a key. But refetching on *every* unknown `kid` hands an
 * attacker a way to make us hammer the provider by minting tokens with random
 * key ids, so the refetch is rate-limited.
 *
 * Keys are cached by `kid` with a TTL. Nothing about which key to use is taken
 * from the token beyond the `kid` itself, and a `kid` that is not in the
 * published set resolves to nothing rather than to a fallback key.
 */

import type { Clock } from '../../contract.js';
import type { JwksResolver } from './id-token.js';
import type { OAuthFetch } from './types.js';

export interface JwksResolverOptions {
	/** The `jwks_uri` from the provider's discovery document. */
	readonly jwksUri: string;
	readonly clock: Clock;
	/** How long a fetched key set is reused. Defaults to one hour. */
	readonly cacheTtlMs?: number;
	/**
	 * Minimum interval between refetches triggered by an unknown `kid`.
	 * Defaults to five minutes.
	 */
	readonly minRefetchIntervalMs?: number;
	/** Injected for tests. Defaults to global `fetch`. */
	readonly fetch?: OAuthFetch;
}

const DEFAULT_CACHE_TTL_MS = 60 * 60_000;
const DEFAULT_MIN_REFETCH_INTERVAL_MS = 5 * 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const createJwksResolver = (
	options: JwksResolverOptions
): JwksResolver => {
	const {
		jwksUri,
		clock,
		cacheTtlMs = DEFAULT_CACHE_TTL_MS,
		minRefetchIntervalMs = DEFAULT_MIN_REFETCH_INTERVAL_MS,
		fetch: fetchImpl,
	} = options;

	// Refuse a plaintext key endpoint. Keys fetched over http can be substituted
	// in transit, at which point every signature check is meaningless. Loopback
	// is exempt so a local fake provider can be used in tests.
	const uri = new URL(jwksUri);
	const loopback =
		uri.hostname === 'localhost' ||
		uri.hostname === '127.0.0.1' ||
		uri.hostname === '[::1]';

	let keys: ReadonlyMap<string, Record<string, unknown>> = new Map();
	/** Keys published without a `kid`, usable only when the token omits one too. */
	let anonymousKeys: readonly Record<string, unknown>[] = [];
	let fetchedAt = Number.NEGATIVE_INFINITY;
	let lastAttemptAt = Number.NEGATIVE_INFINITY;
	/** In-flight fetch, so concurrent misses collapse into one request. */
	let inFlight: Promise<void> | undefined;

	const doFetch = async (): Promise<void> => {
		lastAttemptAt = clock.now();

		const run = fetchImpl ?? globalThis.fetch;
		const response = await run(jwksUri);
		if (!response.ok) return;

		const body: unknown = await response.json();
		if (!isRecord(body) || !Array.isArray(body['keys'])) return;

		const next = new Map<string, Record<string, unknown>>();
		const anonymous: Record<string, unknown>[] = [];

		for (const entry of body['keys']) {
			if (!isRecord(entry)) continue;
			// Only signing keys. An encryption key presented for verification is
			// either a provider bug or an attempt to widen what we will accept.
			if (entry['use'] !== undefined && entry['use'] !== 'sig') continue;

			if (typeof entry['kid'] === 'string') {
				next.set(entry['kid'], entry);
				continue;
			}
			anonymous.push(entry);
		}

		keys = next;
		anonymousKeys = anonymous;
		fetchedAt = clock.now();
	};

	const refresh = async (): Promise<void> => {
		// Collapse concurrent refreshes. Without this, a burst of sign-ins after a
		// key rotation produces a burst of identical requests to the provider.
		inFlight ??= doFetch().finally(() => {
			inFlight = undefined;
		});

		try {
			await inFlight;
		} catch {
			// A failed fetch leaves the previous cache in place. Serving a slightly
			// stale key set is better than failing every sign-in because the
			// provider had a blip.
		}
	};

	return {
		get: async (keyId) => {
			if (uri.protocol !== 'https:' && !loopback) return undefined;

			const stale = clock.now() - fetchedAt > cacheTtlMs;
			if (stale) await refresh();

			const hit =
				keyId === undefined ? anonymousKeys[0] : keys.get(keyId);
			if (hit !== undefined) return hit;

			// Unknown key id. Rotation makes this legitimate, so one refetch is
			// warranted — but only if we have not just done so. The interval is what
			// stops a stream of forged tokens with random key ids from turning into
			// a stream of requests to the provider.
			if (clock.now() - lastAttemptAt < minRefetchIntervalMs) return undefined;

			await refresh();

			return keyId === undefined ? anonymousKeys[0] : keys.get(keyId);
		},
	};
};
