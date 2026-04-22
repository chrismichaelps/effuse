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

import { Array as Arr, Predicate } from 'effect';
import { computed } from '../reactivity/computed.js';
import { isSignal } from '../reactivity/signal.js';
import type { ReadonlySignal } from '../types/index.js';
import { getActiveLifecycle } from './lifecycle.js';
import { devWarn } from '../utils/dev-warnings.js';
import { getLayerService } from '../layers/context.js';
import type { CompiledLayer, EffuseLayer, EffuseServices } from '../layers/api/defineLayer.js';

const trackDependencies = (deps: unknown[] | undefined): void => {
	if (!Predicate.isNotNullable(deps)) return;
	Arr.forEach(deps, (d) => {
		if (isSignal(d)) {
			void (d as ReadonlySignal<unknown>).value;
		}
	});
};

const warnIfOutsideLifecycle = (hookName: string): void => {
	if (!getActiveLifecycle()) {
		devWarn(
			`${hookName}() called outside a component lifecycle. ` +
				`Hooks should only be called inside a script() function.`
		);
	}
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCallback<T extends (...args: any[]) => any>(
	fn: T,
	deps?: unknown[]
): T {
	warnIfOutsideLifecycle('useCallback');
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	return computed(() => {
		trackDependencies(deps);
		return fn;
	}).value as T;
}

export function useMemo<T>(fn: () => T, deps?: unknown[]): ReadonlySignal<T> {
	warnIfOutsideLifecycle('useMemo');
	const memoized = computed(() => {
		trackDependencies(deps);
		return fn();
	});
	return memoized;
}

/**
 * Typed helper to retrieve a service from a layer at runtime.
 *
 * The layer argument is used only for type inference — the actual lookup
 * uses the string key against the active layer registry.
 *
 * @example
 * ```ts
 * const auth = useLayerService(AuthLayer, 'authSvc');
 * ```
 */
export const useLayerService = <
	T extends EffuseLayer,
	K extends keyof EffuseServices<T>,
>(
	_layer: CompiledLayer<T, string>,
	key: K
): EffuseServices<T>[K] | undefined => {
	return getLayerService(key as string) as EffuseServices<T>[K] | undefined;
};
