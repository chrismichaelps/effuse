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

import { Layer, Effect, Context, Scope } from 'effect';
import type {
	AnyLayer,
	AnyResolvedLayer,
	EffuseLayer,
	LayerProvides,
	ServerLayerConfig,
	ServerHandler,
	ServerMethodHandlers,
	ServerRoute,
} from '../types.js';
import { resolveLayerOrder } from '../utils/index.js';

const TAG_NS = 'effuse/layer/';

type ResultOf<T> = T extends () => infer R ? R : never;

type NonEmptyLayerProvides<T> = [NonNullable<T>] extends [never]
	? {}
	: NonNullable<T> extends LayerProvides
		? NonNullable<T>
		: {};

type ProvidesOf<T> = T extends { readonly provides?: infer P }
	? NonEmptyLayerProvides<P>
	: {};

type ServicesOf<T> = T extends { readonly services?: infer P }
	? NonEmptyLayerProvides<P>
	: {};

type ProvidersFor<T> = ProvidesOf<T> & ServicesOf<T>;

export type EffuseServices<T extends EffuseLayer> =
	ProvidersFor<T> extends infer P extends LayerProvides
		? { [K in keyof P]: ResultOf<P[K]> }
		: {};

type DefinitionProviders<
	Provides extends LayerProvides | undefined,
	Services extends LayerProvides | undefined,
> = (Services extends LayerProvides ? Services : {}) &
	(Provides extends LayerProvides ? Provides : {});

type DefinitionServices<
	Provides extends LayerProvides | undefined,
	Services extends LayerProvides | undefined,
> =
	DefinitionProviders<Provides, Services> extends infer P extends LayerProvides
		? { [K in keyof P]: ResultOf<P[K]> }
		: {};

type LayerDefinitionBase = Omit<
	EffuseLayer,
	'name' | 'server' | 'provides' | 'services'
>;

type LayerDefinitionBody<
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
> = T & {
	readonly provides?: Provides;
	readonly services?: Services;
	readonly server?: ServerLayerConfig<DefinitionServices<Provides, Services>>;
};

type NamedLayerDefinition<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
> = {
	readonly name: N;
} & LayerDefinitionBody<T, Provides, Services>;

type ConcreteLayerDefinition<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined,
	Services extends LayerProvides | undefined,
> = NamedLayerDefinition<N, T, Provides, Services> & EffuseLayer;

export interface LayerFactoryContext<N extends string> {
	readonly name: N;
	service: <T>(factory: () => T) => () => T;
	route: <S extends Record<string, unknown> = Record<string, unknown>>(
		path: string,
		methods: ServerMethodHandlers<S> | ServerHandler<S>
	) => ServerRoute<S>;
	action: <S extends Record<string, unknown> = Record<string, unknown>>(
		handler: ServerHandler<S>
	) => ServerHandler<S>;
}

export type LayerFactory<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
> = (ctx: LayerFactoryContext<N>) => LayerDefinitionBody<T, Provides, Services>;

export interface CompiledLayer<
	T extends EffuseLayer,
	N extends string = string,
> extends EffuseLayer {
	readonly name: N;
	readonly effectLayer: Layer.Layer<EffuseServices<T>, never, Scope.Scope>;
	readonly tags: {
		readonly [K in keyof EffuseServices<T>]: Context.Tag<
			string,
			EffuseServices<T>[K]
		>;
	};
	readonly serviceKeys: readonly string[];
	readonly _resolved: true;
}

const createLayerFactoryContext = <N extends string>(
	name: N
): LayerFactoryContext<N> => ({
	name,
	service: (factory) => factory,
	route: (path, methods) => ({
		path,
		methods: typeof methods === 'function' ? { GET: methods } : methods,
	}),
	action: (handler) => handler,
});

const resolveDefinition = <
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined,
	Services extends LayerProvides | undefined,
>(
	nameOrDefinition: NamedLayerDefinition<N, T, Provides, Services> | N,
	definitionOrFactory?:
		| LayerDefinitionBody<T, Provides, Services>
		| LayerFactory<N, T, Provides, Services>
): NamedLayerDefinition<N, T, Provides, Services> => {
	if (typeof nameOrDefinition !== 'string') {
		return nameOrDefinition;
	}

	const fragment =
		typeof definitionOrFactory === 'function'
			? definitionOrFactory(createLayerFactoryContext(nameOrDefinition))
			: (definitionOrFactory ?? ({} as T));

	return {
		...fragment,
		name: nameOrDefinition,
	};
};

const normalizeProvides = (definition: {
	readonly services?: LayerProvides;
	readonly provides?: LayerProvides;
}): LayerProvides => ({
	...(definition.services ?? {}),
	...(definition.provides ?? {}),
});

export function defineLayer<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
>(
	definition: NamedLayerDefinition<N, T, Provides, Services>
): CompiledLayer<
	ConcreteLayerDefinition<N, T, Provides, Services>,
	N
>;
export function defineLayer<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
>(
	name: N,
	definition: LayerDefinitionBody<T, Provides, Services>
): CompiledLayer<
	ConcreteLayerDefinition<N, T, Provides, Services>,
	N
>;
export function defineLayer<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
>(
	name: N,
	factory: LayerFactory<N, T, Provides, Services>
): CompiledLayer<
	ConcreteLayerDefinition<N, T, Provides, Services>,
	N
>;
export function defineLayer<
	N extends string,
	T extends LayerDefinitionBase,
	Provides extends LayerProvides | undefined = undefined,
	Services extends LayerProvides | undefined = undefined,
>(
	nameOrDefinition: NamedLayerDefinition<N, T, Provides, Services> | N,
	definitionOrFactory?:
		| LayerDefinitionBody<T, Provides, Services>
		| LayerFactory<N, T, Provides, Services>
): CompiledLayer<
	ConcreteLayerDefinition<N, T, Provides, Services>,
	N
> {
	const definition = resolveDefinition(nameOrDefinition, definitionOrFactory);
	const provides = normalizeProvides(definition);
	const def = {
		...definition,
		provides,
	} as unknown as ConcreteLayerDefinition<N, T, Provides, Services>;
	const keys = Object.keys(provides) as (keyof LayerProvides)[];

	if (keys.length === 0) {
		const emptyCtx = Context.empty() as Context.Context<{}>;
		const emptyLayer = Layer.succeedContext(emptyCtx) as unknown as Layer.Layer<
			EffuseServices<ConcreteLayerDefinition<N, T, Provides, Services>>,
			never,
			Scope.Scope
		>;
		return {
			...def,
			name: definition.name,
			effectLayer: emptyLayer,
			tags: {} as {
				readonly [K in keyof EffuseServices<
					ConcreteLayerDefinition<N, T, Provides, Services>
				>]: Context.Tag<
					string,
					EffuseServices<ConcreteLayerDefinition<N, T, Provides, Services>>[K]
				>;
			},
			serviceKeys: [],
			_resolved: true as const,
		} as unknown as CompiledLayer<
			ConcreteLayerDefinition<N, T, Provides, Services>,
			N
		>;
	}

	const entries = keys.map((k) => ({
		key: k as string,
		tag: Context.GenericTag<unknown>(
			`${TAG_NS}${definition.name}/${String(k)}`
		) as Context.Tag<string, unknown>,
		factory: provides[k]!,
	}));

	const layers = entries.map((e) =>
		Layer.scoped(e.tag, Effect.sync(e.factory))
	);

	let merged: Layer.Layer<any, never, any> = layers[0]!;
	for (let i = 1; i < layers.length; i++) {
		const next = layers[i]!;
		merged = Layer.merge(merged, next);
	}

	const build = Effect.flatMap(Layer.build(merged), (ctx) => {
		const obj: Record<string, unknown> = {};
		for (const e of entries) {
			obj[e.key] = Context.get(ctx, e.tag);
		}
		let c = Context.empty() as Context.Context<typeof obj>;
		for (const [k, v] of Object.entries(obj)) {
			c = Context.add(c, k as any, v);
		}
		return Effect.succeed(c);
	});

	const final = Layer.scopedContext(build);

	const tagMap = entries.reduce(
		(acc, e) => Object.assign(acc, { [e.key]: e.tag }),
		{} as {
			readonly [K in keyof EffuseServices<
				ConcreteLayerDefinition<N, T, Provides, Services>
			>]: Context.Tag<
				string,
				EffuseServices<ConcreteLayerDefinition<N, T, Provides, Services>>[K]
			>;
		}
	);

	return {
		...def,
		name: definition.name,
		effectLayer: final as Layer.Layer<
			EffuseServices<ConcreteLayerDefinition<N, T, Provides, Services>>,
			never,
			Scope.Scope
		>,
		tags: tagMap,
		serviceKeys: entries.map((e) => e.key),
		_resolved: true as const,
	} as unknown as CompiledLayer<
		ConcreteLayerDefinition<N, T, Provides, Services>,
		N
	>;
}

export type LayerInput = AnyLayer | CompiledLayer<any>;

export type LayerInputSource =
	| readonly LayerInput[]
	| Readonly<Record<string, LayerInput>>;

export const isCompiledLayer = (
	layer: LayerInput
): layer is CompiledLayer<any> => 'effectLayer' in layer && 'tags' in layer;

export const compileLayer = (layer: LayerInput): CompiledLayer<any> =>
	isCompiledLayer(layer) ? layer : defineLayer(layer);

export const layerInputSourceToList = (
	layers: LayerInputSource
): readonly LayerInput[] =>
	Array.isArray(layers)
		? layers
		: (Object.values(layers) as readonly LayerInput[]);

export const resolveLayerDefinitions = (
	layers: LayerInputSource
): AnyResolvedLayer[] =>
	resolveLayerOrder(
		layerInputSourceToList(layers).map((layer) => compileLayer(layer))
	);

export type MergeServices<Layers extends readonly CompiledLayer<any>[]> =
	Layers extends readonly [infer L, ...infer R]
		? L extends CompiledLayer<infer T>
			? EffuseServices<T> &
					(R extends readonly CompiledLayer<any>[] ? MergeServices<R> : {})
			: never
		: {};

export function combineLayers<Layers extends readonly CompiledLayer<any>[]>(
	...layers: Layers
): Layer.Layer<MergeServices<Layers>, never, Scope.Scope> {
	if (layers.length === 0) {
		return Layer.succeedContext(Context.empty()) as unknown as Layer.Layer<
			{},
			never,
			Scope.Scope
		>;
	}

	const first = layers[0]!.effectLayer;
	if (layers.length === 1) {
		return Layer.merge(first, Layer.scope);
	}

	let m = first;
	for (let i = 1; i < layers.length; i++) {
		m = Layer.merge(m, layers[i]!.effectLayer);
	}
	return Layer.merge(m, Layer.scope);
}

export type LayerServicesFrom<T extends CompiledLayer<any>> =
	T extends CompiledLayer<infer L> ? EffuseServices<L> : never;

export type ExtractServices<T> =
	T extends CompiledLayer<infer L> ? EffuseServices<L> : never;
