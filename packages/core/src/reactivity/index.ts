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
	signal,
	readonlySignal,
	isSignal,
	unref,
	getSignalRef,
	getSignalDep,
} from './signal.js';

export {
	reactive,
	isReactive,
	toRaw,
	markRaw,
	type Reactive,
} from './reactive.js';

export { computed, writableComputed } from './computed.js';

export {
	readonly,
	isReadonly,
	shallowReadonly,
	type DeepReadonly,
} from './readonly.js';

export {
	Dep,
	batch,
	startBatch,
	endBatch,
	pauseTracking,
	resumeTracking,
	isTracking,
	untrack,
	startTracking,
	stopTracking,
	getTrackedDeps,
	getGlobalVersion,
	createScope,
	executeUpdates,
} from './dep.js';

export {
	findPropertyDescriptor,
	getPropertyWithPrivateFieldSupport,
	setPropertyWithPrivateFieldSupport,
	bindMethodToTarget,
	getCurrentValue,
	type PropertyLookupResult,
} from './proxy-utils.js';
