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
	RESOURCE_ID_PREFIX,
	BOUNDARY_ID_PREFIX,
	DEFAULT_RETRY_TIMES,
	DEFAULT_RETRY_DELAY_MS,
	DEFAULT_EXPONENTIAL_RETRY,
	defaultResourceConfig,
	type ResourceDefaults,
	ResourceErrorMessages,
	type ResourceErrorMessage,
} from './config.js';

export {
	isEffect,
	promiseToEffect,
	toEffect as effectToEffect,
	generateResourceId,
	generateBoundaryId,
	resetIdCounters,
} from './utils.js';

export {
	SUSPEND_TOKEN,
	type SuspendToken,
	createSuspendToken,
	isSuspendToken,
} from './token.js';

export {
	ResourceStatusSchema,
	type ResourceStatus,
	RetryConfigSchema,
	type RetryConfig,
	ResourceOptionsSchema,
	type ResourceOptions,
	ResourceStateSchema,
	type ResourceState,
	createPendingState,
	createSuccessState,
	createErrorState,
} from './schema.js';

export {
	SuspenseService,
	type SuspenseContext,
	type SuspenseApi,
	SuspenseLive,
	makeSuspenseLayer,
	suspenseApi,
} from './service.js';

export { createResource, type Resource } from './resource.js';

export {
	type EffectFetcher,
	type PromiseFetcher,
	type Fetcher,
	isEffectFetcher,
	toEffect,
	withTimeout,
	withRetry,
	applyResourceOptions,
	fetchParallel,
	fetchSequential,
	fetchRace,
	fetchAllSettled,
} from './fetchers.js';

export {
	type SSRSuspenseState,
	initSSRSuspense,
	getSSRState,
	clearSSRState,
	serializeSSRData,
	hydrateSSRData,
	getHydratedData,
	waitForAllResources,
	collectSSRData,
	type SSRRenderResult,
	renderWithSuspense,
} from './ssr.js';

export {
	type ListResource,
	createListResource,
	type MultiResource,
	createMultiResource,
} from './list.js';

export { Suspense, type SuspenseProps } from './Suspense.js';
