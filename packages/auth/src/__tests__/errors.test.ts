import { describe, expect, it } from 'vitest';
import {
	AccountLockedError,
	CsrfMismatchError,
	ForbiddenError,
	InvalidCredentialsError,
	InvalidResetTokenError,
	PasswordPolicyError,
	RateLimitedError,
	SessionExpiredError,
	SessionRevokedError,
	StoreError,
	TokenSignatureMismatchError,
	isAuthError,
	toSafeResponseInit,
	type AuthError,
} from '../errors.js';

describe('AuthError', () => {
	it('is exhaustively matchable on _tag with no default branch', () => {
		// The value of a discriminated union is that the compiler enforces
		// completeness. If this function stops typechecking after a member is
		// added, that is the design working.
		const classify = (error: AuthError): string => {
			switch (error._tag) {
				case 'InvalidCredentialsError':
					return 'credentials';
				case 'PasswordPolicyError':
					return 'password-policy';
				case 'AccountLockedError':
					return 'locked';
				case 'RateLimitedError':
					return 'throttled';
				case 'SessionExpiredError':
					return 'expired';
				case 'SessionNotFoundError':
					return 'missing';
				case 'SessionRevokedError':
					return 'revoked';
				case 'InvalidTokenError':
					return 'token';
				case 'InvalidResetTokenError':
					return 'reset-token';
				case 'TokenSignatureMismatchError':
					return 'signature';
				case 'CsrfMismatchError':
					return 'csrf';
				case 'ForbiddenError':
					return 'forbidden';
				case 'ProviderError':
					return 'provider';
				case 'StoreError':
					return 'store';
				case 'ConfigError':
					return 'config';
			}
		};

		expect(classify(new InvalidCredentialsError())).toBe('credentials');
		expect(classify(new CsrfMismatchError())).toBe('csrf');
	});

	it('recognises its own members and rejects foreign errors', () => {
		expect(isAuthError(new SessionExpiredError())).toBe(true);
		expect(isAuthError(new Error('nope'))).toBe(false);
		expect(isAuthError({ _tag: 'InvalidCredentialsError' })).toBe(false);
		expect(isAuthError(null)).toBe(false);
	});
});

describe('safeMessage', () => {
	it('never distinguishes an unknown user from a wrong password', () => {
		// User enumeration mitigation. Both paths construct the same error, and
		// nothing client-visible may differ between them.
		const unknownUser = new InvalidCredentialsError({
			detail: 'no user record for a@example.com',
		});
		const wrongPassword = new InvalidCredentialsError({
			detail: 'password hash mismatch for user_1',
		});

		expect(unknownUser.safeMessage).toBe(wrongPassword.safeMessage);
		expect(toSafeResponseInit(unknownUser)).toEqual(
			toSafeResponseInit(wrongPassword)
		);
	});

	it('keeps diagnostic detail out of the client-visible surface', () => {
		const error = new StoreError({
			operation: 'get',
			detail: 'postgres://user:hunter2@db.internal/main timed out',
		});

		expect(error.safeMessage).not.toContain('hunter2');
		expect(JSON.stringify(toSafeResponseInit(error))).not.toContain('hunter2');
	});
});

describe('toSafeResponseInit', () => {
	it('maps each member to the status a transport should emit', () => {
		expect(toSafeResponseInit(new InvalidCredentialsError()).status).toBe(401);
		expect(toSafeResponseInit(new SessionExpiredError()).status).toBe(401);
		expect(toSafeResponseInit(new TokenSignatureMismatchError()).status).toBe(
			401
		);
		expect(toSafeResponseInit(new SessionRevokedError()).status).toBe(401);
		expect(toSafeResponseInit(new InvalidResetTokenError()).status).toBe(400);
		expect(
			toSafeResponseInit(
				new PasswordPolicyError({ reason: 'Use at least 12 characters.' })
			).status
		).toBe(400);
		expect(toSafeResponseInit(new CsrfMismatchError()).status).toBe(403);
		expect(toSafeResponseInit(new ForbiddenError()).status).toBe(403);
		expect(
			toSafeResponseInit(new AccountLockedError({ retryAfterMs: 60_000 }))
				.status
		).toBe(423);
		expect(
			toSafeResponseInit(new RateLimitedError({ retryAfterMs: 1000 })).status
		).toBe(429);
		expect(
			toSafeResponseInit(new StoreError({ operation: 'set' })).status
		).toBe(500);
	});

	it('emits Retry-After in whole seconds, rounded up, for throttled members', () => {
		// Rounding down would advertise a retry the limiter still rejects, which
		// turns a well-behaved client into a hot loop.
		expect(
			toSafeResponseInit(new RateLimitedError({ retryAfterMs: 1500 })).headers[
				'Retry-After'
			]
		).toBe('2');
		expect(
			toSafeResponseInit(new AccountLockedError({ retryAfterMs: 30_000 }))
				.headers['Retry-After']
		).toBe('30');
		expect(
			toSafeResponseInit(new RateLimitedError({ retryAfterMs: 1 })).headers[
				'Retry-After'
			]
		).toBe('1');
	});

	it('omits Retry-After for members that carry no retry budget', () => {
		expect(
			toSafeResponseInit(new CsrfMismatchError()).headers
		).not.toHaveProperty('Retry-After');
	});
});
