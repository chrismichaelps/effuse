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
import { createAsyncContextStorage } from '../utils/async-context.js';

export type LifecycleHook =
	| 'beforeMount'
	| 'mount'
	| 'beforeUnmount'
	| 'mountCleanup'
	| 'unmount';

export interface LifecycleFailure {
	readonly hook: LifecycleHook;
	readonly error: unknown;
}

export class LifecycleError extends AggregateError {
	readonly _tag = 'LifecycleError';
	readonly phase: 'mount' | 'cleanup';
	readonly failures: readonly LifecycleFailure[];

	constructor(
		phase: 'mount' | 'cleanup',
		failures: readonly LifecycleFailure[]
	) {
		super(
			failures.map((failure) => failure.error),
			`[Effuse] ${phase} lifecycle failed in ${failures.length} callback${failures.length === 1 ? '' : 's'}: ${failures.map((failure) => failure.hook).join(', ')}`
		);
		this.name = 'LifecycleError';
		this.phase = phase;
		this.failures = failures;
	}
}

export type LifecycleErrorHandler = (error: LifecycleError) => void;

const lifecycleErrorHandlers: Array<{
	readonly handler: LifecycleErrorHandler;
}> = [];

export const installLifecycleErrorHandler = (
	handler: LifecycleErrorHandler
): (() => void) => {
	const installation = { handler };
	lifecycleErrorHandlers.push(installation);
	let removed = false;
	return () => {
		if (removed) return;
		removed = true;
		const index = lifecycleErrorHandlers.indexOf(installation);
		if (index >= 0) lifecycleErrorHandlers.splice(index, 1);
	};
};

export const getCurrentLifecycleErrorHandler = ():
	| LifecycleErrorHandler
	| undefined => lifecycleErrorHandlers.at(-1)?.handler;

export const reportLifecycleError = (
	error: LifecycleError,
	handler: LifecycleErrorHandler | undefined = getCurrentLifecycleErrorHandler()
): void => {
	if (handler) {
		try {
			handler(error);
		} catch (handlerError) {
			// eslint-disable-next-line no-console -- Error handlers must not hide either failure.
			console.error(
				new AggregateError(
					[error, handlerError],
					'[Effuse] Lifecycle error handler failed while reporting a lifecycle error.'
				)
			);
		}
		return;
	}
	// eslint-disable-next-line no-console -- Lifecycle failures must remain visible without an app handler.
	console.error(error);
};

export interface ComponentLifecycle {
	readonly onMount: (fn: () => void | (() => void)) => void;
	readonly onUnmount: (fn: () => void) => void;
	readonly onBeforeMount: (fn: () => void) => void;
	readonly onBeforeUnmount: (fn: () => void) => void;
	readonly runMount: () => void;
	readonly runCleanup: () => void;
}

interface LifecycleState {
	readonly beforeMountCallbacks: Array<() => void>;
	readonly mountCallbacks: Array<() => void | (() => void)>;
	readonly beforeUnmountCallbacks: Array<() => void>;
	readonly mountCleanups: Array<() => void>;
	readonly unmountCallbacks: Array<() => void>;
	mounted: boolean;
	cleanedUp: boolean;
}

const runCallback = (
	hook: LifecycleHook,
	callback: () => void,
	failures: LifecycleFailure[]
): void => {
	try {
		callback();
	} catch (error) {
		failures.push({ hook, error });
	}
};

const createLifecycleFns = (state: LifecycleState): ComponentLifecycle => {
	const onBeforeMount = (fn: () => void): void => {
		if (!state.mounted && !state.cleanedUp) {
			state.beforeMountCallbacks.push(fn);
		}
	};

	const onMount = (fn: () => void | (() => void)): void => {
		if (state.mounted) {
			try {
				const cleanup = fn();
				if (cleanup) state.mountCleanups.push(cleanup);
			} catch (error) {
				throw new LifecycleError('mount', [{ hook: 'mount', error }]);
			}
		} else {
			state.mountCallbacks.push(fn);
		}
	};

	const onBeforeUnmount = (fn: () => void): void => {
		if (!state.cleanedUp) state.beforeUnmountCallbacks.push(fn);
	};

	const onUnmount = (fn: () => void): void => {
		if (!state.cleanedUp) state.unmountCallbacks.push(fn);
	};

	const runMount = (): void => {
		if (state.mounted || state.cleanedUp) return;
		const failures: LifecycleFailure[] = [];

		for (const fn of state.beforeMountCallbacks) {
			runCallback('beforeMount', fn, failures);
		}
		state.beforeMountCallbacks.length = 0;

		state.mounted = true;

		for (const fn of state.mountCallbacks) {
			try {
				const cleanup = fn();
				if (cleanup) state.mountCleanups.push(cleanup);
			} catch (error) {
				failures.push({ hook: 'mount', error });
			}
		}
		state.mountCallbacks.length = 0;
		if (failures.length > 0) throw new LifecycleError('mount', failures);
	};

	const runCleanup = (): void => {
		if (state.cleanedUp) return;
		const failures: LifecycleFailure[] = [];

		for (const fn of state.beforeUnmountCallbacks) {
			runCallback('beforeUnmount', fn, failures);
		}
		state.beforeUnmountCallbacks.length = 0;

		for (const cleanup of [...state.mountCleanups].reverse()) {
			if (Predicate.isFunction(cleanup)) {
				runCallback('mountCleanup', cleanup, failures);
			}
		}
		state.mountCleanups.length = 0;

		for (const fn of [...state.unmountCallbacks].reverse()) {
			runCallback('unmount', fn, failures);
		}
		state.unmountCallbacks.length = 0;
		state.mounted = false;
		state.cleanedUp = true;
		if (failures.length > 0) throw new LifecycleError('cleanup', failures);
	};

	return {
		onMount,
		onUnmount,
		onBeforeMount,
		onBeforeUnmount,
		runMount,
		runCleanup,
	};
};

const createState = (): LifecycleState => ({
	beforeMountCallbacks: [],
	mountCallbacks: [],
	beforeUnmountCallbacks: [],
	mountCleanups: [],
	unmountCallbacks: [],
	mounted: false,
	cleanedUp: false,
});

export const createComponentLifecycleSync = (): ComponentLifecycle => {
	const state = createState();
	return createLifecycleFns(state);
};

const activeLifecycleStorage = createAsyncContextStorage<ComponentLifecycle>();

export const getActiveLifecycle = (): ComponentLifecycle | null => {
	return activeLifecycleStorage.getStore() ?? null;
};

export const withActiveLifecycle = <T>(
	lifecycle: ComponentLifecycle,
	fn: () => T
): T => {
	return activeLifecycleStorage.run(lifecycle, fn);
};

export const runWithActiveLifecycle = <T>(fn: () => T): T => {
	const lifecycle = getActiveLifecycle();
	if (!lifecycle) {
		throw new Error(
			'No active lifecycle found. Call withActiveLifecycle first.'
		);
	}
	return fn();
};
