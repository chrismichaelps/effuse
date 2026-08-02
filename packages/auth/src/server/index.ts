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
 * `@effuse/auth/server` — everything that touches `node:crypto`.
 *
 * Kept behind its own entrypoint so it cannot reach a browser bundle. The
 * failure this prevents is concrete: the incumbent library's client session
 * provider pulls Node crypto polyfills into the browser build, and users pay for
 * them on every page load whether or not they ever call it.
 */

export * from '../index.js';

export { createAuthServer, type AuthServer } from './create-auth-server.js';

export {
	createSessionEngine,
	type Session,
	type SessionEngine,
	type SessionEngineOptions,
	type SessionIssueResult,
	type SessionReadResult,
	type SessionStrategy,
} from './session-engine.js';

export {
	createTokenCodec,
	TOKEN_CODEC_MIN_SECRET_LENGTH,
	type TokenCodecOptions,
} from './token-codec.js';

export { createCsrfGuard, type CsrfGuard, type CsrfGuardOptions } from './csrf.js';

export {
	createScryptHasher,
	DEFAULT_SCRYPT_PARAMETERS,
	type ScryptParameters,
} from './password-hasher.js';

export {
	createCredentialsProvider,
	defaultPasswordPolicy,
	type AuthenticateInput,
	type AuthenticateResult,
	type ChangePasswordResult,
	type CredentialsProvider,
	type CredentialsProviderOptions,
	type PasswordPolicy,
} from './credentials.js';

export {
	createStorageSessionStore,
	type StorageSessionStoreOptions,
} from './storage-session-store.js';

export {
	clearCookieChunks,
	parseCookieHeader,
	readChunkedCookie,
	serializeCookieChunks,
	MAX_COOKIE_VALUE_BYTES,
	type CookieJar,
	type CookieOptions,
	type SameSitePolicy,
} from './cookies.js';
