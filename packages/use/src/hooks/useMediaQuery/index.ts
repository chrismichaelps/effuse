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

import { Option } from 'effect';
import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { CHANGE_EVENT } from './constants.js';
import { createMediaQuery, getInitialMatch } from './utils.js';
import {
	traceMediaQueryInit,
	traceMediaQueryChange,
	traceMediaQueryCleanup,
} from './telemetry.js';
import {
	type MediaQueryState,
	MediaQueryState as MQS,
	getMatches,
	isSupported as isSupportedState,
} from './state.js';

export {
	MediaQueryState,
	isMatched,
	isUnmatched,
	isUnavailable,
} from './state.js';
export { MediaQueryError } from './errors.js';

export interface UseMediaQueryConfig {
	readonly query: string;

	readonly initialValue?: boolean;
}

export interface UseMediaQueryReturn {
	readonly matches: ReadonlySignal<boolean>;

	readonly isSupported: boolean;
}

export const useMediaQuery = defineHook<
	UseMediaQueryConfig,
	UseMediaQueryReturn
>({
	name: 'useMediaQuery',
	setup: (ctx) => {
		const { query, initialValue = false } = ctx.config;

		const createInitialState = (): MediaQueryState => {
			if (!isClient()) {
				return initialValue ? MQS.Matched() : MQS.Unmatched();
			}

			const maybeMql = createMediaQuery(query);
			return Option.match(maybeMql, {
				onNone: () => MQS.Unavailable(),
				onSome: (mql) =>
					getInitialMatch(mql) ? MQS.Matched() : MQS.Unmatched(),
			});
		};

		const initialState = createInitialState();
		traceMediaQueryInit(query, getMatches(initialState));

		const internalState = ctx.signal<MediaQueryState>(initialState);

		const matches = ctx.computed(() => getMatches(internalState.value));

		ctx.effect(() => {
			if (!isClient()) return undefined;

			const maybeMql = createMediaQuery(query);

			return Option.match(maybeMql, {
				onNone: () => {
					internalState.value = MQS.Unavailable();
					return undefined;
				},
				onSome: (mql) => {
					internalState.value = mql.matches ? MQS.Matched() : MQS.Unmatched();

					const handler = (e: MediaQueryListEvent): void => {
						traceMediaQueryChange(query, e.matches);
						internalState.value = e.matches ? MQS.Matched() : MQS.Unmatched();
					};

					mql.addEventListener(CHANGE_EVENT, handler);

					return () => {
						traceMediaQueryCleanup(query);
						mql.removeEventListener(CHANGE_EVENT, handler);
					};
				},
			});
		});

		return {
			matches,
			get isSupported() {
				return isSupportedState(internalState.value);
			},
		};
	},
});
