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
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
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
import { toWebRequest, writeEnvelope, writeWebResponse } from './convert.js';

const DEFAULT_HOST = '127.0.0.1';

/** Creates a Node `http` server bound to a single fetch handler. */
export const createNodeServer = (
	handler: FetchHandler,
	options: ServerOptions = {}
): EffuseServer => {
	const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	const boundHandler = withBodyLimit(handler, maxBodyBytes);

	let address: ServerAddress | null = null;
	let closing = false;
	let closePromise: Promise<void> | null = null;

	let inFlight = 0;
	const drainWaiters = new Set<() => void>();

	const settleInFlight = (): void => {
		inFlight -= 1;
		if (inFlight === 0) {
			for (const resolve of drainWaiters) {
				resolve();
			}
			drainWaiters.clear();
		}
	};

	const handleRequest = async (
		req: IncomingMessage,
		res: ServerResponse,
		host: string
	): Promise<void> => {
		const controller = new AbortController();
		const abortIfUnfinished = (): void => {
			if (!res.writableEnded) {
				controller.abort();
			}
		};
		req.on('aborted', abortIfUnfinished);
		res.on('close', abortIfUnfinished);

		const request = toWebRequest(req, host, controller.signal);
		try {
			const response = await boundHandler(request);
			await writeWebResponse(
				res,
				response,
				controller.signal,
				req.method === 'HEAD'
			);
		} catch (error) {
			if (controller.signal.aborted) {
				if (!res.writableEnded) {
					res.destroy();
				}
				return;
			}
			options.onError?.(error, request);
			if (!res.headersSent) {
				await writeEnvelope(res, internalErrorResponse()).catch(() => {
					if (!res.writableEnded) {
						res.destroy();
					}
				});
			} else if (!res.writableEnded) {
				res.destroy();
			}
		}
	};

	const server: Server = createServer((req, res) => {
		if (closing) {
			void writeEnvelope(res, shuttingDownResponse()).catch(() => {
				if (!res.writableEnded) {
					res.destroy();
				}
			});
			return;
		}

		inFlight += 1;
		const host = address?.host ?? DEFAULT_HOST;
		void handleRequest(req, res, host).finally(settleInFlight);
	});

	const listen = (listenOptions: ListenOptions = {}): Promise<ServerAddress> => {
		const port = listenOptions.port ?? 0;
		const host = listenOptions.host ?? DEFAULT_HOST;
		const signal = listenOptions.signal;

		return new Promise<ServerAddress>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error('[effuse-server] listen aborted before binding'));
				return;
			}

			const onError = (error: Error): void => {
				reject(error);
			};
			server.once('error', onError);

			const onAbort = (): void => {
				server.close();
				reject(new Error('[effuse-server] listen aborted'));
			};
			signal?.addEventListener('abort', onAbort, { once: true });

			server.listen(port, host, () => {
				server.removeListener('error', onError);
				signal?.removeEventListener('abort', onAbort);
				const info = server.address() as AddressInfo;
				address = {
					host,
					port: info.port,
					url: `http://${host}:${String(info.port)}`,
				};
				resolve(address);
			});
		});
	};

	const close = (closeOptions: CloseOptions = {}): Promise<void> => {
		if (closePromise) {
			return closePromise;
		}
		closing = true;
		const timeoutMs = closeOptions.timeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;

		closePromise = (async () => {
			const serverClosed = new Promise<void>((resolve) => {
				server.close(() => {
					resolve();
				});
			});

			if (inFlight > 0) {
				const drained = new Promise<void>((resolve) => {
					drainWaiters.add(resolve);
				});
				let timer: NodeJS.Timeout | undefined;
				const timedOut = new Promise<void>((resolve) => {
					timer = setTimeout(resolve, timeoutMs);
				});
				await Promise.race([drained, timedOut]);
				if (timer) {
					clearTimeout(timer);
				}
			}

			// Close idle keep-alive sockets (and any that outlasted the timeout)
			// so the underlying server can fully shut down.
			server.closeAllConnections();
			await serverClosed;
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
		runtime: 'node',
		get address(): ServerAddress | null {
			return address;
		},
		listen,
		fetch,
		close,
	};
};

/** The Node reference adapter. */
export const nodeAdapter: ServerAdapter = {
	runtime: 'node',
	create: createNodeServer,
};
