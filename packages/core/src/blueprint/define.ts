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

import { Predicate } from 'effect';
import type {
	BlueprintDef,
	BlueprintContext,
	EffuseChild,
	Component,
} from '../render/node.js';
import type { ScriptContext, ExposedValues } from './script-context.js';
import { createScriptContext, runMountCallbacks } from './script-context.js';
import type { ComponentLifecycle } from './lifecycle.js';
import type {
	EffuseLayerRegistry,
	LayerPropsOf,
	LayerProvidesOf,
} from '../layers/types.js';
import type { LayerContext } from '../layers/context.js';
import { getLayerContext, isLayerRuntimeReady } from '../layers/context.js';
import { LayerRuntimeNotReadyError } from '../layers/errors.js';

interface PropsWithChildren {
	readonly children?: EffuseChild;
}

export type TemplateArgs<E extends ExposedValues> = E & {
	readonly children?: EffuseChild;
};

export interface LayerScriptContext<
	P,
	K extends keyof EffuseLayerRegistry,
> extends ScriptContext<P> {
	readonly layerProps: LayerPropsOf<K>;
	readonly layer: LayerContext<LayerPropsOf<K>, LayerProvidesOf<K>>;
}

export interface DefineOptionsWithInferredProps<P, E extends ExposedValues> {
	name?: string;
	props: P;
	layer?: undefined;
	script: (ctx: ScriptContext<P>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

export interface DefineOptionsWithInferredPropsAndLayer<
	P,
	E extends ExposedValues,
	K extends keyof EffuseLayerRegistry,
> {
	name?: string;
	props: P;
	layer: K;
	script: (ctx: LayerScriptContext<P, K>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

export interface DefineOptions<P, E extends ExposedValues> {
	name?: string;
	props?: undefined;
	layer?: undefined;
	script: (ctx: ScriptContext<P>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

export interface DefineOptionsWithLayer<
	P,
	E extends ExposedValues,
	K extends keyof EffuseLayerRegistry,
> {
	name?: string;
	props?: undefined;
	layer: K;
	script: (ctx: LayerScriptContext<P, K>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	_template: (exposed: TemplateArgs<E>, props: unknown) => EffuseChild;
	[key: string]: unknown;
}

export function define<
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
>(
	options: DefineOptions<P, E> | DefineOptionsWithInferredProps<P, E>
): Component<P>;

export function define<
	K extends keyof EffuseLayerRegistry,
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
>(
	options:
		| DefineOptionsWithLayer<P, E, K>
		| DefineOptionsWithInferredPropsAndLayer<P, E, K>
): Component<P>;

export function define<
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
	K extends keyof EffuseLayerRegistry = never,
>(
	options:
		| DefineOptions<P, E>
		| DefineOptionsWithLayer<P, E, K>
		| DefineOptionsWithInferredProps<P, E>
		| DefineOptionsWithInferredPropsAndLayer<P, E, K>
): Component<P> {
	const blueprint: BlueprintDef<P> = {
		_tag: 'Blueprint',
		name: (options as { name?: string }).name,

		state: (props: P) => {
			const { context, state } = createScriptContext<P, E>(props);

			let scriptResult: E | undefined;

			const layerName = (options as { layer?: string }).layer;

			if (Predicate.isString(layerName)) {
				if (isLayerRuntimeReady()) {
					const layerContext = getLayerContext(layerName) as LayerContext<
						LayerPropsOf<K>,
						LayerProvidesOf<K>
					>;

					const extendedContext: LayerScriptContext<P, K> = {
						...context,
						layerProps: layerContext.props,
						layer: layerContext,
					};

					scriptResult = (
						options as unknown as DefineOptionsWithLayer<P, E, K>
					).script(extendedContext);
				} else {
					throw new LayerRuntimeNotReadyError({
						layerName: layerName,
					});
				}
			} else {
				scriptResult = (options as DefineOptions<P, E>).script(context);
			}

			if (Predicate.isNotNullable(scriptResult)) {
				Object.assign(state.exposed, scriptResult);
			}

			queueMicrotask(() => {
				runMountCallbacks(state);
			});

			return {
				exposed: state.exposed,
				lifecycle: state.lifecycle,
				_template: options.template,
			} as DefineState<E> as unknown as Record<string, never>;
		},

		view: (ctx: BlueprintContext<P>) => {
			const state = ctx.state as unknown as DefineState<E>;

			const propsWithChildren = ctx.props as unknown as PropsWithChildren;
			const exposedWithChildren: TemplateArgs<E> = {
				...state.exposed,
				children: propsWithChildren.children,
			};

			return state._template(exposedWithChildren, ctx.props);
		},
	};

	return blueprint as unknown as Component<P>;
}

export type InferExposed<D> =
	D extends DefineOptions<unknown, infer E> ? E : never;

export type InferProps<D> =
	D extends DefineOptionsWithInferredProps<infer P, ExposedValues>
		? P
		: D extends DefineOptions<infer P, ExposedValues>
			? P
			: never;

export type LayerPropsFor<K extends keyof EffuseLayerRegistry> =
	LayerPropsOf<K>;
