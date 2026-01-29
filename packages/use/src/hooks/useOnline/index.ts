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

import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { ONLINE_EVENT, OFFLINE_EVENT } from './constants.js';
import { getOnlineStatus } from './utils.js';
import {
	traceOnlineInit,
	traceOnlineChange,
	traceOnlineCleanup,
} from './telemetry.js';
import {
	type NetworkState,
	NetworkState as NS,
	getIsOnline,
	getIsOffline,
} from './state.js';

export { NetworkState, isOnline, isOffline, isUnknown } from './state.js';
export { NetworkError } from './errors.js';

export interface UseOnlineConfig {
	readonly initialValue?: boolean;
}

export interface UseOnlineReturn {
	readonly isOnline: ReadonlySignal<boolean>;

	readonly isOffline: ReadonlySignal<boolean>;
}

export const useOnline = defineHook<
	UseOnlineConfig | undefined,
	UseOnlineReturn
>({
	name: 'useOnline',
	setup: (ctx) => {
		const config = ctx.config ?? {};
		const initialValue = config.initialValue ?? true;

		const createInitialState = (): NetworkState => {
			if (!isClient()) {
				return initialValue ? NS.Online() : NS.Offline();
			}
			return getOnlineStatus() ? NS.Online() : NS.Offline();
		};

		const initialState = createInitialState();
		const internalState = ctx.signal<NetworkState>(initialState);

		traceOnlineInit(getIsOnline(initialState));

		const online = ctx.computed(() => getIsOnline(internalState.value));
		const offline = ctx.computed(() => getIsOffline(internalState.value));

		ctx.effect(() => {
			if (!isClient()) return undefined;

			const handleOnline = (): void => {
				traceOnlineChange(true);
				internalState.value = NS.Online();
			};

			const handleOffline = (): void => {
				traceOnlineChange(false);
				internalState.value = NS.Offline();
			};

			window.addEventListener(ONLINE_EVENT, handleOnline);
			window.addEventListener(OFFLINE_EVENT, handleOffline);

			return () => {
				traceOnlineCleanup();
				window.removeEventListener(ONLINE_EVENT, handleOnline);
				window.removeEventListener(OFFLINE_EVENT, handleOffline);
			};
		});

		return {
			isOnline: online,
			isOffline: offline,
		};
	},
});
