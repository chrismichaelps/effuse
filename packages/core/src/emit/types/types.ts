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

import type { Signal, ReadonlySignal } from '../../types/index.js';

export type EmitHandler<P> = (payload: P) => void;

export type EventMap = Record<string, any>;

export type EmitEvents<T extends EventMap> = T;

export type InferPayload<T> = T;

export interface EmitOptions {
	readonly debounce?: number;
	readonly throttle?: number;
	readonly once?: boolean;
	readonly filter?: (payload: unknown) => boolean;
}

export interface EmitContextData<T extends EventMap> {
	readonly handlers: Map<string, Set<EmitHandler<unknown>>>;
	readonly signals: Map<string, Signal<unknown>>;
	readonly _phantom?: T;
}

export type EmitFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => void;

export type EmitFnAsync<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => Promise<void>;

export type SubscribeFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	handler: EmitHandler<T[K]>
) => () => void;

export type EventSignal<P> = ReadonlySignal<P | undefined>;
