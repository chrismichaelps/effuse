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
	TracingService,
	TracingServiceLive,
	createTracingService,
	withTracing,
	type TracingConfig,
	type TracingServiceApi,
} from './TracingService.js';

export { withLayerSpan, withRuntimeSpan, logDependencyGraph } from './spans.js';

export {
	type TracingCategory,
	type TracingCategories,
	defaultCategories,
	isCategoryEnabled,
} from './categories.js';

export {
	traceNavigation,
	traceGuard,
	traceRouteMatch,
	type RouterTraceData,
	type GuardTraceData,
} from './router.js';

export {
	traceComponentMount,
	traceComponentUnmount,
	traceComponentRender,
} from './components.js';

export {
	traceResourceLoading,
	traceResourceSuccess,
	traceResourceError,
	traceSuspenseBoundary,
	type ResourceStatus,
} from './suspense.js';

export { traceEffect, traceEffectCleanup, traceWatch } from './effects.js';

export { traceEmit, traceEmitSubscribe, traceEmitUnsubscribe } from './emit.js';

export {
	traceSignalCreate,
	traceSignalUpdate,
	traceComputedCreate,
} from './signals.js';

export {
	setGlobalTracing,
	getGlobalTracing,
	clearGlobalTracing,
} from './global.js';

export {
	traceFiberCreated,
	traceFiberDone,
	traceFiberInterrupted,
	traceFiberCount,
	traceFiberBuildPhase,
} from './fibers.js';

export {
	traceHookSetup,
	traceHookEffect,
	traceHookCleanup,
	traceHookDispose,
	traceHookMount,
} from './hooks.js';
