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

import { Layer, Effect } from 'effect';
import type { EffuseLayer, LayerProps } from '../types.js';

export interface CompiledEffuseLayer<
	P extends LayerProps,
	D extends readonly string[],
	S
> extends EffuseLayer<P, D, S> {
	/**
	 * @internal
	 * The underlying Effect.Layer that natively manages this module's lifecycle.
	 * Kept strictly encapsulated from the end-user.
	 */
	readonly _effectLayer: Layer.Layer<never, unknown, never>;
}

export const defineLayer = <
	const D extends readonly string[],
	P extends LayerProps = LayerProps,
	S = unknown,
>(
	definition: EffuseLayer<P, D, S>
): CompiledEffuseLayer<P, D, S> => {
	// map user config to native Layer for lifecycle scoping
	const effectLayer = Layer.scopedDiscard(
		Effect.acquireRelease(
			Effect.sync(() => {
				// hook for runtime context resolution
				return definition.name;
			}),
			() =>
				Effect.sync(() => {
					// fiber cleanup hooks
				})
		)
	);

	return {
		...definition,
		_effectLayer: effectLayer,
	};
};
