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
	type StoreServiceApi,
	type ScopeServiceApi,
} from './services/store.js';

export {
	PersistenceService,
	LocalStoragePersistenceLive,
	SessionStoragePersistenceLive,
	MemoryPersistenceLive,
	NoopPersistenceLive,
	makePersistenceLayer,
	usePersistence,
	runWithPersistence,
	type PersistenceServiceApi,
} from './services/persistence.js';

export {
	ValidationService,
	ValidationServiceLive,
	ValidationError,
	useValidation,
	runWithValidation,
	type ValidationServiceApi,
} from './services/validation.js';

export {
	type StorageAdapter,
	localStorageAdapter,
	sessionStorageAdapter,
	createMemoryAdapter,
	noopAdapter,
	runAdapter,
	raceAdapters,
} from './persistence/adapters.js';

export {
	loadStoreConfigValues,
	StoreConfigOptions,
	DEFAULT_TIMEOUT,
} from './config/constants.js';

export {
	raceAll,
	forkInterruptible,
	createDeferred,
	createAtomicRef,
	runWithAbortSignal,
} from './actions/cancellation.js';

export { createAtomicStateWithEffect } from './core/state.js';
