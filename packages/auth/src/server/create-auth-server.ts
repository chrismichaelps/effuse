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
 * Assembly.
 *
 * `defineAuth` declares intent; this turns it into working machinery. The point
 * of separating them is that the declaration is isomorphic and the machinery is
 * not — which is what removes the need for the split-config workaround the
 * incumbent library documents for edge runtimes.
 *
 * Integration is meant to be readable end to end:
 *
 * ```ts
 * const config = defineAuth({
 *   secrets: [process.env.AUTH_SECRET],
 *   claims: { role: claim.enum(['admin', 'member']) },
 * });
 *
 * const auth = createAuthServer(config, { storage });
 *
 * // In a request handler:
 * const { session } = await auth.fromRequest(request);
 * ```
 */

import { createSessionEngine, type Session, type SessionEngine } from './session-engine.js';
import { createTokenCodec } from './token-codec.js';
import { createCsrfGuard, type CsrfGuard } from './csrf.js';
import { createStorageSessionStore } from './storage-session-store.js';
import {
	clearCookieChunks,
	parseCookieHeader,
	readChunkedCookie,
	serializeCookieChunks,
	type CookieOptions,
} from './cookies.js';
import type { AuthConfig } from '../config.js';
import type { ClaimsShape, InferClaims } from '../claims.js';
import type { AuthStorage, Clock, SessionStore } from '../contract.js';
import type { AuthError } from '../errors.js';

export interface CreateAuthServerOptions {
	/**
	 * Key-value storage backing sessions.
	 *
	 * Anything with `get`/`set`/`delete`/`namespace` qualifies — including
	 * `createMemoryStorage()` from `@effuse/server`. Supplying it enables
	 * revocation and rotation-race convergence.
	 */
	readonly storage?: AuthStorage;
	/** Supply a bespoke store instead of deriving one from `storage`. */
	readonly store?: SessionStore;
	/** Defaults to the system clock. Inject a test clock to control expiry. */
	readonly clock?: Clock;
}

/** The result of resolving a session from an incoming request. */
export interface RequestSessionResult<Shape extends ClaimsShape> {
	readonly session: Session<Shape> | undefined;
	/** Present when the session could not be resolved. */
	readonly error: AuthError | undefined;
	/**
	 * `Set-Cookie` headers the response must carry.
	 *
	 * Non-empty when a stateless token slid its idle window or a superseded token
	 * was resolved to its successor. Dropping these is what turns a working
	 * rotation into an intermittent sign-out.
	 */
	readonly setCookies: readonly string[];
}

export interface AuthServer<Shape extends ClaimsShape> {
	readonly engine: SessionEngine<Shape>;
	readonly csrf: CsrfGuard;

	/** Resolves the session carried by a request, if any. */
	fromRequest(request: Request): Promise<RequestSessionResult<Shape>>;

	/**
	 * Starts an authenticated session.
	 *
	 * Always mints a fresh identifier rather than adopting whatever the caller
	 * arrived with, which is the session-fixation defence at the point it
	 * matters most.
	 */
	signIn(input: {
		readonly subject: string;
		readonly claims: InferClaims<Shape>;
	}): Promise<{
		readonly setCookies: readonly string[];
		readonly session: Session<Shape> | undefined;
		readonly error: AuthError | undefined;
	}>;

	/** Ends the session and clears every cookie chunk the request carried. */
	signOut(request: Request): Promise<{ readonly setCookies: readonly string[] }>;

	/** Ends every session for a subject. Call on password change. */
	signOutEverywhere(subject: string): Promise<number>;
}

const systemClock: Clock = { now: () => Date.now() };

export const createAuthServer = <Shape extends ClaimsShape>(
	config: AuthConfig<Shape>,
	options: CreateAuthServerOptions = {}
): AuthServer<Shape> => {
	const clock = options.clock ?? systemClock;

	const store =
		options.store ??
		(options.storage === undefined
			? undefined
			: createStorageSessionStore({
					storage: options.storage,
					clock,
					// Matched to the absolute lifetime so records expire on their own.
					// Without it a store accumulates dead sessions from everyone who
					// closes a tab instead of signing out — which is most people.
					ttlMs: config.session.absoluteTtlMs,
				}));

	// Stateful when there is somewhere to put state, stateless otherwise. An
	// explicit strategy always wins; the default just avoids making the common
	// case a configuration puzzle.
	const strategy =
		config.session.strategy ?? (store === undefined ? 'stateless' : 'stateful');

	const codec = createTokenCodec({ secrets: config.secrets });

	const engine = createSessionEngine({
		strategy,
		claims: config.claims,
		codec,
		clock,
		...(store === undefined ? {} : { store }),
		idleTtlMs: config.session.idleTtlMs,
		absoluteTtlMs: config.session.absoluteTtlMs,
		rotationOverlapMs: config.session.rotationOverlapMs,
	});

	const csrf = createCsrfGuard({ secrets: config.secrets, clock });

	const cookieOptions: CookieOptions = {
		name: config.cookie.name,
		path: config.cookie.path,
		secure: config.cookie.secure,
		sameSite: config.cookie.sameSite,
		hostPrefix: config.cookie.hostPrefix,
		maxAgeSeconds: Math.floor(config.session.absoluteTtlMs / 1000),
		...(config.cookie.domain === undefined ? {} : { domain: config.cookie.domain }),
	};

	const jarOf = (request: Request) =>
		parseCookieHeader(request.headers.get('cookie'));

	return {
		engine,
		csrf,

		fromRequest: async (request) => {
			const jar = jarOf(request);
			const token = readChunkedCookie(jar, config.cookie.name);

			const result = await engine.read(token);

			if (!result.ok) {
				return { session: undefined, error: result.error, setCookies: [] };
			}

			return {
				session: result.session,
				error: undefined,
				setCookies:
					result.renewedToken === undefined
						? []
						: serializeCookieChunks(result.renewedToken, cookieOptions),
			};
		},

		signIn: async ({ subject, claims }) => {
			const issued = await engine.issue({ subject, claims });

			if (!issued.ok) {
				return { setCookies: [], session: undefined, error: issued.error };
			}

			return {
				setCookies: serializeCookieChunks(issued.token, cookieOptions),
				session: issued.session,
				error: undefined,
			};
		},

		signOut: async (request) => {
			const jar = jarOf(request);
			const token = readChunkedCookie(jar, config.cookie.name);

			if (token !== undefined) await engine.destroy(token);

			// Driven by what the request actually carried, so a session that had
			// grown to three chunks is fully cleared rather than leaving two behind
			// to poison every subsequent read.
			return { setCookies: clearCookieChunks(jar, cookieOptions) };
		},

		signOutEverywhere: async (subject) => engine.destroyForSubject(subject),
	};
};
