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
 * `@effuse/auth/client` — the browser surface.
 *
 * Deliberately small, and deliberately incapable. It adopts the session the
 * server already resolved, notifies subscribers when it changes, and does no
 * signing, no verification, and no fetching of its own.
 *
 * That last part is the fix for a specific pair of failures in the incumbent
 * library — `useSession` not updating after a server-side sign-out, and client
 * state only catching up on a manual reload. Both come from the client keeping a
 * second, independent session source that can disagree with the server's. Here
 * there is one source and this is a view onto it, so there is nothing to
 * disagree with.
 *
 * **This is presentational state.** It decides what to render, never what to
 * permit. Authorization is a server concern; a check that exists only here is one
 * an attacker skips by not running your JavaScript.
 *
 * No `node:` builtin is reachable from this file, and a test walks the real
 * import closure to prove it.
 */

import type { ClaimsShape, InferClaims } from '../claims.js';

/** What the client knows about the current session. */
export type ClientSession<Shape extends ClaimsShape> =
	| {
			readonly status: 'authenticated';
			readonly claims: Partial<InferClaims<Shape>>;
			readonly expiresAt: number | undefined;
	  }
	| {
			readonly status: 'anonymous';
			readonly claims: undefined;
			readonly expiresAt: undefined;
	  };

export type SessionListener<Shape extends ClaimsShape> = (
	session: ClientSession<Shape>
) => void;

export interface SessionClient<Shape extends ClaimsShape> {
	/** The current snapshot. Synchronous — it was hydrated, not fetched. */
	readonly current: () => ClientSession<Shape>;
	/** Subscribes to changes. Returns an unsubscribe function. */
	readonly subscribe: (listener: SessionListener<Shape>) => () => void;
	/**
	 * Publishes a new snapshot.
	 *
	 * Call after a sign-in or sign-out response so every subscriber updates from
	 * one event rather than each polling for itself. This single channel is what
	 * keeps the UI from lagging a reload behind the server.
	 */
	readonly publish: (session: ClientSession<Shape>) => void;
	/** Convenience for the sign-out case. */
	readonly clear: () => void;
}

const ANONYMOUS = {
	status: 'anonymous',
	claims: undefined,
	expiresAt: undefined,
} as const;

/** The anonymous snapshot, for callers that need to reset explicitly. */
export const anonymousSession: ClientSession<ClaimsShape> = ANONYMOUS;

/** The element id the server writes the payload to. */
export const SESSION_SCRIPT_ID = 'effuse-auth-session';

/** The payload shape, mirrored from the server. */
export interface HydratedPayload<Shape extends ClaimsShape> {
	readonly status: 'authenticated' | 'anonymous';
	readonly claims?: Partial<InferClaims<Shape>>;
	readonly expiresAt?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads the payload the server embedded.
 *
 * Returns the anonymous snapshot for anything it cannot read. A malformed or
 * absent payload must render a signed-out page, never throw during hydration —
 * a thrown error here takes the whole application down before it starts, and
 * the failure mode of "looks signed out" is recoverable by a reload.
 */
export const readHydratedSession = <Shape extends ClaimsShape>(
	elementId: string = SESSION_SCRIPT_ID,
	documentRef: Document | undefined = typeof document === 'undefined'
		? undefined
		: document
): ClientSession<Shape> => {
	if (documentRef === undefined) return ANONYMOUS;

	const element = documentRef.getElementById(elementId);
	if (element === null) return ANONYMOUS;

	// `textContent` rather than `innerHTML`: the browser has already decoded
	// entities, and re-parsing markup here would undo the point of using an
	// inert block. It is non-null for an element — the spec only returns null for
	// Document, DocumentType, and Notation nodes — so there is no null check to
	// write, only an emptiness one.
	const raw = element.textContent;
	if (raw.trim().length === 0) return ANONYMOUS;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return ANONYMOUS;
	}

	if (!isRecord(parsed)) return ANONYMOUS;
	if (parsed['status'] !== 'authenticated') return ANONYMOUS;

	const claims = parsed['claims'];

	return {
		status: 'authenticated',
		claims: (isRecord(claims) ? claims : {}) as Partial<InferClaims<Shape>>,
		expiresAt:
			typeof parsed['expiresAt'] === 'number' ? parsed['expiresAt'] : undefined,
	};
};

/**
 * Creates the client-side session view.
 *
 * `initial` normally comes from {@link readHydratedSession}, which contains only
 * the claims the server marked for exposure. Anything not marked never reaches
 * the browser, so this module cannot leak what it was never given.
 */
export const createSessionClient = <Shape extends ClaimsShape>(
	initial?: ClientSession<Shape>
): SessionClient<Shape> => {
	let snapshot: ClientSession<Shape> = initial ?? ANONYMOUS;

	const listeners = new Set<SessionListener<Shape>>();

	const publish = (session: ClientSession<Shape>): void => {
		snapshot = session;

		// Iterated over a copy: a listener that unsubscribes during notification
		// would otherwise mutate the set mid-iteration and silently skip a peer.
		for (const listener of [...listeners]) {
			try {
				listener(session);
			} catch {
				// One badly-behaved subscriber must not stop the others from seeing a
				// sign-out. Silently continuing is the lesser evil: the alternative is
				// a UI where half the components think the user is still signed in.
			}
		}
	};

	return {
		current: () => snapshot,

		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		publish,

		clear: () => {
			publish(ANONYMOUS);
		},
	};
};

/**
 * Reads the server's payload and wraps it in a client.
 *
 * The single call an application makes at start-up. Note what it does not do:
 * fetch. The value is already in the page, and requesting it again would open
 * exactly the window between server and client state that this design exists to
 * close.
 */
export const hydrateSessionClient = <Shape extends ClaimsShape>(
	elementId: string = SESSION_SCRIPT_ID
): SessionClient<Shape> =>
	createSessionClient<Shape>(readHydratedSession<Shape>(elementId));

/** True when the session is past the expiry the server reported. */
export const isExpired = <Shape extends ClaimsShape>(
	session: ClientSession<Shape>,
	now: number = Date.now()
): boolean =>
	session.status === 'authenticated' &&
	session.expiresAt !== undefined &&
	now >= session.expiresAt;

export type { ClaimsShape, InferClaims } from '../claims.js';
