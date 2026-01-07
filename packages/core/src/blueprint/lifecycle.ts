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

import { Effect, Exit, Scope } from 'effect';

export interface ComponentLifecycle {
	readonly scope: Scope.CloseableScope;
	readonly onMount: (fn: () => (() => void) | undefined) => void;
	readonly onUnmount: (fn: () => void) => void;
	readonly onBeforeMount: (fn: () => void) => void;
	readonly onBeforeUnmount: (fn: () => void) => void;
	readonly runMount: () => void;
	readonly runCleanup: () => Effect.Effect<void>;
}

interface LifecycleState {
	readonly beforeMountCallbacks: Array<() => void>;
	readonly mountCallbacks: Array<() => (() => void) | undefined>;
	readonly beforeUnmountCallbacks: Array<() => void>;
	readonly mountCleanups: Array<() => void>;
	mounted: boolean;
}

const createLifecycleFns = (
	scope: Scope.CloseableScope,
	state: LifecycleState
): Omit<ComponentLifecycle, 'scope'> => {
	const onBeforeMount = (fn: () => void): void => {
		if (!state.mounted) {
			state.beforeMountCallbacks.push(fn);
		}
	};

	const onMount = (fn: () => (() => void) | undefined): void => {
		if (state.mounted) {
			const cleanup = fn();
			if (cleanup) state.mountCleanups.push(cleanup);
		} else {
			state.mountCallbacks.push(fn);
		}
	};

	const onBeforeUnmount = (fn: () => void): void => {
		state.beforeUnmountCallbacks.push(fn);
	};

	const onUnmount = (fn: () => void): void => {
		Effect.runSync(Scope.addFinalizer(scope, Effect.sync(fn)));
	};

	const runMount = (): void => {
		if (state.mounted) return;

		for (const fn of state.beforeMountCallbacks) fn();
		state.beforeMountCallbacks.length = 0;

		state.mounted = true;

		for (const fn of state.mountCallbacks) {
			const cleanup = fn();
			if (cleanup) state.mountCleanups.push(cleanup);
		}
		state.mountCallbacks.length = 0;
	};

	const runCleanup = (): Effect.Effect<void> =>
		Effect.gen(function* () {
			for (const fn of state.beforeUnmountCallbacks) fn();
			state.beforeUnmountCallbacks.length = 0;

			for (const cleanup of state.mountCleanups) {
				if (typeof cleanup === 'function') {
					cleanup();
				}
			}
			state.mountCleanups.length = 0;

			yield* Scope.close(scope, Exit.void);
			state.mounted = false;
		});

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
	mounted: false,
});

export const createComponentLifecycleSync = (): ComponentLifecycle => {
	const scope = Effect.runSync(Scope.make());
	const state = createState();
	return { scope, ...createLifecycleFns(scope, state) };
};
