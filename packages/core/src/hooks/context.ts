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

import { Predicate } from 'effect';
import { signal } from '../reactivity/signal.js';
import { computed } from '../reactivity/computed.js';
import { watchEffect as reactiveEffect } from '../effects/effect.js';
import {
	traceHookEffect,
	traceHookCleanup,
	traceHookDispose,
} from '../layers/tracing/hooks.js';
import {
	getActiveLifecycle,
	LifecycleError,
	reportLifecycleError,
} from '../blueprint/lifecycle.js';
import type {
	HookContext,
	HookScope,
	HookFinalizer,
	EffectCallback,
	HookEffectCallback,
} from './types.js';
import type { EffectHandle } from '../types/index.js';
import {
	resolveLayersAccessor,
	type LayerSource,
	type LayersAccessor,
} from '../layers/api/layersAccessor.js';

const createHookScope = (onDisposeStart: () => void): HookScope => {
	const finalizers: HookFinalizer[] = [];
	let disposal: Promise<void> | undefined;
	let disposalStarted = false;

	return {
		addFinalizer: (fn: HookFinalizer) => {
			if (disposalStarted) {
				throw new Error(
					'[Effuse] Cannot add a hook finalizer after disposal has started.'
				);
			}
			finalizers.push(fn);
		},
		dispose: () => {
			if (disposal) return disposal;
			disposalStarted = true;
			onDisposeStart();
			disposal = (async () => {
				const failures: unknown[] = [];
				for (const fn of [...finalizers].reverse()) {
					try {
						await fn();
					} catch (error) {
						failures.push(error);
					}
				}
				finalizers.length = 0;

				if (failures.length > 0) {
					throw new AggregateError(
						failures,
						`[Effuse] Hook scope disposal failed in ${String(failures.length)} finalizer${failures.length === 1 ? '' : 's'}.`
					);
				}
			})();
			return disposal;
		},
	};
};

export const reportHookCleanupError = (
	name: string,
	operation: 'disposal' | 'setup rollback',
	error: unknown
): void => {
	reportLifecycleError(
		new LifecycleError('cleanup', [
			{
				hook: 'unmount',
				error: new AggregateError(
					[error],
					`[Effuse] Hook "${name}" ${operation} failed.`
				),
			},
		])
	);
};

export const createHookContext = <C, L extends LayerSource = readonly never[]>(
	config: C,
	layers: L,
	hookName?: string
): {
	ctx: HookContext<C, L>;
	dispose: () => Promise<void>;
} => {
	const abortController = new AbortController();
	const scope = createHookScope(() => abortController.abort());
	const name = hookName ?? 'anonymous';
	let effectIndex = 0;
	const effectHandles: EffectHandle[] = [];
	let disposal: Promise<void> | undefined;

	const wrappedEffect = (fn: HookEffectCallback): EffectHandle => {
		const currentIndex = effectIndex++;
		const handle = reactiveEffect((onCleanup) => {
			const start = performance.now();
			const result = fn(onCleanup);
			const duration = performance.now() - start;

			traceHookEffect(name, currentIndex, duration);

			if (Predicate.isFunction(result)) {
				onCleanup(() => {
					traceHookCleanup(`${name}[${String(currentIndex)}]`);
					result();
				});
				return undefined;
			}

			return result;
		});
		effectHandles.push(handle);
		scope.addFinalizer(() => handle.stop());
		return handle;
	};

	const onMount = (fn: EffectCallback) => {
		const lifecycle = getActiveLifecycle();
		if (lifecycle) {
			lifecycle.onMount(() => fn());
			return;
		}
		const cleanup = fn();
		if (cleanup) scope.addFinalizer(cleanup);
	};

	const use = <R>(hook: () => R): R => hook();

	const runAsync = async <T>(
		fn: (signal: AbortSignal) => Promise<T>
	): Promise<T> => {
		abortController.signal.throwIfAborted();
		return fn(abortController.signal);
	};

	const dispose = (): Promise<void> => {
		if (disposal) return disposal;
		const start = performance.now();
		for (const handle of [...effectHandles].reverse()) {
			handle.stop();
		}
		disposal = scope.dispose().finally(() => {
			const duration = performance.now() - start;
			traceHookDispose(name, duration, effectHandles.length);
			effectHandles.length = 0;
		});
		return disposal;
	};

	const lifecycle = getActiveLifecycle();
	if (lifecycle) {
		lifecycle.onUnmount(() => {
			void dispose().catch((error: unknown) => {
				reportHookCleanupError(name, 'disposal', error);
			});
		});
	}

	const ctx: HookContext<C, L> = {
		config,
		signal,
		computed,
		watchEffect: wrappedEffect,
		onMount,
		onCleanup: scope.addFinalizer,
		abortSignal: abortController.signal,
		scope,
		layers: resolveLayersAccessor(layers) as LayersAccessor<L>,
		use,
		runAsync,
	};

	return { ctx, dispose };
};
