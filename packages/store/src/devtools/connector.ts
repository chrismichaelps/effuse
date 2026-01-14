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

import { Option, pipe } from 'effect';
import type { Store } from '../core/types.js';

interface DevToolsExtension {
	connect: (options?: { name?: string }) => DevToolsConnection;
}

interface DevToolsConnection {
	init: (state: unknown) => void;
	send: (action: { type: string; payload?: unknown }, state: unknown) => void;
	subscribe: (listener: (message: { type: string }) => void) => () => void;
}

export const hasDevTools = (): boolean => {
	if (typeof globalThis === 'undefined') return false;
	const w = globalThis as unknown as {
		__REDUX_DEVTOOLS_EXTENSION__?: DevToolsExtension;
	};
	return w.__REDUX_DEVTOOLS_EXTENSION__ !== undefined;
};

const connections = new Map<string, DevToolsConnection>();

export const connectDevTools = <T>(
	store: Store<T>,
	options?: { name?: string }
): (() => void) => {
	if (!hasDevTools()) {
		return () => {};
	}

	const w = globalThis as unknown as {
		__REDUX_DEVTOOLS_EXTENSION__?: DevToolsExtension;
	};
	const extension = w.__REDUX_DEVTOOLS_EXTENSION__;
	if (!extension) return () => {};

	const storeName = pipe(
		Option.fromNullable(options),
		Option.flatMap((o) => Option.fromNullable(o.name)),
		Option.getOrElse(() => store.name)
	);

	if (connections.has(storeName)) {
		return () => {};
	}

	const devTools = extension.connect({ name: `Effuse: ${storeName}` });
	connections.set(storeName, devTools);

	devTools.init(store.getSnapshot());

	const unsubscribe = store.subscribe(() => {
		devTools.send({ type: `${storeName}/update` }, store.getSnapshot());
	});

	return () => {
		unsubscribe();
		connections.delete(storeName);
	};
};

export const devToolsMiddleware = <T>(storeName: string) => {
	return (state: T, action: string, args: unknown[]): T | undefined => {
		const connection = connections.get(storeName);
		if (connection) {
			connection.send(
				{ type: action, payload: args.length === 1 ? args[0] : args },
				state
			);
		}
		return undefined;
	};
};

export const createDevToolsMiddleware = <T>(storeName: string) =>
	devToolsMiddleware<T>(storeName);

export const disconnectDevTools = (storeName: string): void => {
	connections.delete(storeName);
};

export const disconnectAllDevTools = (): void => {
	connections.clear();
};
