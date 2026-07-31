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
 * Post-sign-in redirect validation.
 *
 * This is a classic open-redirect sink and an unusually dangerous one: the user
 * has just authenticated, so a redirect to an attacker's clone arrives with
 * maximum credibility and is the standard setup for credential phishing.
 *
 * The implementation resolves the target against the base URL using the URL
 * parser and then checks the resulting origin against an allowlist. That
 * ordering matters. String inspection of the raw target is what fails, because
 * the number of ways to write "somewhere else" is larger than any denylist:
 * `//host`, `///host`, `/\host`, `\/host`, `https://allowed@evil`, percent-
 * encoded separators, and scheme names split by tab or newline are all treated
 * as same-origin by hand-rolled checks and as cross-origin by browsers.
 *
 * Resolution is total: anything rejected falls back to the base URL rather than
 * raising. A failed redirect must not turn a successful sign-in into an error.
 */

export interface RedirectValidatorOptions {
	/** The application's own origin, and the fallback for a rejected target. */
	readonly baseUrl: string;
	/**
	 * Additional origins that may be redirected to, as hostnames.
	 *
	 * The base URL's own host is always permitted. Entries are matched as whole
	 * hostnames — never as substrings, which is how `evilapp.example.com` slips
	 * past a `.includes()` check.
	 */
	readonly allowedHosts?: readonly string[];
}

export interface RedirectValidator {
	/** True when the target would be honoured. */
	isAllowed(target: string | undefined | null): boolean;
	/** The URL to redirect to: the target if permitted, the base URL otherwise. */
	resolve(target: string | undefined | null): string;
}

// Characters that must never appear in a redirect target. Browsers strip or
// normalise them, so a filter that inspects the raw string sees something
// different from what the browser will eventually navigate to.
const CONTROL_OR_SPACE = /[\0-\x20\x7F]/;

const isLoopback = (hostname: string): boolean =>
	hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

export const createRedirectValidator = (
	options: RedirectValidatorOptions
): RedirectValidator => {
	const base = new URL(options.baseUrl);

	const permitted = new Set<string>([
		base.hostname.toLowerCase(),
		...(options.allowedHosts ?? []).map((host) => host.toLowerCase()),
	]);

	const parse = (target: string): URL | undefined => {
		// Rejected before parsing. The URL parser tolerates leading whitespace and
		// embedded control characters by stripping them, which is precisely how a
		// scheme gets smuggled past an earlier check.
		if (CONTROL_OR_SPACE.test(target)) return undefined;

		// Backslashes are normalised to forward slashes by several browsers, so
		// `/\evil.example` navigates cross-origin while reading as a local path.
		if (target.includes('\\')) return undefined;

		try {
			return new URL(target, base);
		} catch {
			return undefined;
		}
	};

	const allowed = (target: string | undefined | null): URL | undefined => {
		if (typeof target !== 'string' || target.length === 0) return undefined;

		const resolved = parse(target);
		if (resolved === undefined) return undefined;

		// Only http(s). `javascript:`, `data:`, and `file:` targets are script
		// execution or local disclosure rather than navigation.
		if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
			return undefined;
		}

		// Userinfo is never legitimate here, and `https://allowed@evil.example` is
		// read as the allowed host by anyone comparing prefixes.
		if (resolved.username !== '' || resolved.password !== '') return undefined;

		// Whole-hostname match. A suffix or substring comparison admits
		// `app.example.com.evil.example`.
		if (!permitted.has(resolved.hostname.toLowerCase())) return undefined;

		// The port must match the base URL's. An unexpected port on an allowed
		// host is a different service, and often one that is not meant to be
		// reachable.
		if (resolved.port !== base.port) return undefined;

		// No downgrading the scheme after sign-in; that would expose the session
		// cookie. Loopback is exempt because local development runs over http.
		if (base.protocol === 'https:' && resolved.protocol !== 'https:') {
			if (!isLoopback(resolved.hostname)) return undefined;
		}

		return resolved;
	};

	return {
		isAllowed: (target) => allowed(target) !== undefined,
		resolve: (target) => (allowed(target) ?? base).toString(),
	};
};
