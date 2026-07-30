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
 * Cookie serialisation for session transport.
 *
 * Two properties here are load-bearing and easy to get wrong:
 *
 * - **Chunking.** Browsers cap a single cookie near 4 KB and drop anything
 *   larger without an error. A session that grows past the cap — a few extra
 *   claims, a longer subject id — simply stops working, and the failure looks
 *   like a signature problem rather than a size problem.
 * - **Clearing every chunk that exists.** Shrinking from three chunks to one
 *   must expire the two now-unused chunks. A stale trailing chunk makes every
 *   subsequent read return a value that cannot verify, and the user is stuck
 *   until they clear cookies by hand.
 */

/**
 * Maximum bytes placed in one cookie's value.
 *
 * The practical browser limit is 4096 bytes for the entire `name=value;
 * attributes` pair. 3800 leaves room for the name, the chunk suffix, and the
 * attribute string without needing to measure them per call.
 */
export const MAX_COOKIE_VALUE_BYTES = 3800;

export type SameSitePolicy = 'strict' | 'lax' | 'none';

export interface CookieOptions {
	readonly name: string;
	readonly path: string;
	readonly secure: boolean;
	readonly sameSite: SameSitePolicy;
	readonly maxAgeSeconds?: number;
	readonly domain?: string;
	/**
	 * Request the `__Host-` name prefix.
	 *
	 * The browser enforces the prefix's preconditions — `Secure`, `Path=/`, and
	 * no `Domain` — which is what stops a sibling subdomain from overwriting the
	 * session cookie. That overwrite is the usual session-fixation route on a
	 * shared apex domain, so the prefix is worth the constraints.
	 *
	 * Silently dropped when the cookie does not qualify, because emitting a
	 * `__Host-` cookie the browser will reject is worse than emitting a plain one.
	 */
	readonly hostPrefix?: boolean;
}

/** A parsed `Cookie` request header. */
export type CookieJar = Readonly<Record<string, string>>;

const FORBIDDEN_COOKIE_NAMES: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
]);

const qualifiesForHostPrefix = (options: CookieOptions): boolean =>
	options.hostPrefix === true &&
	options.secure &&
	options.path === '/' &&
	options.domain === undefined;

const effectiveName = (options: CookieOptions): string =>
	qualifiesForHostPrefix(options) ? `__Host-${options.name}` : options.name;

const serializeOne = (
	name: string,
	value: string,
	options: CookieOptions,
	overrides: { readonly maxAgeSeconds?: number; readonly expires?: string } = {}
): string => {
	const parts = [`${name}=${encodeURIComponent(value)}`];

	parts.push(`Path=${options.path}`);

	// A __Host- cookie must carry no Domain; the browser rejects it otherwise.
	if (options.domain !== undefined && !qualifiesForHostPrefix(options)) {
		parts.push(`Domain=${options.domain}`);
	}

	// SameSite=None without Secure is rejected by every current browser, so the
	// combination is corrected rather than emitted and silently dropped.
	if (options.secure || options.sameSite === 'none') {
		parts.push('Secure');
	}

	parts.push('HttpOnly');
	parts.push(
		`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
	);

	const maxAge = overrides.maxAgeSeconds ?? options.maxAgeSeconds;
	if (maxAge !== undefined) {
		parts.push(`Max-Age=${String(maxAge)}`);
	}

	if (overrides.expires !== undefined) {
		parts.push(`Expires=${overrides.expires}`);
	}

	return parts.join('; ');
};

const byteLength = (value: string): number =>
	new TextEncoder().encode(value).length;

/**
 * Splits a value into chunks that each fit within {@link MAX_COOKIE_VALUE_BYTES}
 * once percent-encoded.
 *
 * Encoding is measured rather than assumed, because a single multi-byte
 * character can expand to nine bytes and a fixed character count would
 * overshoot the limit for any non-ASCII payload.
 */
const splitByEncodedBytes = (value: string): readonly string[] => {
	if (byteLength(encodeURIComponent(value)) <= MAX_COOKIE_VALUE_BYTES) {
		return [value];
	}

	const chunks: string[] = [];
	let current = '';

	for (const character of value) {
		const candidate = current + character;
		if (byteLength(encodeURIComponent(candidate)) > MAX_COOKIE_VALUE_BYTES) {
			chunks.push(current);
			current = character;
			continue;
		}
		current = candidate;
	}

	if (current.length > 0) chunks.push(current);

	return chunks;
};

/**
 * Serialises a value into one or more `Set-Cookie` headers.
 *
 * A value that fits uses the bare name. A value that does not is written as
 * `name.0`, `name.1`, and so on — the bare name is then absent, which is how
 * {@link readChunkedCookie} tells the two layouts apart.
 */
export const serializeCookieChunks = (
	value: string,
	options: CookieOptions
): readonly string[] => {
	const name = effectiveName(options);
	const chunks = splitByEncodedBytes(value);

	if (chunks.length === 1) {
		return [serializeOne(name, chunks[0] ?? '', options)];
	}

	return chunks.map((chunk, index) =>
		serializeOne(`${name}.${String(index)}`, chunk, options)
	);
};

/**
 * Parses a `Cookie` request header.
 *
 * Never throws: this header is fully attacker-controlled on every request, so a
 * parse error would be an unhandled 500 and a trivial denial of service.
 * Malformed pairs are skipped rather than rejecting the whole header, because
 * one bad third-party cookie must not sign a user out.
 */
export const parseCookieHeader = (header: string | null | undefined): CookieJar => {
	const jar: Record<string, string> = Object.create(null) as Record<
		string,
		string
	>;

	if (typeof header !== 'string' || header.length === 0) return { ...jar };

	for (const pair of header.split(';')) {
		const separator = pair.indexOf('=');
		if (separator <= 0) continue;

		const name = pair.slice(0, separator).trim();
		if (name.length === 0 || FORBIDDEN_COOKIE_NAMES.has(name)) continue;

		// First occurrence wins. Duplicate names are a shadowing trick: an
		// attacker able to set a cookie on a parent domain appends a second value
		// hoping the server reads theirs. Browsers send the more specific cookie
		// first, so keeping the first is the safe reading.
		if (Object.prototype.hasOwnProperty.call(jar, name)) continue;

		const rawValue = pair.slice(separator + 1).trim();

		try {
			jar[name] = decodeURIComponent(rawValue);
		} catch {
			// Malformed percent-encoding. Keep the raw value rather than dropping
			// the cookie; a signature check downstream will reject it if it matters.
			jar[name] = rawValue;
		}
	}

	return { ...jar };
};

const chunkNamesFor = (jar: CookieJar, name: string): readonly string[] =>
	Object.keys(jar)
		.filter((key) => new RegExp(`^${name.replace(/\./g, '\\.')}\\.\\d+$`).test(key))
		.sort(
			(a, b) =>
				Number(a.slice(name.length + 1)) - Number(b.slice(name.length + 1))
		);

/**
 * Reassembles a value written by {@link serializeCookieChunks}.
 *
 * Returns `undefined` when a chunk in the middle of the sequence is missing.
 * Returning the surviving prefix instead would hand a caller a truncated token
 * that looks like a real one.
 */
export const readChunkedCookie = (
	jar: CookieJar,
	name: string
): string | undefined => {
	// Both spellings must be tried. `serializeCookieChunks` applies the `__Host-`
	// prefix — which is on by default — to chunk names too, so looking only for
	// the unprefixed form makes any session large enough to chunk permanently
	// unreadable. The unchunked path had a fallback for this and the chunked path
	// did not, which hid the bug until a session actually outgrew one cookie.
	for (const candidate of [`__Host-${name}`, name]) {
		const chunkNames = chunkNamesFor(jar, candidate);
		if (chunkNames.length === 0) continue;

		// Chunks take precedence over a bare cookie of the same name: if both
		// exist, the bare one is a leftover from before the value outgrew a single
		// cookie.
		const values: string[] = [];
		for (const [index, chunkName] of chunkNames.entries()) {
			if (chunkName !== `${candidate}.${String(index)}`) return undefined;
			const value = jar[chunkName];
			if (value === undefined) return undefined;
			values.push(value);
		}

		return values.join('');
	}

	return jar[name] ?? jar[`__Host-${name}`];
};

/**
 * Produces `Set-Cookie` headers that expire every chunk currently present.
 *
 * Driven by what the request actually carried, not by what the current value
 * would occupy, which is the only way to clean up after a shrink.
 */
export const clearCookieChunks = (
	jar: CookieJar,
	options: CookieOptions
): readonly string[] => {
	const name = effectiveName(options);
	const bareNames = [options.name, `__Host-${options.name}`];

	const present = [
		...bareNames.filter((candidate) =>
			Object.prototype.hasOwnProperty.call(jar, candidate)
		),
		...chunkNamesFor(jar, options.name),
		...chunkNamesFor(jar, `__Host-${options.name}`),
	];

	// Both Max-Age and Expires: Max-Age is authoritative in modern browsers, and
	// Expires is the fallback for anything that ignores it.
	return present.map((cookieName) =>
		serializeOne(
			cookieName.startsWith('__Host-') ? cookieName : cookieName,
			'',
			{ ...options, name },
			{ maxAgeSeconds: 0, expires: 'Thu, 01 Jan 1970 00:00:00 GMT' }
		)
	);
};
