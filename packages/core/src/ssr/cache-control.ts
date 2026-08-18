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
 * The directives an SSR response may carry on `Cache-Control`.
 *
 * `stale-while-revalidate` and `stale-if-error` accept `true` to emit the bare
 * token, which is what `server-routing.ts` has always sent for route data.
 */
export interface CacheControlOptions {
	/** `public` or `private`. Omitted when unset. */
	readonly visibility?: 'public' | 'private';
	/** Browser lifetime, seconds. */
	readonly maxAge?: number;
	/** Shared-cache lifetime, seconds. This is what a CDN honours. */
	readonly sMaxAge?: number;
	/** Window in which a shared cache may serve stale while it refreshes. */
	readonly staleWhileRevalidate?: number | true;
	/** Window in which a shared cache may serve stale after an origin error. */
	readonly staleIfError?: number | true;
	/** Forbid serving stale once expired. */
	readonly mustRevalidate?: boolean;
	/** Suppress storage entirely; every other directive is dropped. */
	readonly noStore?: boolean;
}

const seconds = (value: number | true, name: string): string =>
	value === true ? name : `${name}=${String(value)}`;

/**
 * Assemble a `Cache-Control` value.
 *
 * Both producers use this. `handler.ts` built the header from a fixed template
 * that always ended in `must-revalidate` and had no way to reach
 * `stale-while-revalidate`, while `server-routing.ts` emitted that directive
 * for route data — so the framework knew about it in one place only.
 *
 * Only what is set is emitted, so a caller reproduces either historical output
 * exactly, and `no-store` short-circuits because it is meaningless beside a
 * lifetime.
 */
export const buildCacheControl = (options: CacheControlOptions): string => {
	if (options.noStore) return 'no-store';

	const directives: string[] = [];

	if (options.visibility !== undefined) directives.push(options.visibility);
	if (options.maxAge !== undefined) {
		directives.push(`max-age=${String(options.maxAge)}`);
	}
	if (options.sMaxAge !== undefined) {
		directives.push(`s-maxage=${String(options.sMaxAge)}`);
	}
	if (options.staleWhileRevalidate !== undefined) {
		directives.push(
			seconds(options.staleWhileRevalidate, 'stale-while-revalidate')
		);
	}
	if (options.staleIfError !== undefined) {
		directives.push(seconds(options.staleIfError, 'stale-if-error'));
	}
	if (options.mustRevalidate) directives.push('must-revalidate');

	return directives.join(', ');
};
