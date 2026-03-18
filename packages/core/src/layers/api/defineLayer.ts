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
import type { EffuseLayer, LayerProvides } from '../types.js';

const TAG_NS = 'effuse/layer/';

type ResultOf<T> = T extends () => infer R ? R : never;

export type EffuseServices<T extends EffuseLayer> =
	T['provides'] extends infer P extends LayerProvides
		? { [K in keyof P]: ResultOf<P[K]> }
		: {};

export interface CompiledLayer<T extends EffuseLayer> extends EffuseLayer {
	readonly effectLayer: Layer.Layer<EffuseServices<T>, never, Scope.Scope>;
	readonly tags: {
		readonly [K in keyof EffuseServices<T>]: Context.Tag<
			string,
			EffuseServices<T>[K]
		>;
	};
	readonly _resolved: true;
}

export function defineLayer<T extends EffuseLayer>(
	definition: T
): CompiledLayer<T> {
	const provides = definition.provides ?? ({} as LayerProvides);
	const keys = Object.keys(provides) as (keyof LayerProvides)[];

	if (keys.length === 0) {
		const emptyCtx = Context.empty() as Context.Context<{}>;
		const emptyLayer = Layer.succeedContext(emptyCtx) as unknown as Layer.Layer<
			EffuseServices<T>,
			never,
			Scope.Scope
		>;
		return {
			name: definition.name,
			effectLayer: emptyLayer,
			tags: {} as {
				readonly [K in keyof EffuseServices<T>]: Context.Tag<
					string,
					EffuseServices<T>[K]
				>;
			},
			_resolved: true as const,
		};
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
			readonly [K in keyof EffuseServices<T>]: Context.Tag<
				string,
				EffuseServices<T>[K]
			>;
		}
	);

	return {
		...definition,
		effectLayer: final as Layer.Layer<EffuseServices<T>, never, Scope.Scope>,
		tags: tagMap,
		_resolved: true as const,
	};
}

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
