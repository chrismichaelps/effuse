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

import type {
	BlueprintDef,
	BlueprintContext,
	EffuseChild,
	Component,
} from '../render/node.js';
import type { ScriptContext, ExposedValues } from './script-context.js';
import { createScriptContext, runMountCallbacks } from './script-context.js';
import type { ComponentLifecycle } from './lifecycle.js';
import type { AnyPropSchemaBuilder } from './props.js';

export interface PropsSchema<P> {
	Type: P;
}

export interface DefineOptions<P, E extends ExposedValues> {
	props?: PropsSchema<P>;
	propsSchema?: AnyPropSchemaBuilder;
	script: (ctx: ScriptContext<P>) => E | undefined;
	template: (exposed: E, props: Readonly<P>) => EffuseChild;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	_template: (exposed: E, props: unknown) => EffuseChild;
	[key: string]: unknown;
}

export const define = <
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
>(options: {
	props?: PropsSchema<P>;
	propsSchema?: AnyPropSchemaBuilder;
	script: (ctx: ScriptContext<P>) => E;
	template: (exposed: E, props: Readonly<P>) => EffuseChild;
}): Component<P> => {
	const blueprint: BlueprintDef<P> = {
		_tag: 'Blueprint',

		state: (props: P) => {
			let validatedProps = props;
			if (options.propsSchema) {
				validatedProps = options.propsSchema.validateSync(props) as P;
			}

			const { context, state } = createScriptContext<P, E>(validatedProps);

			const scriptResult = options.script(context);
			Object.assign(state.exposed, scriptResult);

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
			return state._template(state.exposed, ctx.props);
		},
	};

	return blueprint as unknown as Component<P>;
};

export type InferExposed<D> =
	D extends DefineOptions<unknown, infer E> ? E : never;

export type InferProps<D> =
	D extends DefineOptions<infer P, ExposedValues> ? P : never;
