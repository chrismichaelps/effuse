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

import {
	getLayerContext,
	getLayerContextStore,
	getLayerService,
	isLayerRuntimeReady,
} from '../context.js';
import {
	LayerBindingNotRegisteredError,
	LayerNameCollisionError,
	ServiceNotFoundError,
} from '../errors.js';
import { compileLayer, resolveLayerDefinitions } from './defineLayer.js';
import type {
	CompiledLayer,
	EffuseServices,
	LayerPropsFrom,
	LayerServicesFrom,
} from './defineLayer.js';
import type { EffuseLayer } from '../types.js';

export type LayerList = readonly CompiledLayer<EffuseLayer, string>[];

export type LayerAliases = Readonly<
	Record<string, CompiledLayer<EffuseLayer, string>>
>;

export type LayerSource = LayerList | LayerAliases;

export interface LayerBindingConsumer {
	readonly kind: 'component' | 'hook';
	readonly name: string;
}

export interface LayerEntry<T extends EffuseLayer> {
	readonly props: LayerPropsFrom<T>;
	readonly services: EffuseServices<T>;
	prop<Key extends Extract<keyof LayerPropsFrom<T>, string>>(
		key: Key
	): LayerPropsFrom<T>[Key];
	service<Key extends Extract<keyof EffuseServices<T>, string>>(
		key: Key
	): EffuseServices<T>[Key];
}

export type LayerEntryFrom<L extends CompiledLayer<EffuseLayer, string>> =
	L extends CompiledLayer<infer T, string> ? LayerEntry<T> : never;

type LayerNameOf<L> = L extends CompiledLayer<EffuseLayer, infer N> ? N : never;

type LayerContractOf<L extends CompiledLayer<EffuseLayer, string>> =
	L extends CompiledLayer<infer T, string> ? T : never;

type LayerServiceKey<L extends CompiledLayer<EffuseLayer, string>> = Extract<
	keyof EffuseServices<LayerContractOf<L>>,
	string
>;

type LayerByName<
	U extends CompiledLayer<EffuseLayer, string>,
	N extends string,
> = U extends CompiledLayer<infer T, N> ? LayerEntry<T> : never;

type LayerDefinitionOf<L extends CompiledLayer<EffuseLayer, string>> =
	L extends CompiledLayer<EffuseLayer, string, infer D> ? D : never;

type ExtendedLayerOf<L extends CompiledLayer<EffuseLayer, string>> =
	LayerDefinitionOf<L> extends { readonly extends?: readonly (infer E)[] }
		? Extract<E, CompiledLayer<EffuseLayer, string>>
		: never;

type LayerClosureOf<
	L extends CompiledLayer<EffuseLayer, string>,
	Seen = never,
> = L extends Seen
	? never
	:
			| L
			| (ExtendedLayerOf<L> extends infer E
					? E extends CompiledLayer<EffuseLayer, string>
						? LayerClosureOf<E, Seen | L>
						: never
					: never);

type LayerListClosureOf<L extends LayerList> = L[number] extends infer Item
	? Item extends CompiledLayer<EffuseLayer, string>
		? LayerClosureOf<Item>
		: never
	: never;

type LayersAccessorFromList<L extends LayerList> = {
	[N in LayerNameOf<LayerListClosureOf<L>>]: LayerByName<
		LayerListClosureOf<L>,
		N
	>;
};

type LayersAccessorFromAliases<L extends LayerAliases> = {
	readonly [K in keyof L]: LayerEntryFrom<L[K]>;
};

export type LayersAccessor<L extends LayerSource> = L extends LayerList
	? LayersAccessorFromList<L>
	: L extends LayerAliases
		? LayersAccessorFromAliases<L>
		: never;

const createServicesBag = <L extends CompiledLayer<EffuseLayer, string>>(
	compiledLayer: L
): {
	readonly services: EffuseServices<
		L extends CompiledLayer<infer T, string> ? T : never
	>;
	readonly refresh: () => void;
} => {
	const keys = Object.keys(compiledLayer.provides ?? {});
	const services: Record<string, unknown> = {};
	const serviceCache: Record<string, unknown> = {};
	const readService = (key: string): unknown => {
		const service = getLayerService(key);
		if (service === undefined) {
			throw new ServiceNotFoundError({
				layerName: compiledLayer.name,
				serviceKey: key,
			});
		}
		return service;
	};

	for (const key of keys) {
		Object.defineProperty(services, key, {
			enumerable: true,
			get: () => {
				if (isLayerRuntimeReady()) {
					serviceCache[key] = readService(key);
				}
				return serviceCache[key];
			},
		});
	}

	return {
		services: services as EffuseServices<
			L extends CompiledLayer<infer T, string> ? T : never
		>,
		refresh: () => {
			for (const key of keys) {
				serviceCache[key] = readService(key);
			}
		},
	};
};

export function resolveLayerEntry<L extends CompiledLayer<EffuseLayer, string>>(
	compiledLayer: L
): LayerEntryFrom<L> {
	const name = compiledLayer.name as string;
	const { refresh, services } = createServicesBag(compiledLayer);
	const readProps = (): LayerPropsFrom<LayerContractOf<L>> =>
		getLayerContext(name).props as LayerPropsFrom<LayerContractOf<L>>;
	const readService = (
		key: string
	): EffuseServices<LayerContractOf<L>>[LayerServiceKey<L>] => {
		refresh();
		const service = (services as Record<string, unknown>)[key];
		if (service === undefined) {
			throw new ServiceNotFoundError({
				layerName: compiledLayer.name,
				serviceKey: key,
			});
		}
		return service as EffuseServices<LayerContractOf<L>>[LayerServiceKey<L>];
	};

	return {
		get props(): LayerPropsFrom<LayerContractOf<L>> {
			return readProps();
		},
		get services(): EffuseServices<LayerContractOf<L>> {
			refresh();
			return services;
		},
		prop: <
			Key extends Extract<keyof LayerPropsFrom<LayerContractOf<L>>, string>,
		>(
			key: Key
		) => readProps()[key],
		service: <Key extends LayerServiceKey<L>>(key: Key) => readService(key),
	} as unknown as LayerEntryFrom<L>;
}

export const createLayerEntryResolver = (): (<
	L extends CompiledLayer<EffuseLayer, string>,
>(
	compiledLayer: L
) => LayerEntryFrom<L>) => {
	const entries = new WeakMap<
		CompiledLayer<EffuseLayer, string>,
		LayerEntry<EffuseLayer>
	>();

	return <L extends CompiledLayer<EffuseLayer, string>>(
		compiledLayer: L
	): LayerEntryFrom<L> => {
		const cached = entries.get(compiledLayer);
		if (cached) {
			return cached as LayerEntryFrom<L>;
		}

		const entry = resolveLayerEntry(compiledLayer);
		entries.set(compiledLayer, entry);
		return entry;
	};
};

export const resolveLayerService = <
	L extends CompiledLayer<EffuseLayer, string>,
	K extends Extract<keyof LayerServicesFrom<L>, string>,
>(
	compiledLayer: L,
	key: K | string | undefined,
	resolveEntry: <EntryLayer extends CompiledLayer<EffuseLayer, string>>(
		layer: EntryLayer
	) => LayerEntryFrom<EntryLayer> = resolveLayerEntry
): LayerServicesFrom<L>[K] => {
	if (!key || !compiledLayer.serviceKeys.includes(key)) {
		throw new ServiceNotFoundError({
			layerName: compiledLayer.name,
			serviceKey: key ?? '<missing>',
		});
	}

	const services = resolveEntry(compiledLayer).services as Record<
		string,
		unknown
	>;
	const service = services[key];
	if (service === undefined) {
		throw new ServiceNotFoundError({
			layerName: compiledLayer.name,
			serviceKey: key,
		});
	}

	return service as LayerServicesFrom<L>[K];
};

export const layerSourceToList = <L extends LayerSource>(
	layers: L
): readonly CompiledLayer<EffuseLayer, string>[] =>
	Array.isArray(layers)
		? layers
		: (Object.values(layers) as readonly CompiledLayer<EffuseLayer, string>[]);

export const assertLayerBindingsRegistered = <L extends LayerSource>(
	layers: L,
	consumer: LayerBindingConsumer
): void => {
	const registry = getLayerContextStore()?.layerRegistry;
	const bindings: readonly [string, CompiledLayer<EffuseLayer, string>][] =
		Array.isArray(layers)
			? layers.map((layer) => [layer.name, layer] as const)
			: Object.entries(layers);

	for (const [alias, layer] of bindings) {
		if (!registry?.hasLayer(layer.name)) {
			throw new LayerBindingNotRegisteredError({
				consumerKind: consumer.kind,
				consumerName: consumer.name,
				alias,
				layerName: layer.name,
			});
		}
	}
};

const expandLayerList = (
	layers: LayerList
): readonly CompiledLayer<EffuseLayer, string>[] =>
	resolveLayerDefinitions(layers).map(
		(layer) => compileLayer(layer) as CompiledLayer<EffuseLayer, string>
	);

export function resolveLayersAccessor<L extends LayerSource>(
	layers: L
): LayersAccessor<L> {
	const accessor: Record<string, LayerEntry<EffuseLayer>> = {};
	const keys = new Set<string>();
	const addEntry = (
		key: string,
		compiledLayer: CompiledLayer<EffuseLayer, string>
	) => {
		if (keys.has(key)) {
			throw new LayerNameCollisionError({ layerName: key });
		}
		keys.add(key);
		accessor[key] = resolveLayerEntry(compiledLayer);
	};

	if (Array.isArray(layers)) {
		for (const compiledLayer of expandLayerList(layers)) {
			addEntry(compiledLayer.name as string, compiledLayer);
		}
	} else {
		for (const [alias, compiledLayer] of Object.entries(layers)) {
			addEntry(alias, compiledLayer);
		}
	}

	return accessor as LayersAccessor<L>;
}
