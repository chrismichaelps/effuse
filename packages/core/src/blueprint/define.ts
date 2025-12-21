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
import { useStyles } from '../styles/useStyles.js';
import type { StyleOptions, StyleCleanup } from '../styles/types.js';

export interface PropsSchema<P> {
	Type: P;
}

interface PropsWithChildren {
	readonly children?: EffuseChild;
}

export type TemplateArgs<E extends ExposedValues> = E & {
	readonly children?: EffuseChild;
};

export interface DefineOptions<P, E extends ExposedValues> {
	props?: PropsSchema<P>;
	propsSchema?: AnyPropSchemaBuilder;
	styles?: string | readonly string[];
	styleOptions?: StyleOptions;
	script: (ctx: ScriptContext<P>) => E | undefined;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	_template: (exposed: TemplateArgs<E>, props: unknown) => EffuseChild;
	_styleCleanup?: StyleCleanup;
	[key: string]: unknown;
}

// Build component definition
export const define = <
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
>(options: {
	props?: PropsSchema<P>;
	propsSchema?: AnyPropSchemaBuilder;
	styles?: string | readonly string[];
	styleOptions?: StyleOptions;
	script: (ctx: ScriptContext<P>) => E;
	template: (exposed: TemplateArgs<E>, props: Readonly<P>) => EffuseChild;
}): Component<P> => {
	const blueprint: BlueprintDef<P> = {
		_tag: 'Blueprint',

		state: (props: P) => {
			let validatedProps = props;
			if (options.propsSchema) {
				validatedProps = options.propsSchema.validateSync(props) as P;
			}

			let styleCleanup: StyleCleanup | undefined;
			if (options.styles) {
				styleCleanup = useStyles(options.styles, options.styleOptions);
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
				_styleCleanup: styleCleanup,
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
};

export type InferExposed<D> =
	D extends DefineOptions<unknown, infer E> ? E : never;

export type InferProps<D> =
	D extends DefineOptions<infer P, ExposedValues> ? P : never;
