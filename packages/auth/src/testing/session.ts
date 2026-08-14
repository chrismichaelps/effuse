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
 * Fabricating authenticated sessions for application tests.
 *
 * Testing an authenticated route is otherwise a chore: drive a full sign-in,
 * capture cookies, replay them. People skip it, and the authenticated paths —
 * which is to say the ones that matter — end up untested.
 *
 * The important property here is that nothing is faked. `createTestSession`
 * builds a real engine with a real codec and issues a real signed token, so the
 * cookie it hands back is one the production code path accepts because it is
 * genuinely valid. A stub that returned `{ user: ... }` would prove only that a
 * test double matches the assumptions of whoever wrote it.
 */

import { createAuthServer } from '../server/create-auth-server.js';
import { parseCookieHeader, readChunkedCookie } from '../server/cookies.js';
import { defineAuth } from '../config.js';
import { createMemoryAuthStorage } from './storage.js';
import { createTestClock, type TestClock } from './index.js';
import type { AuthConfig } from '../config.js';
import type { ClaimsShape, InferClaims } from '../claims.js';
import type { AuthStorage, Clock } from '../contract.js';
import type { Session } from '../server/session-engine.js';

/** A signing secret used when a test does not care which one. */
export const TEST_SECRET = 'effuse-test-secret-do-not-use-in-production';

export interface CreateTestSessionOptions<Shape extends ClaimsShape> {
	readonly claims: Shape;
	readonly subject?: string;
	readonly values: InferClaims<Shape>;
	/** Defaults to a controllable clock at a fixed instant. */
	readonly clock?: Clock;
	/** Defaults to fresh in-memory storage. */
	readonly storage?: AuthStorage;
	/** Overrides for the generated config, e.g. a shorter idle window. */
	readonly config?: Partial<Parameters<typeof defineAuth>[0]>;
}

export interface TestSession<Shape extends ClaimsShape> {
	/**
	 * The signed token, reassembled from the cookies the engine emitted.
	 *
	 * Useful for driving the engine directly. It is the real token, not a
	 * reconstruction — a large session that had to be chunked is joined back
	 * exactly as the server would join it.
	 */
	readonly token: string;
	readonly session: Session<Shape>;
	/** `Set-Cookie` headers, for asserting on a response. */
	readonly setCookies: readonly string[];
	/** A ready-made `Cookie` request header. */
	readonly cookieHeader: string;
	/** Builds a request already carrying this session. */
	readonly request: (url?: string, init?: RequestInit) => Request;
	/** The assembled server, for driving further operations. */
	readonly auth: ReturnType<typeof createAuthServer<Shape>>;
	readonly config: AuthConfig<Shape>;
	readonly storage: AuthStorage;
	readonly clock: Clock;
}

/**
 * Issues a genuine session without going through a sign-in flow.
 *
 * ```ts
 * const signedIn = await createTestSession({
 *   claims: appClaims,
 *   values: { role: 'admin', email: 'ada@example.com' },
 * });
 *
 * const response = await handler(signedIn.request('/api/admin'));
 * ```
 */
export const createTestSession = async <Shape extends ClaimsShape>(
	options: CreateTestSessionOptions<Shape>
): Promise<TestSession<Shape>> => {
	const clock = options.clock ?? createTestClock();
	const storage = options.storage ?? createMemoryAuthStorage(clock);

	const config = defineAuth({
		secrets: [TEST_SECRET],
		claims: options.claims,
		// `secure: false` because tests do not run over https and a Secure cookie
		// would be dropped by anything modelling a real browser. This is a test
		// helper; production defaults are unaffected.
		cookie: { secure: false, hostPrefix: false },
		...options.config,
	}) as AuthConfig<Shape>;

	const auth = createAuthServer<Shape>(config, { storage, clock });

	const issued = await auth.signIn({
		subject: options.subject ?? 'test-subject',
		claims: options.values,
	});

	if (issued.error !== undefined || issued.session === undefined) {
		// Surfaced rather than swallowed: a test helper that silently returns an
		// unusable session produces failures pointing at the wrong place.
		throw new Error(
			`[@effuse/auth] createTestSession failed to issue a session: ${
				issued.error?.safeMessage ?? 'unknown'
			}`
		);
	}

	const cookieHeader = issued.setCookies
		.map((header) => header.split(';')[0])
		.join('; ');

	// Read back through the same reassembly the server uses, so a session large
	// enough to be chunked yields the identical token rather than its first
	// fragment.
	const token =
		readChunkedCookie(parseCookieHeader(cookieHeader), config.cookie.name) ?? '';

	return {
		token,
		session: issued.session,
		setCookies: issued.setCookies,
		cookieHeader,
		request: (url = 'https://app.example.com/', init = {}) => {
			// Built through `Headers` rather than an object spread. `HeadersInit` is
			// a union of `Headers`, `string[][]`, and `Record<string, string>`, and
			// spreading either of the first two yields numeric indices — so a caller
			// passing a `Headers` instance would silently lose every header they set.
			const headers = new Headers(init.headers);
			headers.set('cookie', cookieHeader);

			return new Request(url, { ...init, headers });
		},
		auth,
		config,
		storage,
		clock,
	};
};

/**
 * A controllable clock plus storage, for tests that build their own server.
 *
 * Exists because the pair is needed together often enough that assembling them
 * by hand in every file is noise.
 */
export const createTestEnvironment = (
	startEpochMs?: number
): { readonly clock: TestClock; readonly storage: AuthStorage } => {
	const clock = createTestClock(startEpochMs);
	return { clock, storage: createMemoryAuthStorage(clock) };
};
