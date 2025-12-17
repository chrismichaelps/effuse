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
	createStore,
	deriveFrom,
	serializeStores,
	hydrateStores,
	getConfig,
	StoreConfig,
	StoreConfigLive,
	loadStoreConfig,
	resetConfigCache,
	createAtomicState,
	createMiddlewareManager,
	type Store,
	type StoreState,
	type StoreContext,
	type StoreDefinition,
	type StoreOptions,
	type InferStoreState,
	type ActionContext,
	type Middleware,
	type CreateStoreOptions,
	type AtomicState,
	type MiddlewareManager,
} from './simple/index.js';

export {
	createSelector,
	pick,
	combineSelectors,
	shallowEqual,
	type Selector,
	type EqualityFn,
} from './simple/selectors.js';

export {
	connectDevTools,
	hasDevTools,
	devToolsMiddleware,
	createDevToolsMiddleware,
	disconnectDevTools,
	disconnectAllDevTools,
} from './simple/devtools.js';

export {
	type StorageAdapter,
	localStorageAdapter,
	sessionStorageAdapter,
	createMemoryAdapter,
	noopAdapter,
} from './simple/persistence.js';

export {
	getStore,
	hasStore,
	removeStore,
	clearStores,
	getStoreNames,
} from './registry/index.js';

import { getStore } from './registry/index.js';

export const installStore = (): (<T>(name: string) => T) => {
	return getStore as unknown as <T>(name: string) => T;
};
