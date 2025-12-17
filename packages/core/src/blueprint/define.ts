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

export interface PropsSchema<P> {
	Type: P;
}

export interface DefineOptions<P, E extends ExposedValues> {
	props?: PropsSchema<P>;
	script: (ctx: ScriptContext<P>) => E | undefined;
	template: (exposed: E, props: Readonly<P>) => EffuseChild;
}

interface DefineState<E extends ExposedValues> {
	exposed: E;
	_template: (exposed: E, props: unknown) => EffuseChild;
	_mountCallbacks: Array<() => void>;
	_unmountCallbacks: Array<() => void>;
	[key: string]: unknown;
}

export const define = <
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
>(options: {
	props?: PropsSchema<P>;
	script: (ctx: ScriptContext<P>) => E;
	template: (exposed: E, props: Readonly<P>) => EffuseChild;
}): Component<P> => {
	const blueprint: BlueprintDef<P> = {
		_tag: 'Blueprint',

		state: (props: P) => {
			const { context, state } = createScriptContext<P, E>(props);

			const scriptResult = options.script(context);

			if (scriptResult !== undefined) {
				Object.assign(state.exposed, scriptResult);
			}

			if (state.mountCallbacks.length > 0) {
				queueMicrotask(() => {
					runMountCallbacks(state);
				});
			}

			return {
				exposed: state.exposed,
				_template: options.template,
				_mountCallbacks: state.mountCallbacks,
				_unmountCallbacks: state.unmountCallbacks,
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
