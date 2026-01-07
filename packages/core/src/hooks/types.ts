import type { Signal, ReadonlySignal } from '../types/index.js';
import type {
	LayerPropsOf,
	LayerProvidesOf,
	EffuseLayerRegistry,
} from '../layers/types.js';

export type HookCleanup = () => void;

export type HookFinalizer = () => void | Promise<void>;

export type EffectCallback = () => HookCleanup | undefined;

export interface HookScope {
	addFinalizer: (fn: HookFinalizer) => void;
	dispose: () => Promise<void>;
}

export interface HookContext<C = unknown> {
	readonly config: C;
	readonly signal: <T>(initial: T) => Signal<T>;
	readonly computed: <T>(fn: () => T) => ReadonlySignal<T>;
	readonly effect: (fn: EffectCallback) => void;
	readonly onMount: (fn: EffectCallback) => void;
	readonly scope: HookScope;
	readonly layer: <K extends keyof EffuseLayerRegistry>(
		name: K
	) => LayerPropsOf<K>;
	readonly layerProvider: <K extends keyof EffuseLayerRegistry>(
		name: K
	) => LayerProvidesOf<K>;
	readonly use: <R>(hook: () => R) => R;
	readonly runAsync: <T>(fn: () => Promise<T>) => Promise<T>;
}

export type HookSetupFn<C, R> = (ctx: HookContext<C>) => R;

export interface HookDefinition<C = unknown, R = unknown> {
	readonly deps?: readonly string[];
	readonly setup: HookSetupFn<C, R>;
}

export type InferHookReturn<H> =
	H extends HookDefinition<unknown, infer R> ? R : never;

export type InferHookConfig<H> =
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	H extends HookDefinition<infer C, infer _R> ? C : never;
