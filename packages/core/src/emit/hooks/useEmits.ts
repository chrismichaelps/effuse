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

import { signal } from '../../reactivity/signal.js';
import { batch } from '../../reactivity/dep.js';
import type {
	EmitContextData,
	EmitFn,
	EmitFnAsync,
	EmitHandler,
	SubscribeFn,
	EventMap,
} from '../types/index.js';

export function useEmits<T extends EventMap>(
	initialHandlers?: Partial<{ [K in keyof T]: EmitHandler<T[K]> }>
): {
	emit: EmitFn<T>;
	emitAsync: EmitFnAsync<T>;
	on: SubscribeFn<T>;
	off: <K extends keyof T & string>(
		event: K,
		handler: EmitHandler<T[K]>
	) => void;
	context: EmitContextData<T>;
} {
	const ctx: EmitContextData<T> = {
		handlers: new Map(),
		signals: new Map(),
	};

	if (initialHandlers) {
		for (const [event, handler] of Object.entries(initialHandlers)) {
			if (handler) {
				let handlers = ctx.handlers.get(event);
				if (!handlers) {
					handlers = new Set();
					ctx.handlers.set(event, handlers);
				}
				handlers.add(handler as EmitHandler<unknown>);
			}
		}
	}

	const emit = <K extends keyof T & string>(event: K, payload: T[K]): void => {
		batch(() => {
			const handlers = ctx.handlers.get(event);
			if (handlers) {
				for (const handler of handlers) {
					handler(payload);
				}
			}

			let sig = ctx.signals.get(event);
			if (!sig) {
				sig = signal<unknown>(undefined);
				ctx.signals.set(event, sig);
			}
			sig.value = payload;
		});
	};

	const emitAsync = <K extends keyof T & string>(
		event: K,
		payload: T[K]
	): Promise<void> => {
		return new Promise((resolve) => {
			queueMicrotask(() => {
				emit(event, payload);
				resolve();
			});
		});
	};

	const on: SubscribeFn<T> = <K extends keyof T & string>(
		event: K,
		handler: EmitHandler<T[K]>
	): (() => void) => {
		let handlersSet = ctx.handlers.get(event);
		if (!handlersSet) {
			handlersSet = new Set();
			ctx.handlers.set(event, handlersSet);
		}
		const typedHandler = handler as EmitHandler<unknown>;
		handlersSet.add(typedHandler);

		const storedHandlers = handlersSet;
		return () => {
			storedHandlers.delete(typedHandler);
		};
	};

	const off = <K extends keyof T & string>(
		event: K,
		handler: EmitHandler<T[K]>
	): void => {
		const handlers = ctx.handlers.get(event);
		if (handlers) {
			handlers.delete(handler as EmitHandler<unknown>);
		}
	};

	return { emit, emitAsync, on, off, context: ctx };
}
