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
 * The typed failure channel for authentication.
 *
 * Every failure a caller might reasonably branch on is a member of a
 * discriminated union rather than a string message, so `switch (error._tag)`
 * is checked for completeness by the compiler and a new failure mode cannot be
 * introduced without every handler being forced to acknowledge it.
 *
 * Two rules hold across every member, and both exist for security rather than
 * tidiness:
 *
 * - **`safeMessage` is the only text that may reach a client.** Diagnostic
 *   context lives in `detail`, which response builders never read. This is what
 *   keeps connection strings, user identifiers, and hash comparison outcomes
 *   out of HTTP responses.
 * - **Members that throttle carry `retryAfterMs`.** The transport can then emit
 *   a correct `Retry-After` instead of inventing one, and a well-behaved client
 *   backs off rather than hot-looping.
 */

import { Data } from 'effect';

/** Fields every member carries. */
interface SafeErrorFields {
	/**
	 * Operator-facing context. Never serialised into a response by
	 * {@link toSafeResponseInit}, and never logged by this package.
	 */
	readonly detail?: string;
}

/**
 * Sign-in failed.
 *
 * Deliberately does not distinguish "no such user" from "wrong password".
 * Splitting them is the classic user-enumeration leak, so both paths construct
 * this same member and both produce byte-identical client-visible output.
 */
export class InvalidCredentialsError extends Data.TaggedError(
	'InvalidCredentialsError'
)<SafeErrorFields> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Invalid email or password.';
}

/** Too many failed attempts against a single account; sign-in is suspended. */
export class AccountLockedError extends Data.TaggedError('AccountLockedError')<
	SafeErrorFields & {
		/** Milliseconds until the lock lifts. */
		readonly retryAfterMs: number;
	}
> {
	readonly safeMessage = 'This account is temporarily locked.';
}

/** A rate-limit budget was exhausted. */
export class RateLimitedError extends Data.TaggedError('RateLimitedError')<
	SafeErrorFields & {
		/** Milliseconds until the budget refills enough to retry. */
		readonly retryAfterMs: number;
		/** Which budget was exhausted, for operators. Never sent to clients. */
		readonly scope?: string;
	}
> {
	readonly safeMessage = 'Too many attempts. Try again later.';
}

/** The session is past its idle or absolute expiry. */
export class SessionExpiredError extends Data.TaggedError(
	'SessionExpiredError'
)<SafeErrorFields> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Your session has expired.';
}

/** No session was presented, or the store has no record of the one presented. */
export class SessionNotFoundError extends Data.TaggedError(
	'SessionNotFoundError'
)<SafeErrorFields> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Not signed in.';
}

/**
 * The session was explicitly invalidated — sign-out, password change, or a
 * refresh-token reuse that revoked the whole family.
 */
export class SessionRevokedError extends Data.TaggedError(
	'SessionRevokedError'
)<SafeErrorFields> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Your session is no longer valid.';
}

/** A token was malformed: wrong shape, bad encoding, or an unreadable payload. */
export class InvalidTokenError extends Data.TaggedError('InvalidTokenError')<
	SafeErrorFields & {
		/** What the token was being read as, for operators. */
		readonly kind?: string;
	}
> {
	constructor(args: SafeErrorFields & { readonly kind?: string } = {}) {
		super(args);
	}

	readonly safeMessage = 'Malformed authentication token.';
}

/**
 * A token's signature did not verify under any configured secret.
 *
 * Distinct from {@link InvalidTokenError} because a well-formed token with a bad
 * signature is a forgery attempt, and operators want to alert on it separately.
 */
export class TokenSignatureMismatchError extends Data.TaggedError(
	'TokenSignatureMismatchError'
)<SafeErrorFields> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Malformed authentication token.';
}

/**
 * The caller is known, but not permitted.
 *
 * Distinct from {@link SessionNotFoundError}: that one means "sign in", this one
 * means "signing in again will not help". Conflating them sends an
 * already-authenticated user back to a sign-in page they will bounce straight
 * out of, and makes 401 rates useless as a signal.
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<
	SafeErrorFields & {
		/** The policy that refused, for operators. Never sent to clients. */
		readonly policy?: string;
	}
> {
	constructor(args: SafeErrorFields & { readonly policy?: string } = {}) {
		super(args);
	}

	// Deliberately opaque, and identical regardless of which policy refused. A
	// message naming the missing role tells a prober exactly what to obtain.
	readonly safeMessage = 'You do not have access to this resource.';
}

/** The double-submit CSRF token was absent or did not match the session. */
export class CsrfMismatchError extends Data.TaggedError('CsrfMismatchError')<
	SafeErrorFields
> {
	constructor(args: SafeErrorFields = {}) {
		super(args);
	}

	readonly safeMessage = 'Request rejected.';
}

/** An upstream identity provider failed or answered unusably. */
export class ProviderError extends Data.TaggedError('ProviderError')<
	SafeErrorFields & {
		readonly provider: string;
		/** The provider's own error code, when it supplied one. */
		readonly code?: string;
	}
> {
	readonly safeMessage = 'Sign-in with this provider failed.';
}

/** A backing store operation failed. */
export class StoreError extends Data.TaggedError('StoreError')<
	SafeErrorFields & {
		/** The port operation that failed, e.g. `get`, `set`, `delete`. */
		readonly operation: string;
		readonly cause?: unknown;
	}
> {
	readonly safeMessage = 'A temporary problem occurred. Try again.';
}

/**
 * The configuration itself is invalid.
 *
 * Raised as early as possible — ideally at `defineAuth` rather than on the
 * first request — because a misconfigured secret is a vulnerability that a
 * healthy-looking boot would otherwise hide until traffic arrives.
 */
export class ConfigError extends Data.TaggedError('ConfigError')<
	SafeErrorFields & {
		/** The configuration path at fault, e.g. `session.absoluteTtlMs`. */
		readonly path: string;
		readonly reason: string;
	}
> {
	get safeMessage(): string {
		return 'Authentication is misconfigured.';
	}

	/**
	 * Operator-facing text, surfaced through `Error.message`.
	 *
	 * Without this the thrown error prints with an empty message and the reason
	 * is only visible by inspecting the object — which is exactly the wrong
	 * experience for a failure that happens at boot, in a log, with no debugger
	 * attached. Distinct from {@link safeMessage}, which is what a client sees.
	 */
	override get message(): string {
		return `[@effuse/auth] ${this.path}: ${this.reason}`;
	}
}

/** Every failure this package can produce. */
export type AuthError =
	| InvalidCredentialsError
	| AccountLockedError
	| RateLimitedError
	| SessionExpiredError
	| SessionNotFoundError
	| SessionRevokedError
	| InvalidTokenError
	| TokenSignatureMismatchError
	| CsrfMismatchError
	| ForbiddenError
	| ProviderError
	| StoreError
	| ConfigError;

const AUTH_ERROR_TAGS: ReadonlySet<string> = new Set([
	'InvalidCredentialsError',
	'AccountLockedError',
	'RateLimitedError',
	'SessionExpiredError',
	'SessionNotFoundError',
	'SessionRevokedError',
	'InvalidTokenError',
	'TokenSignatureMismatchError',
	'CsrfMismatchError',
	'ForbiddenError',
	'ProviderError',
	'StoreError',
	'ConfigError',
]);

/**
 * Narrows an unknown value to an {@link AuthError}.
 *
 * Requires an actual `Error` instance, not merely an object carrying a matching
 * `_tag`. A structural check would let an attacker-influenced parsed payload
 * impersonate an auth failure and steer error handling.
 */
export const isAuthError = (value: unknown): value is AuthError =>
	value instanceof Error &&
	'_tag' in value &&
	typeof (value as { _tag: unknown })._tag === 'string' &&
	AUTH_ERROR_TAGS.has((value as { _tag: string })._tag);

/** The client-visible projection of a failure. */
export interface SafeResponseInit {
	readonly status: number;
	readonly headers: Readonly<Record<string, string>>;
	readonly body: {
		readonly error: AuthError['_tag'];
		readonly message: string;
	};
}

const statusFor = (error: AuthError): number => {
	switch (error._tag) {
		case 'InvalidCredentialsError':
		case 'SessionExpiredError':
		case 'SessionNotFoundError':
		case 'SessionRevokedError':
		case 'InvalidTokenError':
		case 'TokenSignatureMismatchError':
			return 401;
		case 'CsrfMismatchError':
		case 'ForbiddenError':
			return 403;
		case 'AccountLockedError':
			// 423 Locked, rather than 403, so operators can separate a policy
			// refusal from an account-state refusal in logs and dashboards.
			return 423;
		case 'RateLimitedError':
			return 429;
		case 'ProviderError':
			// The upstream failed, not the caller. 502 keeps client retry
			// semantics honest.
			return 502;
		case 'StoreError':
		case 'ConfigError':
			return 500;
	}
};

const retryAfterMsOf = (error: AuthError): number | undefined => {
	switch (error._tag) {
		case 'RateLimitedError':
		case 'AccountLockedError':
			return error.retryAfterMs;
		default:
			return undefined;
	}
};

/**
 * Projects a failure into the status, headers, and body a transport may send.
 *
 * This is the only sanctioned path from an {@link AuthError} to the wire. It
 * reads `safeMessage` and never `detail`, which is what makes "do not leak
 * internals" a property of the type rather than a habit of each call site.
 */
export const toSafeResponseInit = (error: AuthError): SafeResponseInit => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		// Authentication failures must never be cached by an intermediary; a
		// shared cache serving a 401 to the wrong user is a real outage mode.
		'Cache-Control': 'no-store',
	};

	const retryAfterMs = retryAfterMsOf(error);
	if (retryAfterMs !== undefined) {
		// Rounded up, and never below one second. Rounding down would advertise a
		// retry the limiter still rejects, turning a compliant client into a hot
		// loop against the very endpoint being protected.
		headers['Retry-After'] = String(Math.max(1, Math.ceil(retryAfterMs / 1000)));
	}

	return {
		status: statusFor(error),
		headers,
		body: { error: error._tag, message: error.safeMessage },
	};
};
