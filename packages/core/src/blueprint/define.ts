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
import type { LayerSource } from '../layers/api/layersAccessor.js';
import {
	createProvideScope,
	runWithProvideScope,
	getCurrentProvideScope,
	type ProvideScope,
} from './provide-inject.js';

export type TemplateArgs<E extends ExposedValues> = E & {
	readonly children?: EffuseChild;
};

/** Merged template context: exposed values + props + children. */
export type TemplateContext<E extends ExposedValues, P> = E &
	Readonly<P> & {
		readonly children?: EffuseChild;
	};

export interface DefineOptionsWithInferredProps<
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
> {
	name?: string;
	props: P;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** HMR module identifier — injected by the Vite dev plugin. */
	__hmrId?: string;
}

export interface DefineOptions<
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
> {
	name?: string;
	props?: undefined;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** HMR module identifier — injected by the Vite dev plugin. */
	__hmrId?: string;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	updateProps: (props: Record<string, unknown>) => void;
	_template: (ctx: TemplateContext<E, unknown>) => EffuseChild;
	/** Reactive props proxy created by script context. */
	_reactiveProps?: Readonly<Record<string, unknown>>;
	/** Provide scope for component-level provide/inject. */
	_provideScope?: ProvideScope;
	[key: string]: unknown;
}

export function define<
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
	L extends LayerSource = readonly never[],
>(
	options: DefineOptions<P, E, L> | DefineOptionsWithInferredProps<P, E, L>
): Component<P> {
	const blueprint: Record<string, unknown> & BlueprintDef<P> = {
		_tag: 'Blueprint',
		name: (options as { name?: string }).name,
		__hmrId: (options as { __hmrId?: string }).__hmrId,

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
				try {
					runMountCallbacks(state);
				} catch {
					/* mount errors are handled individually inside runMount */
				}
			});

			return {
				exposed: state.exposed,
				lifecycle: state.lifecycle,
				updateProps: state.updateProps,
				_template: options.template,
				_reactiveProps: context.props as Readonly<Record<string, unknown>>,
				_provideScope: provideScope,
			} as unknown as Record<string, unknown>;
		},

		view: (ctx: BlueprintContext<P>) => {
			const state = ctx.state as DefineState<E>;
			const props = (state._reactiveProps ?? ctx.props) as Readonly<
				Record<string, unknown>
			>;
			const children = ((ctx.props as Record<string, unknown>).children ??
				props.children) as EffuseChild | undefined;
			const mergedCtx: TemplateContext<E, P> = {
				...state.exposed,
				...props,
				children,
			} as TemplateContext<E, P>;

			return state._template(mergedCtx);
		},
	};

	// Component<P> adds a callable signature to BlueprintDef<P>; at runtime
	// JSX treats this as a blueprint, so the cast bridges the type gap.
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

/**
 * Type-only helper for declaring component props without dummy runtime values.
 *
 * Returns an empty object at runtime — type checking happens at compile time.
 *
 * @example
 * ```ts
 * const Comp = define({
 *   props: defineProps<{ name: string; count: number }>(),
 *   script: ({ props }) => { … },
 *   template: (ctx) => <div>{ctx.name}</div>,
 * });
 * ```
 */
export const defineProps = <P>(): P => ({}) as P;
