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

import type {
	EffuseServer,
	FetchHandler,
	ServerAdapter,
	ServerOptions,
} from './contract.js';

/**
 * A minimal, structural view of the matcher and runner primitives shared by
 * vitest and `bun:test`. The harness only depends on this subset, so the same
 * suite runs unchanged under either runner.
 */
interface Matchers {
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toContain(expected: unknown): void;
	toBeGreaterThan(expected: number): void;
	toBeGreaterThanOrEqual(expected: number): void;
	toBeTruthy(): void;
}

export interface ConformanceHarness {
	describe(name: string, fn: () => void): void;
	it(name: string, fn: () => Promise<void> | void): void;
	expect(actual: unknown): Matchers;
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the portable adapter conformance suite against a given adapter.
 *
 * The suite exercises only Web `Request`/`Response` behavior over a real
 * socket, so passing it is the definition of a conforming Effuse server
 * runtime. Downstream (edge/vendor) adapters can re-use it verbatim.
 */
export const runConformance = (
	adapter: ServerAdapter,
	harness: ConformanceHarness
): void => {
	// Wrap in arrows so the runner methods keep their original `this` binding.
	const describe = (name: string, fn: () => void): void => {
		harness.describe(name, fn);
	};
	const it = (name: string, fn: () => Promise<void> | void): void => {
		harness.it(name, fn);
	};
	const expect = (actual: unknown): Matchers => harness.expect(actual);

	const withServer = async (
		handler: FetchHandler,
		run: (baseUrl: string, server: EffuseServer) => Promise<void>,
		options?: ServerOptions
	): Promise<void> => {
		const server = adapter.create(handler, options);
		const address = await server.listen({ port: 0 });
		try {
			await run(address.url, server);
		} finally {
			await server.close({ timeoutMs: 2000 });
		}
	};

	describe(`conformance: ${adapter.runtime}`, () => {
		it('reports its runtime and an ephemeral bound address', async () => {
			await withServer(
				() => new Response('ok'),
				(baseUrl, server) => {
					expect(server.runtime).toBe(adapter.runtime);
					expect(server.address?.port).toBeGreaterThan(0);
					expect(baseUrl.startsWith('http://')).toBe(true);
					return Promise.resolve();
				}
			);
		});

		it('delivers method, path, query, and headers to the handler', async () => {
			await withServer(
				(request) => {
					const url = new URL(request.url);
					return Response.json({
						method: request.method,
						path: url.pathname,
						q: url.searchParams.get('q'),
						header: request.headers.get('x-probe'),
					});
				},
				async (baseUrl) => {
					const res = await fetch(`${baseUrl}/hello?q=world`, {
						headers: { 'x-probe': 'yes' },
					});
					expect(res.status).toBe(200);
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.method).toBe('GET');
					expect(body.path).toBe('/hello');
					expect(body.q).toBe('world');
					expect(body.header).toBe('yes');
				}
			);
		});

		it('reads a POST request body as JSON', async () => {
			await withServer(
				async (request) => {
					const payload = (await request.json()) as { name: string };
					return Response.json({ greeting: `hi ${payload.name}` });
				},
				async (baseUrl) => {
					const res = await fetch(baseUrl, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ name: 'effuse' }),
					});
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.greeting).toBe('hi effuse');
				}
			);
		});

		it('round-trips a typed error response (status, body, headers)', async () => {
			await withServer(
				() =>
					new Response(JSON.stringify({ code: 'not_found' }), {
						status: 404,
						headers: {
							'content-type': 'application/json',
							'x-error-kind': 'typed',
						},
					}),
				async (baseUrl) => {
					const res = await fetch(baseUrl);
					expect(res.status).toBe(404);
					expect(res.headers.get('x-error-kind')).toBe('typed');
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.code).toBe('not_found');
				}
			);
		});

		it('surfaces client disconnects on request.signal', async () => {
			let observedAbort = false;
			await withServer(
				async (request) => {
					await new Promise<void>((resolve) => {
						if (request.signal.aborted) {
							observedAbort = true;
							resolve();
							return;
						}
						request.signal.addEventListener('abort', () => {
							observedAbort = true;
							resolve();
						});
						setTimeout(resolve, 2000);
					});
					return new Response('done');
				},
				async (baseUrl) => {
					const controller = new AbortController();
					const pending = fetch(baseUrl, { signal: controller.signal }).catch(
						() => undefined
					);
					await sleep(100);
					controller.abort();
					await pending;
					await sleep(150);
					expect(observedAbort).toBe(true);
				}
			);
		});

		it('streams a chunked response body in order', async () => {
			await withServer(
				() => {
					const encoder = new TextEncoder();
					const stream = new ReadableStream<Uint8Array>({
						async start(controller) {
							for (let i = 0; i < 3; i += 1) {
								controller.enqueue(encoder.encode(`chunk-${String(i)};`));
								await sleep(20);
							}
							controller.close();
						},
					});
					return new Response(stream, {
						headers: { 'content-type': 'text/plain' },
					});
				},
				async (baseUrl) => {
					const res = await fetch(baseUrl);
					const text = await res.text();
					expect(text).toBe('chunk-0;chunk-1;chunk-2;');
				}
			);
		});

		it('preserves multiple Set-Cookie headers and custom headers', async () => {
			await withServer(
				() => {
					const headers = new Headers();
					headers.append('set-cookie', 'a=1; Path=/');
					headers.append('set-cookie', 'b=2; Path=/');
					headers.set('x-custom', 'kept');
					return new Response('ok', { headers });
				},
				async (baseUrl) => {
					const res = await fetch(baseUrl);
					expect(res.headers.get('x-custom')).toBe('kept');
					const cookies = res.headers.getSetCookie();
					expect(cookies.length).toBe(2);
					expect(cookies).toContain('a=1; Path=/');
					expect(cookies).toContain('b=2; Path=/');
				}
			);
		});

		it('accepts a multipart body within the limit', async () => {
			await withServer(
				async (request) => {
					const form = await request.formData();
					return Response.json({ field: form.get('field') });
				},
				async (baseUrl) => {
					const form = new FormData();
					form.set('field', 'value');
					const res = await fetch(baseUrl, { method: 'POST', body: form });
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.field).toBe('value');
				}
			);
		});

		it('rejects an oversize body with a stable 413', async () => {
			await withServer(
				async (request) => {
					await request.text();
					return new Response('should not reach here');
				},
				async (baseUrl) => {
					const res = await fetch(baseUrl, {
						method: 'POST',
						headers: { 'content-type': 'text/plain' },
						body: 'x'.repeat(4096),
					});
					expect(res.status).toBe(413);
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.code).toBe('payload_too_large');
				},
				{ maxBodyBytes: 1024 }
			);
		});

		it('drains in-flight requests on graceful shutdown', async () => {
			await withServer(
				async () => {
					await sleep(200);
					return new Response('drained');
				},
				async (baseUrl, server) => {
					const inFlight = fetch(baseUrl);
					await sleep(50);
					const closed = server.close({ timeoutMs: 2000 });
					const res = await inFlight;
					expect(res.status).toBe(200);
					expect(await res.text()).toBe('drained');
					await closed;

					let rejectedOrUnavailable = false;
					try {
						const after = await fetch(baseUrl);
						rejectedOrUnavailable = after.status >= 500;
					} catch {
						rejectedOrUnavailable = true;
					}
					expect(rejectedOrUnavailable).toBe(true);
				}
			);
		});

		it('invokes the handler in-process via fetch() without a socket', async () => {
			const server = adapter.create((request) =>
				Response.json({ path: new URL(request.url).pathname })
			);
			const res = await server.fetch(
				new Request('http://local.test/in-process')
			);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body.path).toBe('/in-process');
		});

		it('returns a 500 envelope when the handler throws', async () => {
			await withServer(
				() => {
					throw new Error('boom');
				},
				async (baseUrl) => {
					const res = await fetch(baseUrl);
					expect(res.status).toBe(500);
					const body = (await res.json()) as Record<string, unknown>;
					expect(body.code).toBe('internal_error');
				},
				{ onError: () => undefined }
			);
		});
	});
};
