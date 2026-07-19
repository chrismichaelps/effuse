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

import {
	DEFAULT_CLOSE_TIMEOUT_MS,
	DEFAULT_MAX_BODY_BYTES,
	type CloseOptions,
	type EffuseServer,
	type FetchHandler,
	type ListenOptions,
	type ServerAdapter,
	type ServerAddress,
	type ServerOptions,
} from '../contract.js';
import { withBodyLimit } from '../internal/body-limit.js';
import { internalErrorResponse, shuttingDownResponse } from '../internal/envelopes.js';

const DEFAULT_HOST = '127.0.0.1';

/** The subset of `Bun.serve` this adapter relies on. */
interface BunServeOptions {
	readonly port?: number;
	readonly hostname?: string;
	readonly fetch: (request: Request) => Response | Promise<Response>;
}

interface BunServerHandle {
	readonly port: number;
	readonly hostname: string;
	stop(closeActiveConnections?: boolean): void | Promise<void>;
}

interface BunGlobal {
	serve(options: BunServeOptions): BunServerHandle;
}

const getBun = (): BunGlobal => {
	const bun = (globalThis as { Bun?: BunGlobal }).Bun;
	if (!bun) {
		throw new Error(
			'[effuse-server] The Bun adapter requires the Bun runtime. Run under `bun` or use the Node adapter.'
		);
	}
	return bun;
};

/** Creates a `Bun.serve` server bound to a single fetch handler. */
export const createBunServer = (
	handler: FetchHandler,
	options: ServerOptions = {}
): EffuseServer => {
	const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	const boundHandler = withBodyLimit(handler, maxBodyBytes);

	let handle: BunServerHandle | null = null;
	let address: ServerAddress | null = null;
	let closing = false;
	let closePromise: Promise<void> | null = null;

	const respond = async (request: Request): Promise<Response> => {
		if (closing) {
			return shuttingDownResponse();
		}
		try {
			return await boundHandler(request);
		} catch (error) {
			options.onError?.(error, request);
			return internalErrorResponse();
		}
	};

	const listen = (listenOptions: ListenOptions = {}): Promise<ServerAddress> => {
		if (listenOptions.signal?.aborted) {
			return Promise.reject(
				new Error('[effuse-server] listen aborted before binding')
			);
		}
		const hostname = listenOptions.host ?? DEFAULT_HOST;
		const bun = getBun();
		handle = bun.serve({
			port: listenOptions.port ?? 0,
			hostname,
			fetch: (request: Request) => respond(request),
		});
		address = {
			host: hostname,
			port: handle.port,
			url: `http://${hostname}:${String(handle.port)}`,
		};
		return Promise.resolve(address);
	};

	const close = (closeOptions: CloseOptions = {}): Promise<void> => {
		if (closePromise) {
			return closePromise;
		}
		closing = true;
		const timeoutMs = closeOptions.timeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;

		closePromise = (async () => {
			const current = handle;
			if (current) {
				// Graceful stop drains in-flight requests; a forced stop after the
				// timeout closes any that outlasted the drain budget.
				const graceful = Promise.resolve(current.stop(false));
				let timer: ReturnType<typeof setTimeout> | undefined;
				const timedOut = new Promise<void>((resolve) => {
					timer = setTimeout(resolve, timeoutMs);
				});
				await Promise.race([graceful, timedOut]);
				if (timer) {
					clearTimeout(timer);
				}
				await Promise.resolve(current.stop(true));
			}
			handle = null;
			address = null;
		})();

		return closePromise;
	};

	const fetch = async (request: Request): Promise<Response> => {
		try {
			return await boundHandler(request);
		} catch (error) {
			options.onError?.(error, request);
			return internalErrorResponse();
		}
	};

	return {
		runtime: 'bun',
		get address(): ServerAddress | null {
			return address;
		},
		listen,
		fetch,
		close,
	};
};

/** The Bun reference adapter. */
export const bunAdapter: ServerAdapter = {
	runtime: 'bun',
	create: createBunServer,
};
