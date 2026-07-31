import { describe, expect, it } from 'vitest';
import { createRedirectValidator } from '../server/oauth/redirect.js';

const validator = createRedirectValidator({
	baseUrl: 'https://app.example.com',
	allowedHosts: ['app.example.com', 'admin.example.com'],
});

describe('same-origin targets', () => {
	it('accepts a relative path', () => {
		expect(validator.resolve('/dashboard')).toBe(
			'https://app.example.com/dashboard'
		);
	});

	it('accepts a relative path with query and fragment', () => {
		expect(validator.resolve('/search?q=1#top')).toBe(
			'https://app.example.com/search?q=1#top'
		);
	});

	it('accepts an absolute URL on an allowed host', () => {
		expect(validator.resolve('https://admin.example.com/panel')).toBe(
			'https://admin.example.com/panel'
		);
	});

	it('falls back to the base URL for an absent target', () => {
		expect(validator.resolve(undefined)).toBe('https://app.example.com/');
		expect(validator.resolve(null)).toBe('https://app.example.com/');
		expect(validator.resolve('')).toBe('https://app.example.com/');
	});
});

describe('open redirect', () => {
	// Post-sign-in redirect is the classic open-redirect sink: the user has just
	// authenticated, so a redirect to an attacker's clone is maximally credible.
	// Every rejection must fall back to the base URL rather than erroring.
	const hostile = [
		// Absolute URLs to hosts nobody allowed.
		'https://evil.example',
		'http://evil.example/path',
		// Protocol-relative — the single most-missed case, because it looks like a
		// path to a naive `startsWith('/')` check.
		'//evil.example',
		'//evil.example/path',
		'///evil.example',
		'////evil.example',
		// Backslash variants, which several browsers normalise to forward slashes.
		'\\\\evil.example',
		'/\\evil.example',
		'\\/evil.example',
		'/\\/evil.example',
		// Userinfo trick: the real host is after the @.
		'https://app.example.com@evil.example/',
		'//app.example.com@evil.example/',
		// Non-http schemes.
		'javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox(1)',
		'file:///etc/passwd',
		// Whitespace and control characters used to smuggle a scheme past a filter.
		' javascript:alert(1)',
		'java\tscript:alert(1)',
		'java\nscript:alert(1)',
		'\0javascript:alert(1)',
		// Host confusion via lookalike suffixes.
		'https://app.example.com.evil.example/',
		'https://notapp.example.com/',
		'https://evil.example/?next=https://app.example.com',
	];

	it.each(hostile)('rejects %j and falls back to the base URL', (target) => {
		expect(validator.resolve(target)).toBe('https://app.example.com/');
	});

	it('reports rejection separately from resolution', () => {
		// `resolve` is deliberately total. `isAllowed` exists for callers that want
		// to tell the user their link was ignored rather than silently redirecting.
		expect(validator.isAllowed('/dashboard')).toBe(true);
		expect(validator.isAllowed('//evil.example')).toBe(false);
	});

	it('rejects a host that merely shares a suffix with an allowed one', () => {
		// Substring matching on the host is how `evilapp.example.com` gets through.
		expect(validator.isAllowed('https://evilapp.example.com/')).toBe(false);
		expect(validator.isAllowed('https://example.com/')).toBe(false);
	});

	it('rejects a port that was not allowed', () => {
		expect(validator.isAllowed('https://app.example.com:8443/')).toBe(false);
	});

	it('rejects http when the base URL is https', () => {
		// Downgrading the scheme after sign-in exposes the session cookie.
		expect(validator.isAllowed('http://app.example.com/')).toBe(false);
	});

	it('keeps percent-encoded separators inside the path', () => {
		// These look alarming but are safe, and the distinction is worth pinning
		// down: the URL parser does not decode %2F into a path separator, so the
		// origin stays ours and the target is an ordinary — if odd — local path.
		// Rejecting them would be cargo-culting rather than defending anything.
		for (const target of [
			'%2F%2Fevil.example',
			'/%2F%2Fevil.example',
			'%5C%5Cevil.example',
		]) {
			expect(new URL(validator.resolve(target)).origin).toBe(
				'https://app.example.com'
			);
		}
	});

	it('never throws on unparseable input, and never leaves our origin', () => {
		// The invariant that actually matters is the origin, not the exact string.
		for (const target of ['%', 'http://', ':::', 'a'.repeat(100_000)]) {
			expect(() => validator.resolve(target)).not.toThrow();
			expect(new URL(validator.resolve(target)).origin).toBe(
				'https://app.example.com'
			);
		}
	});

	it('never leaves our origin for any hostile target', () => {
		// Stated once as a property over the whole corpus, so a future addition to
		// the list is covered even if someone forgets to assert on it.
		for (const target of hostile) {
			expect(new URL(validator.resolve(target)).origin).toBe(
				'https://app.example.com'
			);
		}
	});
});

describe('configuration', () => {
	it('allows the base URL host without it being listed', () => {
		const bare = createRedirectValidator({
			baseUrl: 'https://app.example.com',
		});

		expect(bare.isAllowed('https://app.example.com/x')).toBe(true);
		expect(bare.isAllowed('https://admin.example.com/x')).toBe(false);
	});

	it('honours a base URL that carries a path prefix', () => {
		// Apps deployed under a sub-path are where hand-rolled redirect checks
		// usually break.
		const nested = createRedirectValidator({
			baseUrl: 'https://example.com/app',
		});

		expect(nested.resolve('/dashboard')).toBe('https://example.com/dashboard');
		expect(nested.resolve(undefined)).toBe('https://example.com/app');
	});

	it('permits http for a localhost base URL', () => {
		// Local development is over http, and forcing https there would make the
		// validator something people disable rather than configure.
		const local = createRedirectValidator({ baseUrl: 'http://localhost:3000' });

		expect(local.isAllowed('http://localhost:3000/callback')).toBe(true);
		expect(local.isAllowed('http://evil.example/')).toBe(false);
	});
});
