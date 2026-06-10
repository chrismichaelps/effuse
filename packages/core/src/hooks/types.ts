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

import type { Signal, ReadonlySignal } from '../types/index.js';
import type {
	LayerSource,
	LayersAccessor,
} from '../layers/api/layersAccessor.js';

export type HookCleanup = () => void;

export type HookFinalizer = () => void | Promise<void>;

export type EffectCallback = () => HookCleanup | undefined;

export interface HookScope {
	addFinalizer: (fn: HookFinalizer) => void;
	dispose: () => Promise<void>;
}

export interface HookContext<
	C = unknown,
	L extends LayerSource = readonly never[],
> {
	readonly config: C;
	readonly signal: <T>(initial: T) => Signal<T>;
	readonly computed: <T>(fn: () => T) => ReadonlySignal<T>;
	readonly watchEffect: (fn: EffectCallback) => void;
	readonly onMount: (fn: EffectCallback) => void;
	readonly scope: HookScope;
	readonly layers: LayersAccessor<L>;
	readonly use: <R>(hook: () => R) => R;
	readonly runAsync: <T>(fn: () => Promise<T>) => Promise<T>;
}

export type HookSetupFn<
	C,
	R,
	L extends LayerSource = readonly never[],
> = (ctx: HookContext<C, L>) => R;

export interface HookDefinition<
	C = unknown,
	R = unknown,
	L extends LayerSource = readonly never[],
> {
	readonly layers?: L;
	readonly setup: HookSetupFn<C, R, L>;
}

export type InferHookReturn<H> =
	H extends HookDefinition<unknown, infer R, any> ? R : never;

export type InferHookConfig<H> =
	H extends HookDefinition<infer C, unknown, any> ? C : never;
