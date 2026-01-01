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

export interface HookContext<
	C = unknown,
	D extends readonly string[] = readonly string[],
> {
	readonly config: C;
	readonly signal: <T>(initial: T) => Signal<T>;
	readonly computed: <T>(fn: () => T) => ReadonlySignal<T>;
	readonly effect: (fn: EffectCallback) => void;
	readonly onMount: (fn: EffectCallback) => void;
	readonly scope: HookScope;
	readonly layer: <K extends D[number] & keyof EffuseLayerRegistry>(
		name: K
	) => LayerPropsOf<K>;
	readonly layerProvider: <K extends D[number] & keyof EffuseLayerRegistry>(
		name: K
	) => LayerProvidesOf<K>;
	readonly use: <R>(hook: () => R) => R;
	readonly runAsync: <T>(fn: () => Promise<T>) => Promise<T>;
}

export type HookSetupFn<C, D extends readonly string[], R> = (
	ctx: HookContext<C, D>
) => R;

export interface HookDefinition<
	C = unknown,
	D extends readonly string[] = readonly string[],
	R = unknown,
> {
	readonly deps?: D;
	readonly setup: HookSetupFn<C, D, R>;
}

export type InferHookReturn<H> =
	H extends HookDefinition<unknown, readonly string[], infer R> ? R : never;

export type InferHookConfig<H> =
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	H extends HookDefinition<infer C, readonly string[], infer _R> ? C : never;
