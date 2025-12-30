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
	EffuseError,
	RenderError,
	SignalError,
	BlueprintError,
	MountError,
	EffectError,
	CleanupError,
	type EffuseErrors,
} from './errors/index.js';

export type {
	Signal,
	ReadonlySignal,
	EffectHandle,
	EffectOptions,
	WatchOptions,
	CleanupFn,
	OnCleanup,
} from './types/index.js';

export {
	signal,
	readonlySignal,
	isSignal,
	unref,
	getSignalRef,
	getSignalDep,
	reactive,
	isReactive,
	toRaw,
	markRaw,
	type Reactive,
	computed,
	writableComputed,
	readonly,
	isReadonly,
	shallowReadonly,
	type DeepReadonly,
} from './reactivity/index.js';

export {
	effect,
	effectOnce,
	watch,
	watchMultiple,
	type WatchSource,
	type WatchCallback,
} from './effects/index.js';

export {
	type EffuseNode,
	type EffuseChild,
	type ElementNode,
	type TextNode,
	type BlueprintNode,
	type FragmentNode,
	type ListNode,
	type Portals,
	type PortalFn,
	type BlueprintDef,
	type BlueprintContext,
	type Component,
	isEffuseNode,
	render,
	unmount,
	el,
	fragment,
	toNode,
	MountService,
	PropService,
	EventService,
	DOMRendererLive,
} from './render/index.js';

export { For, type ForProps, createDynamicListNode } from './components/For.js';

export {
	SUSPEND_TOKEN,
	type SuspendToken,
	createSuspendToken,
	isSuspendToken,
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
	SuspenseService,
	type SuspenseContext,
	type SuspenseApi,
	SuspenseLive,
	makeSuspenseLayer,
	suspenseApi,
	createResource,
	type Resource,
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
	type ListResource,
	createListResource,
	type MultiResource,
	createMultiResource,
	Suspense,
	type SuspenseProps,
} from './suspense/index.js';

export { EFFUSE_NODE, FRAGMENT, NodeType } from './constants.js';

export {
	blueprint,
	define,
	isBlueprint,
	instantiateBlueprint,
	view,
	type BlueprintOptions,
	type DefineOptions,
	type ScriptContext,
	type EffuseRegistry,
	setGlobalStoreGetter,
	setGlobalRouter,
	createComponentLifecycle,
	createComponentLifecycleSync,
	type ComponentLifecycle,
	PropSchema,
	PropsValidationError,
	type PropDefinition,
	type PropSchemaBuilder,
	type AnyPropSchemaBuilder,
	type PropSchemaInfer,
	PortalService,
	PortalServiceLive,
	Portal,
	createPortal,
	registerPortalOutlet,
	unregisterPortalOutlet,
	getPortalOutlet,
	renderToNamedPortal,
	setGlobalPortalService,
	getGlobalPortalService,
	type PortalServiceInterface,
	type PortalContainer,
} from './blueprint/index.js';

export {
	createVirtualRange,
	createAutoVirtualRange,
} from './utils/virtualize.js';
export { createDOMTransitions } from './utils/transitions.js';

export {
	canvas,
	canvasEffect,
	mount,
	mountEffect,
	type Canvas,
} from './canvas/index.js';

export {
	Renderer,
	CanvasService,
	BlueprintService,
	Scheduler,
	type RendererService,
	type CanvasServiceInterface,
	type BlueprintServiceInterface,
	type SchedulerService,
	SchedulerLive,
	BlueprintLive,
	EffuseLive,
	RouterService,
	makeRouterLayer,
	type RouterApi,
	StoreService,
	makeStoreLayer,
	type StoreApi,
} from './services/index.js';

export { jsx, jsxs, jsxDEV, Fragment } from './jsx/index.js';

export {
	defineLayer,
	combineLayers,
	resolveLayerOrder,
	mergeLayerConfigs,
	createLayerRuntime,
	type EffuseLayer,
	type ResolvedLayer,
	type RouteConfig,
	type StoreConfig,
	type Guard,
	type PluginFn,
	type PluginCleanup,
	type MaybePromise,
	type LayerRestriction,
	type MergedConfig,
	type CombinedLayerResult,
	type LayerProvides,
	type SetupContext,
	type LayerSetupFn,
	type LayerProps,
	type AnyLayer,
	type AnyResolvedLayer,
	type LayerRuntime,
	type LayerRuntimeOptions,
} from './layers/index.js';

export {
	createApp,
	EffuseApp,
	type AppInstance,
	type MountOptions,
} from './app/index.js';

export {
	createServerApp,
	type ServerApp,
	useHead,
	isServer,
	useSeoMeta,
	useServerSeoMeta,
	type SeoMetaInput,
	createHandler,
	type HandlerConfig,
	mergeHeadProps,
	headToHtml,
	mergeLayerHeads,
	getHydrationData,
	initHydration,
	checkHydrationMatch,
	HYDRATION_SCRIPT_ID,
	type HeadProps,
	type MetaTag,
	type LinkTag,
	type ScriptTag,
	type OpenGraphProps,
	type TwitterCardProps,
	type RenderResult,
	type SSRContext,
	type ServerAppOptions,
	type HydrationData,
	type SSRError,
} from './ssr/index.js';

export {
	getEffuseConfig,
	isDebugEnabled,
	isDevtoolsEnabled,
	isStrictMode,
	isSSRMode,
	type EffuseConfigType,
} from './config/index.js';

export {
	devtools,
	logReactivity,
	logRender,
	logRouter,
	logStore,
	logEffect,
	logLifecycle,
	logInk,
	logReactivityE,
	logRenderE,
	logRouterE,
	logStoreE,
	logEffectE,
	logLifecycleE,
	logInkE,
	DevTools,
	DevToolsLive,
	DevToolsConfig,
	loadDevToolsConfig,
	makeDevToolsService,
	LogLevelSchema,
	DevToolsCategorySchema,
	LogEntrySchema,
	DevToolsStateSchema,
	type DevToolsService,
	type DevToolsCategory,
	type LogLevel,
	type LogEntry,
	type DevToolsState,
	type DevToolsConfigType,
} from './devtools/index.js';

export {
	useForm,
	v,
	validateField,
	validateForm,
	hasErrors,
	type FormOptions,
	type FormValidators,
	type FieldValidator,
	type ValidationResult,
	type FormValidationOptions,
	type FormFields,
	type FormTouched,
	type FormErrors,
	type UseFormReturn,
	type BindResult,
} from './form/index.js';

export {
	DEFAULT_DEBOUNCE_MS,
	DEFAULT_THROTTLE_MS,
	type EmitHandler,
	type EmitEvents,
	type EventMap,
	type InferPayload,
	type EmitOptions,
	type EmitContextData,
	type EmitFn,
	type EmitFnAsync,
	type SubscribeFn,
	type EventSignal,
	useEmitService,
	getEmitService,
	type EmitServiceApi,
	useEmits,
	useEventSignal,
	createEventSignal,
	createDebounce,
	createThrottle,
	createOnce,
	createFilter,
	type FilterPredicate,
} from './emit/index.js';
