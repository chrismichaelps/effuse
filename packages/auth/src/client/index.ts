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
 * Deliberately tiny, and deliberately incapable. It holds a session snapshot the
 * server already resolved and notifies subscribers when it changes. It does no
 * signing, no verification, and no fetching of its own.
 *
 * That last part is the fix for a specific pair of failures in the incumbent
 * library, where `useSession` does not update after a server-side sign-out and
 * client state only catches up on a manual reload. Both come from the client
 * maintaining a second, independent session source that can disagree with the
 * server's. Here there is one source — the server — and this module is a view
 * onto it.
 *
 * **This is presentational state.** It decides what to render, never what to
 * permit. Authorization is a server concern, and a check that only exists here
 * is a check an attacker skips by not running your JavaScript.
 *
 * No `node:` builtin is reachable from this file, and a test asserts it.
 */

import type { ClaimsShape, InferClaims } from '../claims.js';

/** What the client knows about the current session. */
export type ClientSession<Shape extends ClaimsShape> =
	| { readonly status: 'authenticated'; readonly claims: Partial<InferClaims<Shape>> }
	| { readonly status: 'anonymous'; readonly claims: undefined };

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
	 * Called after a sign-in or sign-out response, so every subscriber updates
	 * from one event instead of each polling for itself. This single channel is
	 * what keeps the UI from lagging a reload behind the server.
	 */
	readonly publish: (session: ClientSession<Shape>) => void;
}

const ANONYMOUS = { status: 'anonymous', claims: undefined } as const;

/**
 * Creates the client-side session view.
 *
 * `initial` comes from the server's hydration payload, which contains only the
 * claims marked for exposure. Anything not marked never reaches the browser, so
 * this module cannot leak what it was never given.
 */
export const createSessionClient = <Shape extends ClaimsShape>(
	initial?: Partial<InferClaims<Shape>>
): SessionClient<Shape> => {
	let snapshot: ClientSession<Shape> =
		initial === undefined
			? ANONYMOUS
			: { status: 'authenticated', claims: initial };

	const listeners = new Set<SessionListener<Shape>>();

	return {
		current: () => snapshot,

		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		publish: (session) => {
			snapshot = session;
			// Iterated over a copy: a listener that unsubscribes during notification
			// would otherwise mutate the set mid-iteration and silently skip a peer.
			for (const listener of [...listeners]) listener(session);
		},
	};
};

/** The anonymous snapshot, for callers that need to reset explicitly. */
export const anonymousSession = ANONYMOUS;

export type { ClaimsShape, InferClaims } from '../claims.js';
