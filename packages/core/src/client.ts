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
	watchEffect,
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
	CreateElementNode,
	CreateTextNode,
	CreateFragmentNode,
	CreateListNode,
	CreateBlueprintNode,
	matchEffuseNode,
	render,
	unmount,
	el,
	fragment,
	toNode,
} from './render/index.js';

export {
	For,
	type ForProps,
	View,
	type ViewProps,
	Show,
	type ShowProps,
	Switch,
	type SwitchProps,
	Dynamic,
	type DynamicProps,
	ErrorBoundary,
	type ErrorBoundaryProps,
	Repeat,
	type RepeatProps,
	Await,
	type AwaitProps,
} from './components/index.js';

export { Suspense, type SuspenseProps } from './suspense/index.js';

export { EFFUSE_NODE, FRAGMENT, NodeType } from './constants.js';

export {
	StoreGetterNotConfiguredError,
	StoreNotFoundError,
} from './errors/index.js';

export {
	blueprint,
	define,
	defineProps,
	isBlueprint,
	instantiateBlueprint,
	type BlueprintOptions,
	type DefineOptions,
	type DefineOptionsWithDeclaredProps,
	type DefineOptionsWithInferredProps,
	type DefinePropsDeclaration,
	type TemplateContext,
	type ScriptContext,
	type EffuseRegistry,
	setGlobalStoreGetter,
	clearGlobalStoreGetter,
	setGlobalRouter,
	clearGlobalRouter,
	getConfiguredRouter,
	runWithRouterContext,
	createComponentLifecycleSync,
	LifecycleError,
	type ComponentLifecycle,
	type LifecycleErrorHandler,
	type LifecycleFailure,
	type LifecycleHook,
	PropSchema,
	PropsValidationError,
	PropsSchemaConflictError,
	type PropDefinition,
	type PropValueSchema,
	type PropSchemaBuilder,
	type AnyPropSchemaBuilder,
	type PropSchemaInfer,
	type PropSchemaInput,
	type PropSchemaOutput,
	Portal,
	PortalOutlet,
	createPortal,
	registerPortalOutlet,
	unregisterPortalOutlet,
	getPortalOutlet,
	renderToNamedPortal,
	type PortalContainer,
	type PortalProps,
	type PortalInsertMode,
	type PortalPriority,
	PORTAL_PRIORITY,
	useLayerService,
	provide,
	inject,
	createProvideScope,
	runWithProvideScope,
	getCurrentProvideScope,
	type ProvideScope,
} from './blueprint/index.js';

export { canvas, mount, hydrate, type Canvas } from './canvas/index.js';

export {
	defineHook,
	createHookContext,
	useId,
	useLocalStorage,
	useSessionStorage,
	useOnClickOutside,
	useResizeObserver,
	useIntersectionObserver,
	type HookContext,
	type HookDefinition,
	type HookSetupFn,
	type HookFunction,
	type HookCleanup,
	type HookScope,
	type HookFinalizer,
	type EffectCallback,
	type HookEffectCallback,
	type InferHookReturn,
	type InferHookConfig,
	type StorageOptions,
	type StorageHookResult,
	type ClickOutsideOptions,
	type ResizeObserverResult,
	type ResizeObserverSignal,
	type IntersectionObserverResult,
	type IntersectionObserverSignal,
} from './hooks/index.js';

export { type MountedNode } from './services/index.js';

export { jsx, jsxs, jsxDEV, Fragment } from './jsx/index.js';

export {
	defineLayer,
	layerService,
	type EffuseServices,
	type CompiledLayer,
	type LayerFactory,
	type LayerFactoryContext,
	type LayerInput,
	type LayerInputSource,
	layerInputSourceToList,
	isCompiledLayer,
	compileLayer,
	resolveLayerDefinitions,
	combineLayers,
	type MergeServices,
	resolveLayerEntry,
	resolveLayersAccessor,
	type LayersAccessor,
	type LayerEntry,
	type LayerEntryFrom,
	type LayerList,
	type LayerAliases,
	type LayerSource,
	layerSourceToList,
	resolveLayerOrder,
	mergeLayerConfigs,
	createLayerRuntime,
	getGlobalTracing,
	setGlobalTracing,
	clearGlobalTracing,
	createTracingService,
	defaultUseHooksCategories,
	type UseHooksCategories,
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
	type LayerProvides,
	type LayerServiceFactory,
	type LayerServiceFactoryContext,
	type HttpMethod,
	type ServerResult,
	type ServerRuntimeHint,
	type ServerCacheMetadata,
	type ServerCorsMetadata,
	type ServerLayerDiagnostic,
	type ServerLayerDiagnosticCode,
	type ServerRouteMetadata,
	type ServerResponseHelpers,
	type ServerLayerContext,
	type ServerHandler,
	type ServerMiddleware,
	type ServerMiddlewareNext,
	type ServerMethodHandlers,
	type ServerRoute,
	type ServerRouteDefinition,
	type ServerRouteInput,
	type ServerActionDefinition,
	type ServerActionInput,
	type ServerLayerConfig,
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
	type AppLayerInput,
	type LazyAppLayerInput,
	type AppLayerSource,
	type AppOptions,
} from './app/client.js';

export { EFFUSE_ACTION_PREFIX } from './ssr/constants.js';

export { updateClientHead as useHead } from './ssr/client-head.js';
export {
	type HeadProps,
	type LinkTag,
	type MetaTag,
	type OpenGraphProps,
	type ScriptTag,
	type TwitterCardProps,
} from './ssr/types.js';

export {
	getLayerServerActionEntries,
	getLayerServerDiagnostics,
	getLayerServerMiddleware,
	getLayerServerRouteEntries,
	mergeServerRouteMetadata,
	normalizeServerActionInput,
	normalizeServerRouteInput,
	type LayerServerActionEntry,
	type LayerServerRouteEntry,
	type LayerServerRouteSource,
	type ServerMetadataDiagnostic,
} from './ssr/server-routes.js';

export {
	callLayerAction,
	createLayerActionClient,
	createLayerActionPath,
	createLayerActionUrl,
	isLayerActionError,
	isLayerActionErrorBody,
	LayerActionError,
	type LayerActionCallOptions,
	type LayerActionClient,
	type LayerActionErrorBody,
	type LayerActionName,
	type LayerActionResponseMode,
	type LayerActionResult,
	type LayerActionsFrom,
} from './ssr/actions.js';

export {
	createLayerServerManifest,
	createLayerServerManifestFromLayers,
	type LayerServerManifest,
	type LayerServerManifestAction,
	type LayerServerManifestLayer,
	type LayerServerManifestRoute,
} from './ssr/manifest.js';

export {
	callLayerManifestAction,
	callLayerManifestRoute,
	createLayerRoutePath,
	createLayerRouteUrl,
	createLayerServerManifestClient,
	generateLayerServerClientModule,
	getLayerClientErrorBody,
	getLayerClientErrorStatus,
	isLayerClientError,
	LayerServerClientError,
	type GenerateLayerServerClientModuleOptions,
	type LayerClientError,
	type LayerRouteCallOptions,
	type LayerRoutePathOptions,
	type LayerServerManifestClient,
	type ManifestActionForLayer,
	type ManifestActionName,
	type ManifestLayerName,
	type ManifestRouteForPath,
	type ManifestRouteMethod,
	type ManifestRouteParams,
	type ManifestRoutePath,
} from './ssr/client.js';

export {
	defineServerFileHandler,
	type ServerFileContractContext,
	type ServerFileContext,
	type ServerFileHandler,
	type ServerFileHandlerContracts,
	type ServerRouteParams,
} from './ssr/server-files.js';

export {
	createLayerServerErrorBody,
	isLayerServerError,
	isLayerServerErrorBody,
	LayerServerError,
	layerServerErrorResponse,
	type LayerServerErrorBody,
	type LayerServerErrorOptions,
} from './ssr/server-errors.js';

export {
	createServerValidationErrorBody,
	createServerValidationHelpers,
	isServerValidationErrorBody,
	isServerValidationError,
	serverValidationErrorResponse,
	ServerValidationError,
	validateServerValue,
	type ServerValidationErrorBody,
	type ServerValidationFailure,
	type ServerValidationHelpers,
	type ServerValidationIssue,
	type ServerValidationResult,
	type ServerValidationSource,
	type ServerValidationSuccess,
	type ServerValidator,
} from './ssr/validation.js';

export {
	createServerTraceError,
	emitServerTrace,
	type ServerObservabilityHooks,
	type ServerTraceError,
	type ServerTraceEvent,
	type ServerTraceKind,
} from './ssr/observability.js';

export {
	getHydrationData,
	initHydration,
	checkHydrationMatch,
	applyHydratedHead,
	cleanupHydrationScript,
	serializeHydrationData,
	HYDRATION_SCRIPT_ID,
	type HydrationData,
} from './ssr/hydration.js';

export {
	getEffuseConfig,
	isDebugEnabled,
	isStrictMode,
	isSSRMode,
	type EffuseConfigType,
} from './config/index.js';

export {
	registerComponent,
	acceptComponentUpdate,
	hmr,
	type HMRInstance,
} from './hmr/index.js';

export { runtime as hmrRuntime } from './hmr/global.js';

export * from './routing/index.js';

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

export {
	createContext,
	createTypedContext,
	createRuntimeContext,
	useContext,
	hasContextValue,
	isEffuseContext,
	ContextNotFoundError,
	type ContextOptions,
	type ProviderProps,
	type EffuseContext,
	type TypedContext,
	type TypedContextOptions,
	type RuntimeContext,
} from './context/index.js';
export {
	createRef,
	isRefObject,
	isRefCallback,
	applyRef,
	registerDirective,
	getDirective,
	hasDirective,
	unregisterDirective,
	applyDirective,
	getDirectiveNames,
	RefNotAttachedError,
	DirectiveError,
	type RefCallback,
	type RefObject,
	type Ref,
	type Directive,
	type RefOptions,
} from './refs/index.js';

export {
	defineServerRequest,
	type ServerRequestContract,
	type ServerRequestDefinition,
	type ServerRequestOutput,
} from './ssr/request-contract.js';

export {
	defineServerRoute,
	type AnyTypedServerRoute,
	type ServerContractRouteInput,
	type TypedServerRoute,
} from './ssr/route-contract.js';

export {
	createTypedRouteClient,
	isRouteError,
	type TypedRouteCallOptions,
	type TypedRouteCaller,
	type TypedRouteClient,
	type TypedRouteClientOptions,
	type TypedRouteError,
	type TypedRouteInput,
	type TypedRouteResult,
} from './ssr/typed-route-client.js';

export {
	streamResponse,
	isStreamResponse,
	type ServerStreamResponse,
} from './ssr/response-contract.js';

export {
	generateOpenApiDocument,
	type OpenApiDocument,
	type OpenApiInfo,
} from './ssr/openapi.js';

export {
	serverSchema,
	type ServerOptionalSchema,
	type ServerSchemaInfer,
	type ServerSchemaInput,
	type ServerSchemaOutput,
} from './ssr/server-schema.js';
