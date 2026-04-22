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
import { withActiveLifecycle } from './lifecycle.js';
import type { CompiledLayer } from '../layers/api/defineLayer.js';
import {
	createProvideScope,
	runWithProvideScope,
	getCurrentProvideScope,
} from './provide-inject.js';

interface PropsWithChildren {
	readonly children?: EffuseChild;
}

export type TemplateArgs<E extends ExposedValues> = E & {
	readonly children?: EffuseChild;
};

export interface DefineOptionsWithInferredProps<
	P,
	E extends ExposedValues,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	L extends readonly CompiledLayer<any>[] = [],
> {
	name?: string;
	props: P;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

export interface DefineOptions<
	P,
	E extends ExposedValues,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	L extends readonly CompiledLayer<any>[] = [],
> {
	name?: string;
	props?: undefined;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	_template: (exposed: TemplateArgs<E>, props: unknown) => EffuseChild;
	/** Reactive props proxy created by script context. */
	_reactiveProps?: Readonly<Record<string, unknown>>;
	/** Provide scope for component-level provide/inject. */
	_provideScope?: import('./provide-inject.js').ProvideScope;
	[key: string]: unknown;
}

export function define<
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	L extends readonly CompiledLayer<any>[] = [],
>(
	options: DefineOptions<P, E, L> | DefineOptionsWithInferredProps<P, E, L>
): Component<P> {
	const blueprint: BlueprintDef<P> = {
		_tag: 'Blueprint',
		name: (options as { name?: string }).name,

		state: (props: P) => {
			const layers = (options as { layers?: L }).layers;
			const { context, state } = createScriptContext<P, E, L>(
				props,
				undefined,
				layers
			);

			const parentScope = getCurrentProvideScope();
			const provideScope = createProvideScope(parentScope);

			const scriptResult = runWithProvideScope(provideScope, () =>
				withActiveLifecycle(state.lifecycle, () => options.script(context))
			);

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
				_reactiveProps: context.props as Readonly<Record<string, unknown>>,
				_provideScope: provideScope,
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
