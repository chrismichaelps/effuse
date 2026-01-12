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

export { TaggedError, isTaggedError, hasTag } from './errors/index.js';

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
} from './render/index.js';

export {
	For,
	type ForProps,
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
	blueprint,
	define,
	isBlueprint,
	instantiateBlueprint,
	type BlueprintOptions,
	type DefineOptions,
	type DefineOptionsWithLayer,
	type ScriptContext,
	type LayerScriptContext,
	type LayerPropsFor,
	type EffuseRegistry,
	setGlobalStoreGetter,
	setGlobalRouter,
	createComponentLifecycleSync,
	type ComponentLifecycle,
	PropSchema,
	PropsValidationError,
	type PropDefinition,
	type PropSchemaBuilder,
	type AnyPropSchemaBuilder,
	type PropSchemaInfer,
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
} from './blueprint/index.js';

export {
	canvas,
	canvasEffect,
	mount,
	mountEffect,
	type Canvas,
} from './canvas/index.js';

export {
	defineHook,
	createHookContext,
	type HookContext,
	type HookDefinition,
	type HookSetupFn,
	type HookCleanup,
	type HookScope,
	type HookFinalizer,
	type InferHookReturn,
	type InferHookConfig,
} from './hooks/index.js';

export { type MountedNode } from './services/index.js';

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
	isStrictMode,
	isSSRMode,
	type EffuseConfigType,
} from './config/index.js';

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
	useContext,
	hasContextValue,
	isEffuseContext,
	ContextNotFoundError,
	type ContextOptions,
	type ProviderProps,
	type EffuseContext,
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
