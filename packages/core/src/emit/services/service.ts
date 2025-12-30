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
import type { Signal } from '../../types/index.js';
import type { EmitHandler, EmitContextData, EventMap } from '../types/index.js';
import {
	traceEmit,
	traceEmitSubscribe,
	traceEmitUnsubscribe,
} from '../../layers/tracing/emit.js';

export interface EmitServiceApi {
	createContext: <T extends EventMap>() => EmitContextData<T>;
	registerHandler: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string,
		handler: EmitHandler<unknown>
	) => () => void;
	emit: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string,
		payload: unknown
	) => void;
	getSignal: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string
	) => Signal<unknown>;
}

const defaultService: EmitServiceApi = {
	createContext: <T extends EventMap>(): EmitContextData<T> => ({
		handlers: new Map(),
		signals: new Map(),
	}),

	registerHandler: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string,
		handler: EmitHandler<unknown>
	): (() => void) => {
		let handlersSet = ctx.handlers.get(event);
		if (!handlersSet) {
			handlersSet = new Set();
			ctx.handlers.set(event, handlersSet);
		}
		handlersSet.add(handler);
		const storedHandlers = handlersSet;

		traceEmitSubscribe(event);

		return () => {
			storedHandlers.delete(handler);
			traceEmitUnsubscribe(event);
		};
	},

	emit: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string,
		payload: unknown
	): void => {
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

		const handlers = ctx.handlers.get(event);
		traceEmit(event, payload, handlers?.size ?? 0);
	},

	getSignal: <T extends EventMap>(
		ctx: EmitContextData<T>,
		event: string
	): Signal<unknown> => {
		let sig = ctx.signals.get(event);
		if (!sig) {
			sig = signal<unknown>(undefined);
			ctx.signals.set(event, sig);
		}
		return sig;
	},
};

export const getEmitService = (): EmitServiceApi => defaultService;

export const useEmitService = (fn: (service: EmitServiceApi) => void): void => {
	fn(defaultService);
};
