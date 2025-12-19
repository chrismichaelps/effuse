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
	createAtomicState,
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
} from './core/index.js';

export {
	getStoreConfig,
	resetStoreConfigCache,
	loadStoreConfigValues,
	StoreConstants,
	StoreConfigOptions,
	STORAGE_PREFIX,
	ROOT_SCOPE_ID,
	SCOPE_PREFIX,
	type StoreConfigValues,
} from './config/index.js';

export {
	createScope,
	disposeScope,
	enterScope,
	exitScope,
	getCurrentScope,
	getRootScope,
	registerScopedStore,
	getScopedStore,
	hasScopedStore,
	runInScope,
	withScope,
	type ScopeNode,
	type ScopeId,
} from './context/index.js';

export {
	createAsyncAction,
	dispatch,
	dispatchSync,
	type ActionResult,
	type AsyncAction,
} from './actions/index.js';

export {
	validateState,
	createValidatedSetter,
	createFieldValidator,
	createSafeFieldSetter,
	type StateSchema,
	type ValidationResult,
} from './validation/index.js';

export {
	composeStores,
	defineSlice,
	mergeStores,
	type ComposedStore,
	type StoreSlice,
} from './composition/index.js';

export {
	deriveFrom,
	serializeStores,
	hydrateStores,
	hydrateStoresSync,
	createStoreStream,
	streamAll,
	createSelector,
	pick,
	combineSelectors,
	shallowEqual,
	type StoreStream,
	type Selector,
	type EqualityFn,
} from './reactivity/index.js';

export {
	createMiddlewareManager,
	type MiddlewareManager,
} from './middleware/index.js';

export {
	connectDevTools,
	hasDevTools,
	devToolsMiddleware,
	createDevToolsMiddleware,
	disconnectDevTools,
	disconnectAllDevTools,
} from './devtools/index.js';

export {
	type StorageAdapter,
	localStorageAdapter,
	sessionStorageAdapter,
	createMemoryAdapter,
	noopAdapter,
	runAdapter,
} from './persistence/index.js';

export {
	getStore,
	hasStore,
	removeStore,
	clearStores,
	getStoreNames,
} from './registry/index.js';

export {
	StoreService,
	StoreServiceLive,
	ScopeService,
	ScopeServiceLive,
	AllServicesLive,
	useStoreService,
	useScopeService,
	runWithStore,
	runWithScope,
	runWithAllServices,
	StoreNotFoundError,
	StoreAlreadyExistsError,
	PersistenceService,
	LocalStoragePersistenceLive,
	SessionStoragePersistenceLive,
	MemoryPersistenceLive,
	NoopPersistenceLive,
	makePersistenceLayer,
	usePersistence,
	runWithPersistence,
	ValidationService,
	ValidationServiceLive,
	ValidationError,
	useValidation,
	runWithValidation,
	type StoreServiceApi,
	type ScopeServiceApi,
	type PersistenceServiceApi,
	type ValidationServiceApi,
} from './services/index.js';

import { getStore } from './registry/index.js';

export const installStore = (): ((name: string) => unknown) => {
	return getStore;
};
