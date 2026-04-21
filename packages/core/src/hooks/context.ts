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

import { Effect, Scope, Exit, Predicate } from 'effect';
import { signal } from '../reactivity/signal.js';
import { computed } from '../reactivity/computed.js';
import { watchEffect as reactiveEffect } from '../effects/effect.js';
import {
	traceHookEffect,
	traceHookCleanup,
	traceHookDispose,
} from '../layers/tracing/hooks.js';
import { getActiveLifecycle } from '../blueprint/lifecycle.js';
import type {
	HookContext,
	HookCleanup,
	HookScope,
	HookFinalizer,
	EffectCallback,
} from './types.js';
import type { CompiledLayer } from '../layers/api/defineLayer.js';
import {
	resolveLayersAccessor,
	type LayersAccessor,
} from '../layers/api/layersAccessor.js';

const createHookScope = (): HookScope => {
	const internalScope = Effect.runSync(Scope.make());
	const finalizers: HookFinalizer[] = [];

	return {
		addFinalizer: (fn: HookFinalizer) => {
			finalizers.push(fn);
		},
		dispose: async () => {
			for (const fn of finalizers.reverse()) {
				await fn();
			}
			Effect.runSync(Scope.close(internalScope, Exit.void));
		},
	};
};

export const createHookContext = <
	C,
	L extends readonly CompiledLayer<any>[] = readonly never[],
>(
	config: C,
	layers: L,
	hookName?: string
): {
	ctx: HookContext<C, L>;
	dispose: () => Promise<void>;
} => {
	const cleanups: HookCleanup[] = [];
	const scope = createHookScope();
	const name = hookName ?? 'anonymous';
	let effectIndex = 0;

	const wrappedEffect = (fn: EffectCallback) => {
		const currentIndex = effectIndex++;
		reactiveEffect(() => {
			const start = performance.now();
			const result = fn();
			const duration = performance.now() - start;

			traceHookEffect(name, currentIndex, duration);

			if (Predicate.isFunction(result)) {
				cleanups.push(() => {
					traceHookCleanup(`${name}[${String(currentIndex)}]`);
					result();
				});
			}
		});
	};

	const onMount = (fn: EffectCallback) => {
		const lifecycle = getActiveLifecycle();
		if (lifecycle) {
			lifecycle.onMount(() => fn());
		}
	};

	const use = <R>(hook: () => R): R => hook();

	const runAsync = async <T>(fn: () => Promise<T>): Promise<T> => fn();

	const dispose = async () => {
		const start = performance.now();
		const cleanupCount = cleanups.length;

		for (const cleanup of cleanups.reverse()) {
			cleanup();
		}
		await scope.dispose();

		const duration = performance.now() - start;
		traceHookDispose(name, duration, cleanupCount);
	};

	const ctx: HookContext<C, L> = {
		config,
		signal,
		computed,
		watchEffect: wrappedEffect,
		onMount,
		scope,
		layers: resolveLayersAccessor(layers) as LayersAccessor<L>,
		use,
		runAsync,
	};

	return { ctx, dispose };
};
