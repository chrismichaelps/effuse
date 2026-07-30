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
 * The session engine.
 *
 * Two strategies sit behind one interface, so choosing between them is a
 * configuration change rather than a rewrite:
 *
 * - **Stateless** — the session travels inside a signed token. No store read on
 *   the hot path. Revocation requires a store; without one, the only bound on a
 *   stolen token is its expiry, and {@link SessionEngine.supportsRevocation}
 *   says so rather than letting `destroy` quietly do nothing.
 * - **Stateful** — the token carries an opaque id and the payload lives in a
 *   {@link SessionStore}. Revocable at any moment.
 *
 * The interesting design work is in rotation. Regenerating the identifier on
 * every privilege change is the standard session-fixation defence, but done
 * naively it introduces a worse bug: two concurrent requests both rotate, each
 * writes a different cookie, and whichever response lands second wins while the
 * other's session is orphaned. The user is signed out for no reason.
 *
 * The fix is an overlap window. A rotated-away session is not deleted; it is
 * marked as superseded, and for a short period a request still carrying it is
 * transparently resolved to its successor and told to re-set its cookie. The
 * race converges instead of destroying a session.
 */

import { randomBytes } from 'node:crypto';
import { ConfigError, InvalidTokenError, SessionExpiredError, SessionNotFoundError, SessionRevokedError, TokenSignatureMismatchError, type AuthError } from '../errors.js';
import { decodeClaims, type ClaimsShape, type InferClaims } from '../claims.js';
import type { Clock, SessionId, SessionStore, StoredSession, TokenCodec } from '../contract.js';

export type SessionStrategy = 'stateless' | 'stateful';

/** A live session, with claims typed by the declared shape. */
export interface Session<Shape extends ClaimsShape> {
	readonly id: SessionId;
	readonly subject: string;
	readonly claims: InferClaims<Shape>;
	readonly createdAt: number;
	readonly lastSeenAt: number;
	readonly absoluteExpiresAt: number;
}

export type SessionReadResult<Shape extends ClaimsShape> =
	| {
		readonly ok: true;
		readonly session: Session<Shape>;
		/**
		 * A replacement token the caller must write back as a cookie.
		 *
		 * Set when a stateless session slid its idle window, or when a
		 * superseded token was resolved to its successor. Absent means the
		 * caller's existing cookie is still correct.
		 */
		readonly renewedToken?: string;
	}
	| { readonly ok: false; readonly error: AuthError };

export type SessionIssueResult<Shape extends ClaimsShape> =
	| { readonly ok: true; readonly token: string; readonly session: Session<Shape> }
	| { readonly ok: false; readonly error: AuthError };

export interface SessionEngineOptions<Shape extends ClaimsShape> {
	readonly strategy: SessionStrategy;
	readonly claims: Shape;
	readonly codec: TokenCodec;
	readonly clock: Clock;
	/** Required for `stateful`. Optional for `stateless`, where it enables revocation. */
	readonly store?: SessionStore;
	/** Milliseconds of inactivity after which the session expires. */
	readonly idleTtlMs: number;
	/** Milliseconds after creation beyond which the session dies regardless of activity. */
	readonly absoluteTtlMs: number;
	/**
	 * How long a rotated-away session stays resolvable. Defaults to 10 seconds.
	 *
	 * Long enough to cover an in-flight request, short enough that a token
	 * captured during rotation is not a lasting foothold.
	 */
	readonly rotationOverlapMs?: number;
	/**
	 * Re-issue a stateless token once this much of the idle window has elapsed.
	 * Defaults to half. Re-issuing on every request would set a cookie on every
	 * response for no benefit.
	 */
	readonly renewAfterMs?: number;
}

export interface SessionEngine<Shape extends ClaimsShape> {
	readonly strategy: SessionStrategy;
	/** False when the configuration cannot revoke server-side. */
	readonly supportsRevocation: boolean;

	issue(input: {
		readonly subject: string;
		readonly claims: InferClaims<Shape>;
	}): Promise<SessionIssueResult<Shape>>;

	read(token: string | undefined | null): Promise<SessionReadResult<Shape>>;

	/**
	 * Regenerates the session identifier, preserving creation time and absolute
	 * expiry. Call on every privilege change — sign-in above all.
	 */
	rotate(
		token: string,
		changes?: { readonly claims?: InferClaims<Shape> }
	): Promise<SessionIssueResult<Shape>>;

	/** Returns false when the configuration cannot revoke server-side. */
	destroy(token: string): Promise<boolean>;

	destroyForSubject(subject: string): Promise<number>;
}

const DEFAULT_ROTATION_OVERLAP_MS = 10_000;

/**
 * 32 bytes of CSPRNG output, base64url-encoded to 43 characters.
 *
 * Nothing about the subject, the time, or a counter goes into it. A session id
 * with structure is a session id an attacker can narrow.
 */
const newSessionId = (): SessionId =>
	randomBytes(32).toString('base64url') as SessionId;

interface TokenPayload {
	readonly sid: string;
	readonly sub?: string;
	readonly iat?: number;
	readonly lsa?: number;
	readonly aex?: number;
	readonly claims?: unknown;
}

const readTokenPayload = (payload: Record<string, unknown>): TokenPayload | undefined => {
	const sid = payload['sid'];
	if (typeof sid !== 'string' || sid.length === 0) return undefined;

	return {
		sid,
		...(typeof payload['sub'] === 'string' ? { sub: payload['sub'] } : {}),
		...(typeof payload['iat'] === 'number' ? { iat: payload['iat'] } : {}),
		...(typeof payload['lsa'] === 'number' ? { lsa: payload['lsa'] } : {}),
		...(typeof payload['aex'] === 'number' ? { aex: payload['aex'] } : {}),
		...('claims' in payload ? { claims: payload['claims'] } : {}),
	};
};

export const createSessionEngine = <Shape extends ClaimsShape>(
	options: SessionEngineOptions<Shape>
): SessionEngine<Shape> => {
	const {
		strategy,
		claims: shape,
		codec,
		clock,
		store,
		idleTtlMs,
		absoluteTtlMs,
		rotationOverlapMs = DEFAULT_ROTATION_OVERLAP_MS,
	} = options;

	const renewAfterMs = options.renewAfterMs ?? Math.floor(idleTtlMs / 2);

	if (strategy === 'stateful' && store === undefined) {
		throw new ConfigError({
			path: 'store',
			reason:
				'The stateful strategy persists sessions server-side and requires a SessionStore. Use the stateless strategy if you do not want one.',
		});
	}

	if (idleTtlMs > absoluteTtlMs) {
		throw new ConfigError({
			path: 'idleTtlMs',
			reason:
				'The idle window is longer than the absolute lifetime, so idle expiry can never fire. One of the two controls is doing nothing.',
		});
	}

	if (idleTtlMs <= 0 || absoluteTtlMs <= 0) {
		throw new ConfigError({
			path: idleTtlMs <= 0 ? 'idleTtlMs' : 'absoluteTtlMs',
			reason: 'Session lifetimes must be positive.',
		});
	}

	const supportsRevocation = store !== undefined;

	/** Persists the record backing revocation and rotation-overlap resolution. */
	const persist = async (session: StoredSession): Promise<void> => {
		if (store === undefined) return;
		await store.write(session);
	};

	const encode = async (session: StoredSession): Promise<string> =>
		strategy === 'stateful'
			? // Stateful tokens carry the identifier and the absolute expiry, and
			// nothing else. A leaked token still reveals nothing about the user.
			//
			// The expiry earns its place twice over. Store records are reclaimed
			// by TTL once they lapse, so without it an expired session is
			// indistinguishable from one that never existed, and the user is told
			// "not signed in" when the truthful answer is "your session expired".
			// It also lets a definitely-dead token be rejected with no store
			// round-trip at all.
			codec.sign({ sid: session.id, aex: session.absoluteExpiresAt })
			: codec.sign({
				sid: session.id,
				sub: session.subject,
				iat: session.createdAt,
				lsa: session.lastSeenAt,
				aex: session.absoluteExpiresAt,
				claims: session.claims,
			});

	const toSession = (stored: StoredSession, claims: InferClaims<Shape>): Session<Shape> => ({
		id: stored.id,
		subject: stored.subject,
		claims,
		createdAt: stored.createdAt,
		lastSeenAt: stored.lastSeenAt,
		absoluteExpiresAt: stored.absoluteExpiresAt,
	});

	/** Rebuilds a stored record from a token, for the stateless strategy. */
	const storedFromPayload = (payload: TokenPayload): StoredSession | undefined => {
		if (
			payload.sub === undefined ||
			payload.iat === undefined ||
			payload.lsa === undefined ||
			payload.aex === undefined
		) {
			return undefined;
		}

		return {
			id: payload.sid as SessionId,
			subject: payload.sub,
			claims: (payload.claims ?? {}) as Readonly<Record<string, unknown>>,
			createdAt: payload.iat,
			lastSeenAt: payload.lsa,
			absoluteExpiresAt: payload.aex,
		};
	};

	const resolveStored = async (
		payload: TokenPayload
	): Promise<StoredSession | undefined> => {
		if (strategy === 'stateful') {
			return store?.read(payload.sid as SessionId);
		}

		// Stateless with a store: the store is authoritative on liveness, and a
		// missing record means revoked. Falling back to the token's own contents
		// here would let a destroyed session resurrect itself from the very cookie
		// that was supposed to have been invalidated — the token would become its
		// own proof of validity, and "sign out everywhere" would silently do
		// nothing.
		if (store !== undefined) {
			return store.read(payload.sid as SessionId);
		}

		// No store at all. The token is the only record there is, which is the
		// documented cost of running stateless without one.
		return Promise.resolve(storedFromPayload(payload));
	};

	const issueFrom = async (
		stored: StoredSession,
		validatedClaims: InferClaims<Shape>
	): Promise<SessionIssueResult<Shape>> => {
		await persist(stored);
		return {
			ok: true,
			token: await encode(stored),
			session: toSession(stored, validatedClaims),
		};
	};

	const engine: SessionEngine<Shape> = {
		strategy,
		supportsRevocation,

		issue: async ({ subject, claims }) => {
			const decoded = decodeClaims(shape, claims);
			if (!decoded.ok) {
				return {
					ok: false,
					error: new InvalidTokenError({ kind: 'claims', detail: decoded.reason }),
				};
			}

			const now = clock.now();
			const stored: StoredSession = {
				id: newSessionId(),
				subject,
				claims: decoded.value as Readonly<Record<string, unknown>>,
				createdAt: now,
				lastSeenAt: now,
				absoluteExpiresAt: now + absoluteTtlMs,
			};

			return issueFrom(stored, decoded.value);
		},

		read: async (token) => {
			if (typeof token !== 'string' || token.length === 0) {
				return { ok: false, error: new SessionNotFoundError() };
			}

			const payload = await codec.verify(token);
			if (payload === undefined) {
				return { ok: false, error: new TokenSignatureMismatchError() };
			}

			const parsed = readTokenPayload(payload);
			if (parsed === undefined) {
				return {
					ok: false,
					error: new InvalidTokenError({ kind: 'session', detail: 'No session id in payload.' }),
				};
			}

			const now = clock.now();

			// Checked before the store is consulted. The expiry is signed, so it is
			// trustworthy, and acting on it here means an expired session reports
			// itself as expired rather than as absent once its record has been
			// reclaimed by TTL — and costs no store round-trip to establish.
			if (parsed.aex !== undefined && now >= parsed.aex) {
				return { ok: false, error: new SessionExpiredError() };
			}

			let stored = await resolveStored(parsed);
			if (stored === undefined) {
				return { ok: false, error: new SessionNotFoundError() };
			}
			let renewedToken: string | undefined;

			// Rotation-race convergence. A superseded session is still usable for a
			// bounded window, and the caller is handed the successor's token so the
			// two branches of the race collapse into one.
			if (stored.supersededAt !== undefined) {
				if (now > stored.supersededAt) {
					return { ok: false, error: new SessionRevokedError() };
				}

				const successorId = stored.supersededBy;
				const successor =
					successorId === undefined ? undefined : await store?.read(successorId);

				if (successor === undefined) {
					return { ok: false, error: new SessionRevokedError() };
				}

				stored = successor;
				renewedToken = await encode(successor);
			}

			if (now >= stored.absoluteExpiresAt) {
				// Absolute expiry is measured from creation and is never extended, so
				// a stolen token has a hard ceiling on its usefulness.
				return { ok: false, error: new SessionExpiredError() };
			}

			if (now - stored.lastSeenAt > idleTtlMs) {
				return { ok: false, error: new SessionExpiredError() };
			}

			const decoded = decodeClaims(shape, stored.claims);
			if (!decoded.ok) {
				return {
					ok: false,
					error: new InvalidTokenError({ kind: 'claims', detail: decoded.reason }),
				};
			}

			// Slide the idle window. Capped at absolute expiry so touching a session
			// can never push it past its ceiling.
			const touched: StoredSession = { ...stored, lastSeenAt: now };
			const shouldRenew = now - stored.lastSeenAt >= renewAfterMs;

			if (strategy === 'stateful') {
				if (shouldRenew) await persist(touched);
			} else if (shouldRenew && renewedToken === undefined) {
				renewedToken = await encode(touched);
				if (store !== undefined) await persist(touched);
			}

			return {
				ok: true,
				session: toSession(touched, decoded.value),
				...(renewedToken === undefined ? {} : { renewedToken }),
			};
		},

		rotate: async (token, changes) => {
			const current = await engine.read(token);
			if (!current.ok) return { ok: false, error: current.error };

			const nextClaims = changes?.claims ?? current.session.claims;
			const decoded = decodeClaims(shape, nextClaims);
			if (!decoded.ok) {
				return {
					ok: false,
					error: new InvalidTokenError({ kind: 'claims', detail: decoded.reason }),
				};
			}

			const now = clock.now();
			const successor: StoredSession = {
				id: newSessionId(),
				subject: current.session.subject,
				claims: decoded.value as Readonly<Record<string, unknown>>,
				createdAt: current.session.createdAt,
				lastSeenAt: now,
				// Carried over, not recomputed. Recomputing would let an attacker who
				// can trigger rotations extend a session indefinitely, which is
				// exactly what the absolute lifetime exists to prevent.
				absoluteExpiresAt: current.session.absoluteExpiresAt,
			};

			// Mark the predecessor superseded rather than deleting it, so a request
			// already in flight with the old token converges instead of 401-ing.
			if (store !== undefined) {
				const predecessor = await store.read(current.session.id);
				if (predecessor !== undefined) {
					await store.write({
						...predecessor,
						supersededAt: now + rotationOverlapMs,
						supersededBy: successor.id,
					});
				}
			}

			return issueFrom(successor, decoded.value);
		},

		destroy: async (token) => {
			if (store === undefined) return false;

			const payload = await codec.verify(token);
			if (payload === undefined) return false;

			const parsed = readTokenPayload(payload);
			if (parsed === undefined) return false;

			await store.destroy(parsed.sid as SessionId);
			return true;
		},

		destroyForSubject: async (subject) => {
			if (store === undefined) return 0;
			return store.destroyForSubject(subject);
		},
	};

	return engine;
};
