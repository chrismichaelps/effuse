import { describe, expect, it } from 'vitest';
import {
	MAX_COOKIE_VALUE_BYTES,
	clearCookieChunks,
	parseCookieHeader,
	readChunkedCookie,
	serializeCookieChunks,
} from '../server/cookies.js';

const baseOptions = {
	name: 'effuse.session',
	path: '/',
	secure: true,
	sameSite: 'lax' as const,
	maxAgeSeconds: 3600,
};

const attributesOf = (header: string): string[] =>
	header
		.split(';')
		.slice(1)
		.map((part) => part.trim().toLowerCase());

describe('cookie attributes', () => {
	it('sets the attributes that make a session cookie unreadable to scripts', () => {
		const [header] = serializeCookieChunks('token', baseOptions);
		const attributes = attributesOf(header ?? '');

		// HttpOnly is what keeps an XSS from becoming a session theft; Secure
		// keeps it off plaintext transports; SameSite is CSRF defence in depth.
		expect(attributes).toContain('httponly');
		expect(attributes).toContain('secure');
		expect(attributes).toContain('samesite=lax');
		expect(attributes).toContain('path=/');
	});

	it('applies the __Host- prefix when the cookie qualifies for it', () => {
		// __Host- is enforced by the browser: no Domain, Path=/, and Secure. A
		// subdomain the attacker controls then cannot overwrite the cookie, which
		// is the standard session-fixation route on shared domains.
		const [header] = serializeCookieChunks('token', {
			...baseOptions,
			hostPrefix: true,
		});

		expect(header).toMatch(/^__Host-effuse\.session=/);
		expect(attributesOf(header ?? '')).not.toContainEqual(
			expect.stringContaining('domain=')
		);
	});

	it('refuses the __Host- prefix when a Domain is set, rather than emitting a cookie the browser will drop', () => {
		const [header] = serializeCookieChunks('token', {
			...baseOptions,
			hostPrefix: true,
			domain: 'example.com',
		});

		expect(header).not.toMatch(/^__Host-/);
	});

	it('omits Secure only when explicitly disabled, for local http development', () => {
		const [header] = serializeCookieChunks('token', {
			...baseOptions,
			secure: false,
		});

		expect(attributesOf(header ?? '')).not.toContain('secure');
	});

	it('supports SameSite=None only together with Secure', () => {
		// SameSite=None without Secure is rejected outright by browsers, so
		// emitting it would silently produce a session that never persists.
		const [header] = serializeCookieChunks('token', {
			...baseOptions,
			sameSite: 'none',
			secure: false,
		});

		const attributes = attributesOf(header ?? '');
		expect(attributes).toContain('secure');
		expect(attributes).toContain('samesite=none');
	});
});

describe('chunking', () => {
	const longValue = 'x'.repeat(MAX_COOKIE_VALUE_BYTES * 2 + 500);

	it('keeps a small value in a single unsuffixed cookie', () => {
		const headers = serializeCookieChunks('small', baseOptions);

		expect(headers).toHaveLength(1);
		expect(headers[0]).toMatch(/^effuse\.session=small;/);
	});

	it('splits an oversized value across numbered chunks', () => {
		// Browsers cap a cookie near 4 KB and silently drop anything larger. A
		// session that grows past the cap would otherwise vanish with no error.
		const headers = serializeCookieChunks(longValue, baseOptions);

		expect(headers.length).toBeGreaterThan(1);
		headers.forEach((header, index) => {
			expect(header).toMatch(
				new RegExp(`^effuse\\.session\\.${String(index)}=`)
			);
		});
	});

	it('round-trips a chunked value through a cookie header', () => {
		const headers = serializeCookieChunks(longValue, baseOptions);
		const jar = parseCookieHeader(
			headers.map((header) => header.split(';')[0]).join('; ')
		);

		expect(readChunkedCookie(jar, 'effuse.session')).toBe(longValue);
	});

	it('round-trips an unchunked value through a cookie header', () => {
		const headers = serializeCookieChunks('small', baseOptions);
		const jar = parseCookieHeader(headers[0]?.split(';')[0] ?? '');

		expect(readChunkedCookie(jar, 'effuse.session')).toBe('small');
	});

	it('round-trips a chunked value that carries the __Host- prefix', () => {
		// Regression: the prefix is applied to chunk names too, and reading only
		// looked for the unprefixed form. Since the prefix is on by default, any
		// session large enough to chunk became permanently unreadable — and the
		// unchunked path's fallback hid it until a session actually grew.
		const headers = serializeCookieChunks(longValue, {
			...baseOptions,
			hostPrefix: true,
		});
		expect(headers.length).toBeGreaterThan(1);
		expect(headers[0]).toMatch(/^__Host-effuse\.session\.0=/);

		const jar = parseCookieHeader(
			headers.map((header) => header.split(';')[0]).join('; ')
		);

		expect(readChunkedCookie(jar, 'effuse.session')).toBe(longValue);
	});

	it('round-trips an unchunked value that carries the __Host- prefix', () => {
		const headers = serializeCookieChunks('small', {
			...baseOptions,
			hostPrefix: true,
		});
		const jar = parseCookieHeader(headers[0]?.split(';')[0] ?? '');

		expect(readChunkedCookie(jar, 'effuse.session')).toBe('small');
	});

	it('returns undefined when a chunk is missing rather than a truncated value', () => {
		// A truncated token would fail signature verification anyway, but
		// returning it invites a caller to treat a partial session as real.
		const jar = parseCookieHeader('effuse.session.0=abc; effuse.session.2=ghi');

		expect(readChunkedCookie(jar, 'effuse.session')).toBeUndefined();
	});

	it('ignores an unchunked cookie when numbered chunks are also present', () => {
		const jar = parseCookieHeader('effuse.session=stale; effuse.session.0=fresh');

		expect(readChunkedCookie(jar, 'effuse.session')).toBe('fresh');
	});
});

describe('clearing', () => {
	it('expires every chunk currently present, not just the first', () => {
		// Shrinking from three chunks to one must not leave chunks 1 and 2 in the
		// browser. A stale trailing chunk makes the next read fail permanently.
		const jar = parseCookieHeader(
			'effuse.session.0=a; effuse.session.1=b; effuse.session.2=c'
		);
		const headers = clearCookieChunks(jar, baseOptions);

		expect(headers).toHaveLength(3);
		headers.forEach((header) => {
			expect(header).toContain('Max-Age=0');
			expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
		});
	});

	it('clears an unchunked cookie', () => {
		const jar = parseCookieHeader('effuse.session=value');

		expect(clearCookieChunks(jar, baseOptions)).toHaveLength(1);
	});

	it('emits nothing when there is nothing to clear', () => {
		expect(clearCookieChunks(parseCookieHeader(''), baseOptions)).toEqual([]);
	});
});

describe('parseCookieHeader', () => {
	it('parses a normal header', () => {
		expect(parseCookieHeader('a=1; b=2')).toEqual({ a: '1', b: '2' });
	});

	it('decodes percent-encoded values', () => {
		expect(parseCookieHeader('a=hello%20world')).toEqual({ a: 'hello world' });
	});

	it('survives malformed input without throwing', () => {
		// The Cookie header is attacker-controlled on every request.
		expect(() => parseCookieHeader('=; ;; a; b=; =c; d=%')).not.toThrow();
		expect(parseCookieHeader('')).toEqual({});
	});

	it('ignores prototype-polluting cookie names', () => {
		const jar = parseCookieHeader('__proto__=polluted; a=1');

		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
		expect(jar['a']).toBe('1');
	});

	it('keeps the first occurrence when a name repeats', () => {
		// Duplicate cookie names are a shadowing trick: an attacker who can set a
		// cookie on a parent domain appends a second value hoping the server reads
		// theirs. Browsers send the more specific one first, so first-wins is the
		// safe reading.
		expect(parseCookieHeader('a=first; a=second')).toEqual({ a: 'first' });
	});
});
