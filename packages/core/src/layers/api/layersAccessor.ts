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
	getLayerService,
	isLayerRuntimeReady,
} from '../context.js';
import {
	LayerNameCollisionError,
	ServiceNotFoundError,
} from '../errors.js';
import type {
	CompiledLayer,
	EffuseServices,
	LayerPropsFrom,
	LayerServicesFrom,
} from './defineLayer.js';
import type { EffuseLayer } from '../types.js';

export type LayerList = readonly CompiledLayer<any, any>[];

export type LayerAliases = Readonly<Record<string, CompiledLayer<any, any>>>;

export type LayerSource = LayerList | LayerAliases;

export interface LayerEntry<T extends EffuseLayer> {
	readonly props: LayerPropsFrom<T>;
	readonly services: EffuseServices<T>;
}

export type LayerEntryFrom<L extends CompiledLayer<any, any>> =
	L extends CompiledLayer<infer T, string> ? LayerEntry<T> : never;

type LayerNameOf<L> = L extends CompiledLayer<any, infer N> ? N : never;

type LayerByName<U extends CompiledLayer<any, any>, N extends string> =
	U extends CompiledLayer<infer T, N> ? LayerEntry<T> : never;

type LayersAccessorFromList<L extends LayerList> = {
	[N in LayerNameOf<L[number]>]: LayerByName<L[number], N>;
};

type LayersAccessorFromAliases<L extends LayerAliases> = {
	readonly [K in keyof L]: LayerEntryFrom<L[K]>;
};

export type LayersAccessor<L extends LayerSource> =
	L extends LayerList
		? LayersAccessorFromList<L>
		: L extends LayerAliases
			? LayersAccessorFromAliases<L>
			: never;

const createServicesBag = <L extends CompiledLayer<any, any>>(
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

export function resolveLayerEntry<L extends CompiledLayer<any, any>>(
	compiledLayer: L
): LayerEntryFrom<L> {
	const name = compiledLayer.name as string;
	const { refresh, services } = createServicesBag(compiledLayer);

	return {
		get props(): LayerPropsFrom<
			L extends CompiledLayer<infer T, string> ? T : never
		> {
			return getLayerContext(name).props as LayerPropsFrom<
				L extends CompiledLayer<infer T, string> ? T : never
			>;
		},
		get services(): EffuseServices<
			L extends CompiledLayer<infer T, string> ? T : never
		> {
			refresh();
			return services;
		},
	} as unknown as LayerEntryFrom<L>;
}

export const createLayerEntryResolver = (): (<
	L extends CompiledLayer<any, any>,
>(
	compiledLayer: L
) => LayerEntryFrom<L>) => {
	const entries = new WeakMap<CompiledLayer<any, any>, LayerEntry<any>>();

	return <L extends CompiledLayer<any, any>>(
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
	L extends CompiledLayer<any, any>,
	K extends Extract<keyof LayerServicesFrom<L>, string>,
>(
	compiledLayer: L,
	key: K | string | undefined,
	resolveEntry: <EntryLayer extends CompiledLayer<any, any>>(
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
): readonly CompiledLayer<any, any>[] =>
	Array.isArray(layers)
		? layers
		: (Object.values(layers) as readonly CompiledLayer<any, any>[]);

export function resolveLayersAccessor<L extends LayerSource>(
	layers: L
): LayersAccessor<L> {
	const accessor: Record<string, LayerEntry<any>> = {};
	const keys = new Set<string>();
	const addEntry = (key: string, compiledLayer: CompiledLayer<any, any>) => {
		if (keys.has(key)) {
			throw new LayerNameCollisionError({ layerName: key });
		}
		keys.add(key);
		accessor[key] = resolveLayerEntry(compiledLayer);
	};

	if (Array.isArray(layers)) {
		for (const compiledLayer of layers) {
			addEntry(compiledLayer.name as string, compiledLayer);
		}
	} else {
		for (const [alias, compiledLayer] of Object.entries(layers)) {
			addEntry(alias, compiledLayer);
		}
	}

	return accessor as LayersAccessor<L>;
}
