import { Effect, Scope, Exit } from 'effect';
import { signal } from '../reactivity/signal.js';
import { computed } from '../reactivity/computed.js';
import { effect as reactiveEffect } from '../effects/effect.js';
import { getLayerContext, isLayerRuntimeReady } from '../layers/context.js';
import {
	traceHookEffect,
	traceHookCleanup,
	traceHookDispose,
} from '../layers/tracing/hooks.js';
import { HookLayerNotReadyError } from './errors.js';
import type {
	HookContext,
	HookCleanup,
	HookScope,
	HookFinalizer,
	EffectCallback,
} from './types.js';
import type {
	LayerPropsOf,
	LayerProvidesOf,
	EffuseLayerRegistry,
} from '../layers/types.js';

const createHookScope = (): { scope: HookScope } => {
	const internalScope = Effect.runSync(Scope.make());
	const finalizers: HookFinalizer[] = [];

	const scope: HookScope = {
		addFinalizer: (fn: HookFinalizer) => {
			finalizers.push(fn);
		},
		dispose: async () => {
			for (const fn of finalizers.reverse()) {
				await fn();
			}
			Effect.runSync(Scope.close(internalScope, Exit.void));
		},
	};

	return { scope };
};

export const createHookContext = <C>(
	config: C,
	hookName?: string
): {
	ctx: HookContext<C>;
	dispose: () => Promise<void>;
	mountCallbacks: EffectCallback[];
} => {
	const cleanups: HookCleanup[] = [];
	const mountCallbacks: EffectCallback[] = [];
	const { scope } = createHookScope();
	const name = hookName ?? 'anonymous';
	let effectIndex = 0;

	const wrappedEffect = (fn: EffectCallback) => {
		const currentIndex = effectIndex++;
		reactiveEffect(() => {
			const start = performance.now();
			const result = fn();
			const duration = performance.now() - start;

			traceHookEffect(name, currentIndex, duration);

			if (typeof result === 'function') {
				cleanups.push(() => {
					traceHookCleanup(`${name}[${String(currentIndex)}]`);
					result();
				});
			}
		});
	};

	const onMount = (fn: EffectCallback) => {
		mountCallbacks.push(fn);
	};

	const layer = <K extends keyof EffuseLayerRegistry>(
		name: K
	): LayerPropsOf<K> => {
		if (!isLayerRuntimeReady()) {
			throw new HookLayerNotReadyError({
				hookContext: 'layer',
				layerName: name as string,
			});
		}
		const layerCtx = getLayerContext(name as string);
		return layerCtx.props as LayerPropsOf<K>;
	};

	const layerProvider = <K extends keyof EffuseLayerRegistry>(
		name: K
	): LayerProvidesOf<K> => {
		if (!isLayerRuntimeReady()) {
			throw new HookLayerNotReadyError({
				hookContext: 'layerProvider',
				layerName: name as string,
			});
		}
		const layerCtx = getLayerContext(name as string);
		if (!layerCtx.provides) {
			return {} as LayerProvidesOf<K>;
		}
		const providers: Record<string, unknown> = {};
		for (const [key, factory] of Object.entries(layerCtx.provides)) {
			providers[key] = (factory as () => unknown)();
		}
		return providers as LayerProvidesOf<K>;
	};

	const use = <R>(hook: () => R): R => hook();

	const runAsync = async <T>(fn: () => Promise<T>): Promise<T> => fn();

	const dispose = async () => {
		const start = performance.now();
		const cleanupCount = cleanups.length;

		for (const cleanup of cleanups.reverse()) {
			cleanup();
		}
		await scope.dispose();

		const duration = performance.now() - start;
		traceHookDispose(name, duration, cleanupCount);
	};

	const ctx: HookContext<C> = {
		config,
		signal,
		computed,
		effect: wrappedEffect,
		onMount,
		scope,
		layer,
		layerProvider,
		use,
		runAsync,
	};

	return { ctx, dispose, mountCallbacks };
};
