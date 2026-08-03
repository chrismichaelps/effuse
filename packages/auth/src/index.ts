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
 * `@effuse/auth` — isomorphic surface.
 *
 * Types, the claims declaration, the error channel, and `defineAuth`. Nothing
 * here imports a `node:` builtin, so this entrypoint is safe from a browser
 * bundle, an edge runtime, or a server. Signing, hashing, and session machinery
 * live in `@effuse/auth/server`.
 */

export {
	claim,
	decodeClaims,
	exposedClaims,
	type AnyClaim,
	type ClaimKind,
	type ClaimOptions,
	type ClaimSchema,
	type ClaimsShape,
	type DecodeResult,
	type InferClaims,
} from './claims.js';

export {
	defineAuth,
	type AuthConfig,
	type AuthConfigInput,
	type CookieConfigInput,
	type SessionConfigInput,
} from './config.js';

export { AUTH_SECRET_MIN_LENGTH } from './security-constants.js';

export {
	AccountLockedError,
	ConfigError,
	CsrfMismatchError,
	ForbiddenError,
	InvalidCredentialsError,
	InvalidResetTokenError,
	InvalidTokenError,
	PasswordPolicyError,
	ProviderError,
	RateLimitedError,
	SessionExpiredError,
	SessionNotFoundError,
	SessionRevokedError,
	StoreError,
	TokenSignatureMismatchError,
	isAuthError,
	toSafeResponseInit,
	type AuthError,
	type SafeResponseInit,
} from './errors.js';

export type {
	AuthStorage,
	Clock,
	CredentialRecord,
	LockHandle,
	PasswordHasher,
	PasswordResetRecord,
	PasswordResetStore,
	RateLimitVerdict,
	RateLimiter,
	SessionId,
	SessionStore,
	StoredSession,
	TokenCodec,
	UserStore,
} from './contract.js';
