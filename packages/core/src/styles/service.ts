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

import { Effect, Context, Layer, Schedule, Duration } from 'effect';
import { Schema } from 'effect';
import type { StyleOptions } from './types.js';
import { DEFAULT_STYLE_OPTIONS, STYLE_CONFIG } from './config.js';

const UrlSchema = Schema.String.pipe(
	Schema.filter(
		(s) => {
			if (s.startsWith('./') || s.startsWith('/') || s.startsWith('http')) {
				return true;
			}
			return false;
		},
		{ message: () => 'Invalid URL format' }
	)
);

interface CssLoaderService {
	readonly load: (
		url: string,
		options: StyleOptions
	) => Effect.Effect<void, Error>;
	readonly unload: (url: string) => Effect.Effect<void>;
}

class CssLoader extends Context.Tag('CssLoader')<
	CssLoader,
	CssLoaderService
>() {}

const activeLinks = new Map<string, HTMLLinkElement>();

const CssLoaderLive = Layer.succeed(
	CssLoader,
	CssLoader.of({
		load: (url, options) =>
			Effect.gen(function* () {
				if (typeof document === 'undefined') {
					return;
				}

				const opts = { ...DEFAULT_STYLE_OPTIONS, ...options };

				const validatedUrl = yield* Schema.decodeUnknown(UrlSchema)(url).pipe(
					Effect.mapError(() => new Error(`Invalid CSS URL: ${url}`))
				);

				if (activeLinks.has(validatedUrl)) {
					return;
				}

				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = validatedUrl;

				const loadEffect = Effect.async<undefined, Error>((resume) => {
					link.onload = () => {
						resume(Effect.succeed(undefined));
					};
					link.onerror = () => {
						resume(Effect.fail(new Error(`Failed to load: ${validatedUrl}`)));
					};

					if (opts.lazy) {
						const scheduleLoad =
							typeof window !== 'undefined' && 'requestIdleCallback' in window
								? window.requestIdleCallback
								: (cb: () => void) => setTimeout(cb, 0);

						scheduleLoad(() => {
							document.head.appendChild(link);
						});
					} else {
						document.head.appendChild(link);
					}
				});

				const retrySchedule = Schedule.exponential(
					Duration.millis(STYLE_CONFIG.RETRY_BASE_DELAY)
				).pipe(Schedule.compose(Schedule.recurs(opts.retries)));

				yield* loadEffect.pipe(
					Effect.timeout(Duration.millis(opts.timeout)),
					Effect.retry(retrySchedule),
					Effect.catchAll(() => Effect.succeed(undefined))
				);

				activeLinks.set(validatedUrl, link);
			}),

		unload: (url) =>
			Effect.sync(() => {
				if (typeof document === 'undefined') {
					return;
				}
				const link = activeLinks.get(url);
				if (link) {
					link.remove();
					activeLinks.delete(url);
				}
			}),
	})
);

const loadStyles = (
	urls: readonly string[],
	options: StyleOptions = {}
): Effect.Effect<void, Error, CssLoader> =>
	Effect.gen(function* () {
		const loader = yield* CssLoader;

		yield* Effect.all(
			urls.map((url) => loader.load(url, options)),
			{ concurrency: 'unbounded' }
		);
	});

const unloadStyles = (
	urls: readonly string[]
): Effect.Effect<void, never, CssLoader> =>
	Effect.gen(function* () {
		const loader = yield* CssLoader;

		yield* Effect.all(
			urls.map((url) => loader.unload(url)),
			{ concurrency: 'unbounded' }
		);
	});

export { CssLoader, CssLoaderLive, loadStyles, unloadStyles };
