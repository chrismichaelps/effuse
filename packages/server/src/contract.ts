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
 * The portable server runtime contract for Effuse.
 *
 * Every adapter (Node, Bun, and future edge runtimes) implements the same
 * {@link EffuseServer} surface over Web-standard `Request`/`Response`. No
 * framework internals cross this boundary, so the same application handler
 * runs unchanged on any conforming runtime.
 */

/** The universal request handler produced by `@effuse/core`'s `createHandler`. */
export type FetchHandler = (
	request: Request
) => Response | Promise<Response>;

/** Identifier for a supported runtime. */
export type ServerRuntime = 'node' | 'bun';

/** Resolved bound address of a listening server. */
export interface ServerAddress {
	readonly host: string;
	readonly port: number;
	readonly url: string;
}

export interface ListenOptions {
	/** Port to bind. `0` (the default) requests an ephemeral port. */
	readonly port?: number;
	/** Host/interface to bind. Defaults to `127.0.0.1`. */
	readonly host?: string;
	/** Abort listening (and reject `listen`) when this signal fires. */
	readonly signal?: AbortSignal;
}

export interface CloseOptions {
	/** Milliseconds to wait for in-flight requests before force-closing. Default 10000. */
	readonly timeoutMs?: number;
}

export interface ServerOptions {
	/**
	 * Maximum request body size in bytes before a stable `413` is returned.
	 * The body is never buffered past this limit. Default 10 MiB.
	 */
	readonly maxBodyBytes?: number;
	/** Invoked once for each error that escapes the handler, before the 500 envelope. */
	readonly onError?: (error: unknown, request: Request) => void;
}

/**
 * A running (or runnable) server bound to a single {@link FetchHandler}.
 *
 * Instances are created via a {@link ServerAdapter}. `fetch` works without a
 * socket for tests, in-process SSR, and health checks; `listen`/`close` manage
 * the real network lifecycle.
 */
export interface EffuseServer {
	/** The runtime this server executes on. */
	readonly runtime: ServerRuntime;
	/** Bound address, or `null` until `listen` resolves. */
	readonly address: ServerAddress | null;
	/** Start accepting connections. Resolves with the bound address. */
	listen(options?: ListenOptions): Promise<ServerAddress>;
	/** Invoke the handler in-process with no socket round-trip. */
	fetch(request: Request): Promise<Response>;
	/** Stop accepting connections, drain in-flight requests, then force-close. */
	close(options?: CloseOptions): Promise<void>;
}

/** Factory that binds a handler to a specific runtime. */
export interface ServerAdapter {
	readonly runtime: ServerRuntime;
	create(handler: FetchHandler, options?: ServerOptions): EffuseServer;
}

/** Declared capabilities of a runtime adapter, for the compatibility matrix. */
export interface AdapterCapabilities {
	readonly runtime: ServerRuntime;
	/** Streams a `ReadableStream` response body without buffering it whole. */
	readonly streaming: boolean;
	/** Surfaces client disconnects on `request.signal`. */
	readonly requestAbort: boolean;
	/** `close()` drains in-flight requests before terminating. */
	readonly gracefulShutdown: boolean;
	/** Accepts `multipart/form-data` request bodies. */
	readonly multipart: boolean;
	/** Preserves multiple `Set-Cookie` response headers. */
	readonly setCookieMultiValue: boolean;
	/** Supports binding an ephemeral port via `port: 0`. */
	readonly ephemeralPort: boolean;
}

/** Default maximum request body size: 10 MiB. */
export const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

/** Default graceful-shutdown drain budget: 10 seconds. */
export const DEFAULT_CLOSE_TIMEOUT_MS = 10_000;
