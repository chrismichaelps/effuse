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

export {
	createOAuthClient,
	type CallbackOutcome,
	type CallbackSuccess,
	type OAuthClient,
	type OAuthClientOptions,
	type OAuthProvider,
	type OAuthTokens,
	type StartOutcome,
	type StartResult,
} from './oauth/flow.js';

export {
	createPkcePair,
	verifyPkce,
	MAX_VERIFIER_LENGTH,
	MIN_VERIFIER_LENGTH,
	type PkcePair,
	type PkceMethod,
} from './oauth/pkce.js';

export {
	createRedirectValidator,
	type RedirectValidator,
	type RedirectValidatorOptions,
} from './oauth/redirect.js';

export {
	verifyIdToken,
	type IdTokenAlgorithm,
	type IdTokenClaims,
	type JwksResolver,
	type VerifyIdTokenOptions,
	type VerifyIdTokenResult,
} from './oauth/id-token.js';

export {
	createJwksResolver,
	type JwksResolverOptions,
} from './oauth/jwks.js';

export {
	createDiscoveryClient,
	type DiscoveryClient,
	type DiscoveryOptions,
	type ProviderMetadata,
} from './oauth/discovery.js';

export {
	auth0,
	google,
	keycloak,
	microsoft,
	oidc,
	okta,
	standardProfile,
	type PresetCredentials,
	type StandardProfile,
} from './oauth/presets.js';

export {
	classifyRefreshToken,
	createTokenRefresher,
	type AccessTokenResult,
	type ReuseDetectedEvent,
	type ReuseVerdict,
	type TokenRecord,
	type TokenRefresher,
	type TokenRefresherOptions,
} from './oauth/refresh.js';

export {
	createPolicies,
	type Policy,
	type PolicyBuilders,
	type PolicyContext,
	type PolicyDecision,
} from './policy/predicates.js';

export {
	createPolicyRegistry,
	type PolicyMatch,
	type PolicyMethod,
	type PolicyRegistry,
	type PolicyRule,
} from './policy/registry.js';

export {
	assertPolicyCoverage,
	auditPolicyCoverage,
	formatCoverageReport,
	PolicyCoverageError,
	type AuditableManifest,
	type AuditableRoute,
	type AuditOptions,
	type CoverageEntry,
	type CoverageReport,
} from './policy/audit.js';

export {
	createPolicyGuard,
	type GuardOptions,
	type GuardOutcome,
	type PolicyGuard,
} from './policy/guard.js';

export {
	renderSessionHydration,
	renderSessionScript,
	toHydrationPayload,
	SESSION_SCRIPT_ID,
	type RenderSessionScriptOptions,
	type SessionHydrationPayload,
} from './hydration.js';
