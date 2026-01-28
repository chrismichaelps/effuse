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

export {
	useWindowSize,
	WindowSizeError,
	type UseWindowSizeConfig,
	type UseWindowSizeReturn,
} from './hooks/useWindowSize/index.js';

export {
	useLocalStorage,
	LocalStorageError,
	type UseLocalStorageConfig,
	type UseLocalStorageReturn,
} from './hooks/useLocalStorage/index.js';

export {
	useEventListener,
	EventListenerError,
	type UseEventListenerConfig,
	type UseEventListenerReturn,
} from './hooks/useEventListener/index.js';

export {
	useMediaQuery,
	MediaQueryError,
	type UseMediaQueryConfig,
	type UseMediaQueryReturn,
} from './hooks/useMediaQuery/index.js';

export {
	useOnline,
	NetworkError,
	type UseOnlineConfig,
	type UseOnlineReturn,
} from './hooks/useOnline/index.js';

export {
	useInterval,
	IntervalError,
	type UseIntervalConfig,
	type UseIntervalReturn,
} from './hooks/useInterval/index.js';

export {
	useDebounce,
	DebounceError,
	type UseDebounceConfig,
	type UseDebounceReturn,
} from './hooks/useDebounce/index.js';

export { WindowSizeState } from './hooks/useWindowSize/state.js';
export { StorageState } from './hooks/useLocalStorage/state.js';
export { ListenerState } from './hooks/useEventListener/state.js';
export { MediaQueryState } from './hooks/useMediaQuery/state.js';
export { NetworkState } from './hooks/useOnline/state.js';
export { IntervalState } from './hooks/useInterval/state.js';
export { DebounceState } from './hooks/useDebounce/state.js';

export type {
	Cleanup,
	MaybeGetter,
	MaybeSignal,
	WindowSize,
	ElementRect,
	IntersectionState,
} from './internal/types.js';

export { isClient, isServer, noop } from './internal/utils.js';

export {
	DEFAULT_DEBOUNCE_MS,
	DEFAULT_THROTTLE_MS,
	DEFAULT_INTERVAL_MS,
	DEFAULT_TIMEOUT_MS,
} from './internal/constants.js';

export { BREAKPOINTS } from './hooks/useMediaQuery/constants.js';

export {
	configureUseHooksTracing,
	isUseHookEnabled,
	resetUseHooksTracing,
	type UseHooksCategories,
	type UseHooksCategory,
} from './internal/telemetry.js';
