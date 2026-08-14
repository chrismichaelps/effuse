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
 * Single-flight access-token refresh, with rotation and reuse detection.
 *
 * This is the highest-reaction open issue in the library this package exists to
 * improve on, and the cause is structural rather than a missed edge case: there,
 * refresh is left to userland inside a `jwt` callback, where it has no way to
 * coordinate across concurrent requests.
 *
 * The failure is deterministic under load. A page load fires several requests at
 * once, all of them observe the same expired access token, all of them post to
 * the token endpoint. The provider rotates the refresh token on first redemption
 * and invalidates it, so every other request redeems a token that no longer
 * exists. The user is signed out, and nothing in any log says why.
 *
 * Two mechanisms fix it, and both are needed:
 *
 * - **An in-process promise map** collapses concurrency inside one worker. This
 *   is the common case and it costs a map lookup.
 * - **A store-backed lock** excludes across processes. Production runs more than
 *   one replica, and a lock that only holds within a process is not a lock; it
 *   is a race that passes its tests.
 *
 * Rotation then introduces its own hazard. A refresh token presented twice is
 * the classic signal of theft, but it is also what a legitimate client retry
 * looks like when a response is lost in flight. Treating every repeat as theft
 * signs honest users out; treating none as theft ignores the signal entirely.
 * The resolution is the same overlap window the session engine uses: the
 * immediately-previous token stays acceptable for a bounded period, and anything
 * older is reuse.
 *
 * How far revocation then cascades is a judgement call, and this module makes a
 * deliberately narrow one. As an OAuth *client* we cannot attribute an
 * `invalid_grant` — "someone else redeemed our token", "the user revoked consent
 * upstream", and "it expired" are indistinguishable from here. So the grant's
 * rotation chain is killed and an auditable event is emitted, but the subject's
 * other sessions are left alone. Signing someone out of every device because
 * they disconnected an integration would be a worse bug than the one being
 * defended against. Applications acting as an authorization *server*, which can
 * see which token was presented and therefore can attribute reuse, get
 * {@link classifyRefreshToken} and cascade themselves.
 */

import { randomBytes } from 'node:crypto';
import {
	ProviderError,
	SessionRevokedError,
	StoreError,
	type AuthError,
} from '../../errors.js';
import type { AuthStorage, Clock, SessionStore } from '../../contract.js';
import type { OAuthFetch } from './types.js';

/** The persisted token state for one grant. */
export interface TokenRecord {
	/**
	 * Identifies the rotation chain.
	 *
	 * Revocation operates on the family rather than a single token, because a
	 * detected theft means every descendant of the stolen token is suspect.
	 */
	readonly familyId: string;
	readonly subject: string;
	readonly accessToken: string;
	/** Epoch millis. */
	readonly accessTokenExpiresAt: number;
	readonly refreshToken: string;
	/** The token this one replaced, still acceptable inside the overlap window. */
	readonly previousRefreshToken?: string;
	/** Epoch millis after which `previousRefreshToken` is treated as theft. */
	readonly previousValidUntil?: number;
	readonly scope?: string;
	readonly idToken?: string;
}

/** What a caller learns when a refresh-token reuse is detected. */
export interface ReuseDetectedEvent {
	readonly familyId: string;
	readonly subject: string;
	readonly at: number;
}

export interface TokenRefresherOptions {
	/** Where to redeem a refresh token. From the provider's discovery document. */
	readonly tokenEndpoint: string;
	readonly clientId: string;
	readonly clientSecret: string;
	/** Identifies the provider in failures. */
	readonly providerId: string;
	readonly storage: AuthStorage;
	/** Supplies the cross-process refresh lock. */
	readonly store: SessionStore;
	readonly clock: Clock;
	/**
	 * Refresh this long before the access token actually expires.
	 *
	 * Defaults to 60 seconds. Refreshing exactly at expiry guarantees a race with
	 * the resource server over whose clock is right, and the resource server
	 * always wins.
	 */
	readonly skewMs?: number;
	/**
	 * How long the refresh lock is held. Defaults to 10 seconds.
	 *
	 * Bounds the damage from a process dying mid-refresh: the lock frees itself
	 * rather than wedging the session until someone notices.
	 */
	readonly lockTtlMs?: number;
	/** How long a waiter will wait for the winner. Defaults to 5 seconds. */
	readonly waitTimeoutMs?: number;
	/** Poll interval while waiting. Defaults to 50ms. */
	readonly pollIntervalMs?: number;
	/**
	 * How long a rotated-away refresh token stays acceptable. Defaults to 30
	 * seconds — long enough for a client retry after a lost response, short
	 * enough that a stolen token is not a lasting foothold.
	 */
	readonly reuseOverlapMs?: number;
	readonly fetch?: OAuthFetch;
	/** Injected for tests, so waiting does not depend on real time. */
	readonly sleep?: (ms: number) => Promise<void>;
	/** Called when a reuse is detected, for audit. */
	readonly onReuseDetected?: (event: ReuseDetectedEvent) => void;
}

export type AccessTokenResult =
	| { readonly ok: true; readonly accessToken: string; readonly refreshed: boolean }
	| { readonly ok: false; readonly error: AuthError };

export interface TokenRefresher {
	/** Stores the tokens a completed OAuth flow produced. */
	remember(input: {
		readonly sessionId: string;
		readonly subject: string;
		readonly accessToken: string;
		readonly expiresInSeconds?: number;
		readonly refreshToken?: string;
		readonly scope?: string;
		readonly idToken?: string;
	}): Promise<void>;

	/**
	 * Returns a usable access token, refreshing if it is close to expiry.
	 *
	 * Concurrent calls for one session collapse into a single upstream request.
	 */
	getAccessToken(sessionId: string): Promise<AccessTokenResult>;

	/** The current record, for inspection. */
	read(sessionId: string): Promise<TokenRecord | undefined>;

	/** Drops the record and tombstones its rotation chain. */
	forget(sessionId: string): Promise<void>;
}

const DEFAULT_SKEW_MS = 60_000;
const DEFAULT_LOCK_TTL_MS = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 50;
const DEFAULT_REUSE_OVERLAP_MS = 30_000;

const TOKENS_NAMESPACE = 'oauth-tokens';
const REVOKED_NAMESPACE = 'oauth-revoked-families';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const createTokenRefresher = (
	options: TokenRefresherOptions
): TokenRefresher => {
	const {
		tokenEndpoint,
		clientId,
		clientSecret,
		providerId,
		storage,
		store,
		clock,
		skewMs = DEFAULT_SKEW_MS,
		lockTtlMs = DEFAULT_LOCK_TTL_MS,
		waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
		pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
		reuseOverlapMs = DEFAULT_REUSE_OVERLAP_MS,
		fetch: fetchImpl,
		sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		onReuseDetected,
	} = options;

	const tokens = storage.namespace(TOKENS_NAMESPACE);
	const revokedFamilies = storage.namespace(REVOKED_NAMESPACE);

	/**
	 * In-process coalescing.
	 *
	 * The store lock is what makes exclusion correct across replicas; this is
	 * what makes it cheap within one. Without it, ten concurrent requests in a
	 * single worker would each take a lock round-trip before nine of them
	 * discovered they had lost.
	 */
	const inFlight = new Map<string, Promise<AccessTokenResult>>();

	const failure = (detail: string, code?: string): AuthError =>
		new ProviderError({
			provider: providerId,
			detail,
			...(code === undefined ? {} : { code }),
		});

	const readRecord = async (sessionId: string): Promise<TokenRecord | undefined> => {
		const found = await tokens.get<TokenRecord>(sessionId);
		return isRecord(found) ? (found as unknown as TokenRecord) : undefined;
	};

	const isFamilyRevoked = async (familyId: string): Promise<boolean> =>
		revokedFamilies.has(familyId);

	/**
	 * Kills a rotation chain and reports it.
	 *
	 * Scoped to the family — this grant's chain — and deliberately *not* extended
	 * to every session the subject holds. As an OAuth client we cannot attribute
	 * an `invalid_grant` with confidence: it means the refresh token is gone, but
	 * "someone else redeemed it" and "the user revoked consent at the provider"
	 * and "it simply expired" all look identical from here. Signing a user out of
	 * every device because they revoked an integration would be a worse bug than
	 * the one being defended against.
	 *
	 * The event is emitted regardless, so an operator watching for a burst of
	 * these has the signal even when a single occurrence is unremarkable.
	 * Applications acting as an authorization *server* — where reuse can be
	 * attributed, because the server sees which token was presented — should use
	 * {@link classifyRefreshToken} and cascade to `destroyForSubject` themselves.
	 */
	const condemnFamily = async (record: TokenRecord): Promise<void> => {
		await revokedFamilies.set(record.familyId, true, {
			// Kept well past any refresh token's life so a late replay still finds
			// the tombstone rather than a clean slate.
			ttlMs: 30 * 24 * 60 * 60_000,
		});

		onReuseDetected?.({
			familyId: record.familyId,
			subject: record.subject,
			at: clock.now(),
		});
	};

	const needsRefresh = (record: TokenRecord): boolean =>
		clock.now() >= record.accessTokenExpiresAt - skewMs;

	/** Performs the upstream exchange. Assumes the lock is held. */
	const exchange = async (
		sessionId: string,
		record: TokenRecord
	): Promise<AccessTokenResult> => {
		const run = fetchImpl ?? globalThis.fetch;

		let response: Response;
		try {
			response = await run(
				new Request(tokenEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Accept: 'application/json',
						Authorization: `Basic ${Buffer.from(
							`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
						).toString('base64')}`,
					},
					body: new URLSearchParams({
						grant_type: 'refresh_token',
						refresh_token: record.refreshToken,
						client_id: clientId,
					}).toString(),
				})
			);
		} catch (cause) {
			return {
				ok: false,
				error: failure(
					`Token endpoint unreachable: ${cause instanceof Error ? cause.message : String(cause)}`,
					'network'
				),
			};
		}

		if (!response.ok) {
			// `invalid_grant` from the provider means the refresh token is gone —
			// revoked, expired, or already redeemed elsewhere. The session cannot be
			// recovered, so it is torn down rather than retried into a loop.
			if (response.status === 400 || response.status === 401) {
				await condemnFamily(record);
				await tokens.delete(sessionId);
				return { ok: false, error: new SessionRevokedError() };
			}

			return {
				ok: false,
				error: failure(`Token endpoint returned ${String(response.status)}.`, 'token'),
			};
		}

		let body: unknown;
		try {
			body = await response.json();
		} catch {
			return { ok: false, error: failure('Token response was unparseable.', 'token') };
		}

		if (!isRecord(body)) {
			return { ok: false, error: failure('Token response is not an object.', 'token') };
		}

		const accessToken = body['access_token'];
		if (typeof accessToken !== 'string' || accessToken.length === 0) {
			return { ok: false, error: failure('Token response carried no access token.', 'token') };
		}

		const expiresIn =
			typeof body['expires_in'] === 'number' ? body['expires_in'] : 3600;

		// Providers may or may not rotate. When they do, the old token becomes the
		// overlap token; when they do not, the same token carries forward and there
		// is nothing to overlap.
		const rotated =
			typeof body['refresh_token'] === 'string' && body['refresh_token'].length > 0
				? body['refresh_token']
				: record.refreshToken;

		const next: TokenRecord = {
			familyId: record.familyId,
			subject: record.subject,
			accessToken,
			accessTokenExpiresAt: clock.now() + expiresIn * 1000,
			refreshToken: rotated,
			...(rotated === record.refreshToken
				? {}
				: {
						previousRefreshToken: record.refreshToken,
						previousValidUntil: clock.now() + reuseOverlapMs,
					}),
			...(typeof body['scope'] === 'string' ? { scope: body['scope'] } : {}),
			...(typeof body['id_token'] === 'string' ? { idToken: body['id_token'] } : {}),
		};

		await tokens.set(sessionId, next);

		return { ok: true, accessToken, refreshed: true };
	};

	const refreshWithLock = async (sessionId: string): Promise<AccessTokenResult> => {
		const lockKey = `refresh:${sessionId}`;
		const deadline = clock.now() + waitTimeoutMs;

		for (;;) {
			const current = await readRecord(sessionId);
			if (current === undefined) {
				return { ok: false, error: new SessionRevokedError() };
			}

			if (await isFamilyRevoked(current.familyId)) {
				return { ok: false, error: new SessionRevokedError() };
			}

			// Someone else may have completed the refresh while we waited.
			if (!needsRefresh(current)) {
				return { ok: true, accessToken: current.accessToken, refreshed: false };
			}

			let lock;
			try {
				lock = await store.acquireLock(lockKey, lockTtlMs);
			} catch (cause) {
				return {
					ok: false,
					error: new StoreError({
						operation: 'acquireLock',
						cause,
						detail: cause instanceof Error ? cause.message : String(cause),
					}),
				};
			}

			if (lock !== undefined) {
				try {
					// Double-checked locking, and not ceremony. Between the read above
					// and this acquisition, another replica may have won the lock,
					// refreshed, rotated the token, and released — in which case
					// `current` now names a refresh token the provider has already
					// redeemed. Exchanging it would draw `invalid_grant` and tear down
					// a perfectly healthy session, reintroducing the exact bug the lock
					// exists to prevent.
					const fresh = await readRecord(sessionId);
					if (fresh === undefined) {
						return { ok: false, error: new SessionRevokedError() };
					}
					if (await isFamilyRevoked(fresh.familyId)) {
						return { ok: false, error: new SessionRevokedError() };
					}
					if (!needsRefresh(fresh)) {
						return { ok: true, accessToken: fresh.accessToken, refreshed: false };
					}

					return await exchange(sessionId, fresh);
				} finally {
					// Released in `finally` so a throw inside the exchange cannot leave
					// the lock held for its full TTL.
					await lock.release();
				}
			}

			// Lost the race. Wait for the winner rather than issuing our own
			// request — that duplicate request is the entire bug being fixed.
			if (clock.now() >= deadline) {
				return {
					ok: false,
					error: failure(
						'Timed out waiting for a concurrent token refresh.',
						'refresh-timeout'
					),
				};
			}

			await sleep(pollIntervalMs);
		}
	};

	return {
		remember: async ({
			sessionId,
			subject,
			accessToken,
			expiresInSeconds = 3600,
			refreshToken,
			scope,
			idToken,
		}) => {
			const record: TokenRecord = {
				familyId: randomBytes(16).toString('base64url'),
				subject,
				accessToken,
				accessTokenExpiresAt: clock.now() + expiresInSeconds * 1000,
				refreshToken: refreshToken ?? '',
				...(scope === undefined ? {} : { scope }),
				...(idToken === undefined ? {} : { idToken }),
			};

			await tokens.set(sessionId, record);
		},

		read: readRecord,

		forget: async (sessionId) => {
			const record = await readRecord(sessionId);
			await tokens.delete(sessionId);

			// The family is tombstoned as well, so a refresh token captured before
			// sign-out cannot be redeemed afterwards.
			if (record !== undefined) {
				await revokedFamilies.set(record.familyId, true, {
					ttlMs: 30 * 24 * 60 * 60_000,
				});
			}
		},

		getAccessToken: async (sessionId) => {
			const record = await readRecord(sessionId);

			if (record === undefined) {
				return { ok: false, error: new SessionRevokedError() };
			}

			if (await isFamilyRevoked(record.familyId)) {
				return { ok: false, error: new SessionRevokedError() };
			}

			// The fast path: no lock, no upstream call, no coalescing bookkeeping.
			if (!needsRefresh(record)) {
				return { ok: true, accessToken: record.accessToken, refreshed: false };
			}

			if (record.refreshToken === '') {
				// Nothing to refresh with. Honest failure rather than a pointless
				// round-trip that the provider will reject.
				return {
					ok: false,
					error: failure('Access token expired and no refresh token is held.', 'no-refresh-token'),
				};
			}

			const existing = inFlight.get(sessionId);
			if (existing !== undefined) return existing;

			const attempt = refreshWithLock(sessionId).finally(() => {
				inFlight.delete(sessionId);
			});

			inFlight.set(sessionId, attempt);

			return attempt;
		},
	};
};

/**
 * Records the outcome of presenting a refresh token, applying reuse detection.
 *
 * Exposed separately from {@link TokenRefresher} because reuse detection is only
 * meaningful for an authorization *server* — a client that holds its own tokens
 * never presents an old one on purpose. Applications acting as a provider use
 * this; applications merely consuming a provider do not.
 */
export interface ReuseVerdict {
	readonly outcome: 'current' | 'overlap' | 'reuse';
	readonly record: TokenRecord;
}

export const classifyRefreshToken = (
	record: TokenRecord,
	presented: string,
	now: number
): ReuseVerdict['outcome'] => {
	if (presented === record.refreshToken) return 'current';

	// A retry inside the overlap window is a lost response, not a theft. Without
	// this distinction, a flaky network signs honest users out.
	if (
		record.previousRefreshToken !== undefined &&
		presented === record.previousRefreshToken &&
		record.previousValidUntil !== undefined &&
		now <= record.previousValidUntil
	) {
		return 'overlap';
	}

	// Anything else is a token that was rotated away long enough ago that no
	// legitimate client would still be holding it.
	return 'reuse';
};
