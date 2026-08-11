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

import type { EffuseNode, EffuseChild } from '../render/node.js';
import { createListNode } from '../render/node.js';
import { signal, type Signal } from '../reactivity/signal.js';
import { Option, Predicate } from 'effect';
import { attachErrorBoundaryController } from './error-boundary-runtime.js';

export interface ErrorBoundaryProps {
	fallback: EffuseChild | ((error: Error, reset: () => void) => EffuseChild);
	children: EffuseChild;
	onError?: (error: Error) => void;
}

type ErrorState = {
	error: Option.Option<Error>;
	revision: Signal<number>;
	notificationScheduled: boolean;
};

const createErrorState = (): ErrorState => ({
	error: Option.none(),
	revision: signal(0),
	notificationScheduled: false,
});

const getError = (state: ErrorState): Option.Option<Error> => {
	void state.revision.value;
	return state.error;
};

const setError = (state: ErrorState, error: Error, notify: boolean): void => {
	state.error = Option.some(error);
	if (!notify || state.notificationScheduled) return;

	state.notificationScheduled = true;
	queueMicrotask(() => {
		state.notificationScheduled = false;
		state.revision.value++;
	});
};

const clearError = (state: ErrorState): void => {
	state.error = Option.none();
	state.revision.value++;
};

const renderFallback = (
	fallback: EffuseChild | ((error: Error, reset: () => void) => EffuseChild),
	error: Error,
	reset: () => void
): EffuseChild =>
	Predicate.isFunction(fallback) ? fallback(error, reset) : fallback;

export const ErrorBoundary = (props: ErrorBoundaryProps): EffuseNode => {
	const { fallback, children, onError } = props;
	const state = createErrorState();

	const listNode = createListNode([]);
	attachErrorBoundaryController(listNode, {
		hasError: () => Option.isSome(state.error),
		capture: (error, notify) => {
			if (Predicate.isNotNullable(onError)) {
				onError(error);
			}
			setError(state, error, notify);
		},
	});

	const reset = () => {
		clearError(state);
	};

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			const errorOpt = getError(state);

			if (Option.isNone(errorOpt)) {
				return [children] as EffuseChild[];
			}

			return [renderFallback(fallback, errorOpt.value, reset)] as EffuseChild[];
		},
	});

	return listNode;
};
