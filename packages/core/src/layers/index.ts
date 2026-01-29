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

export type {
	EffuseLayer,
	ResolvedLayer,
	RouteConfig,
	StoreConfig,
	Guard,
	PluginFn,
	PluginCleanup,
	CleanupFn,
	MaybePromise,
	LayerRestriction,
	MergedConfig,
	LayerProvides,
	LayerSetupFn,
	LayerProps,
	LayerDependency,
	SetupContext,
	LifecycleHook,
	ErrorHook,
	DepsRecord,
	AnyLayer,
	AnyResolvedLayer,
	EffuseLayerRegistry,
	LayerPropsOf,
	LayerProvidesOf,
} from './types.js';

export {
	PropsService,
	RegistryService,
	type PropsRegistry,
	type LayerRegistry,
	type LayerServices,
} from './services/index.js';

export {
	resolveLayerOrder,
	prefixRoutes,
	mergeLayerConfigs,
} from './utils/index.js';

export {
	defineLayer,
	combineLayers,
	type CombinedLayerResult,
} from './api/index.js';

export {
	createLayerRuntime,
	type LayerRuntime,
	type LayerRuntimeOptions,
} from './internal/index.js';

export {
	getLayerContext,
	getLayerService,
	isLayerRuntimeReady,
	type LayerContext,
	type TypedLayerContext,
} from './context.js';

export {
	LayerNotFoundError,
	LayerRuntimeNotReadyError,
	LayerRuntimeNotInitializedError,
	ServiceNotFoundError,
	DependencyNotFoundError,
	CircularDependencyError,
	RouterNotConfiguredError,
	type LayerError,
} from './errors.js';

export {
	TracingService,
	createTracingService,
	withTracing,
	getGlobalTracing,
	setGlobalTracing,
	clearGlobalTracing,
	type TracingConfig,
	type UseHooksCategories,
	defaultUseHooksCategories,
} from './tracing/index.js';
