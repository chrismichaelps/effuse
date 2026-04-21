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

import { getLayerContext, getLayerService } from '../context.js';
import type { CompiledLayer, EffuseServices } from './defineLayer.js';
import type { LayerProps, EffuseLayer } from '../types.js';

export interface LayerEntry<T extends EffuseLayer> {
	readonly props: LayerProps;
	readonly services: EffuseServices<T>;
}

type LayerNameOf<L> =
	L extends CompiledLayer<any, infer N> ? N : never;

type LayerByName<
	U extends CompiledLayer<any, any>,
	N extends string,
> = U extends CompiledLayer<infer T, N>
	? LayerEntry<T>
	: never;

export type LayersAccessor<L extends readonly CompiledLayer<any, any>[]> = {
	[N in LayerNameOf<L[number]>]: LayerByName<L[number], N>;
};

export function resolveLayersAccessor<
	L extends readonly CompiledLayer<any, any>[],
>(layers: L): LayersAccessor<L> {
	const accessor: Record<string, LayerEntry<any>> = {};

	for (const compiledLayer of layers) {
		const name = compiledLayer.name as string;

		accessor[name] = {
			get props(): LayerProps {
				return getLayerContext(name).props;
			},
			get services(): Record<string, unknown> {
				const services: Record<string, unknown> = {};
				if (compiledLayer.provides) {
					for (const key of Object.keys(compiledLayer.provides)) {
						services[key] = getLayerService(key);
					}
				}
				return services;
			},
		};
	}

	return accessor as LayersAccessor<L>;
}
