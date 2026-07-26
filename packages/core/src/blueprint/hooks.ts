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

import { computed, disposeComputed } from '../reactivity/computed.js';
import { isSignal } from '../reactivity/signal.js';
import { untrack } from '../reactivity/dep.js';
import type { ReadonlySignal } from '../types/index.js';
import { getActiveLifecycle } from './lifecycle.js';
import { devWarn } from '../utils/dev-warnings.js';
import type {
	CompiledLayer,
	EffuseServices,
} from '../layers/api/defineLayer.js';
import { resolveLayerService } from '../layers/api/layersAccessor.js';
import type { EffuseLayer } from '../layers/types.js';

export type MemoDependencies = readonly ReadonlySignal<unknown>[];

const warnIfOutsideLifecycle = (hookName: string): void => {
	if (!getActiveLifecycle()) {
		devWarn(
			`${hookName}() called outside a component lifecycle. ` +
				`Hooks should only be called inside a script() function.`
		);
	}
};

/** @deprecated Effuse scripts run once; declare a plain closure instead. */
export function useCallback<T extends (...args: never[]) => unknown>(
	fn: T,
	_deps?: readonly unknown[]
): T {
	warnIfOutsideLifecycle('useCallback');
	devWarn(
		'useCallback() is unnecessary because script() runs once per component instance. ' +
			'Use a plain closure; dependency arguments are ignored.'
	);
	return fn;
}

export function useMemo<T>(
	fn: () => T,
	deps?: MemoDependencies
): ReadonlySignal<T> {
	warnIfOutsideLifecycle('useMemo');
	const lifecycle = getActiveLifecycle();
	const invalidDependencies = (deps as readonly unknown[] | undefined)?.filter(
		(dependency) => !isSignal(dependency)
	);
	if (invalidDependencies && invalidDependencies.length > 0) {
		devWarn(
			`useMemo() ignored ${invalidDependencies.length} non-signal ${
				invalidDependencies.length === 1 ? 'dependency' : 'dependencies'
			}. Pass signals, omit the dependency list for automatic tracking, or use computed().`
		);
	}
	const signalDependencies = (deps as readonly unknown[] | undefined)?.filter(
		isSignal
	) as MemoDependencies | undefined;
	const memoized = computed(() => {
		if (signalDependencies === undefined) return fn();
		for (const dependency of signalDependencies) void dependency.value;
		return untrack(fn);
	});
	lifecycle?.onUnmount(() => disposeComputed(memoized));
	return memoized;
}

/**
 * Typed helper to retrieve a service from a layer at runtime.
 *
 * The layer argument constrains the service key at type level and runtime.
 *
 * @example
 * ```ts
 * const auth = useLayerService(AuthLayer, 'authSvc');
 * ```
 */
export const useLayerService = <
	T extends EffuseLayer,
	K extends Extract<keyof EffuseServices<T>, string>,
>(
	layer: CompiledLayer<T, string>,
	key: K
): EffuseServices<T>[K] => {
	return resolveLayerService(layer, key) as EffuseServices<T>[K];
};
