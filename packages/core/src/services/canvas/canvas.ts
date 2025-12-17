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

import type { Effect } from 'effect';
import { Context } from 'effect';
import type { EffuseChild, BlueprintDef } from '../../render/node.js';
import type { RenderError, BlueprintError } from '../../errors/index.js';

export interface CanvasServiceInterface {
	readonly paint: <P extends Record<string, unknown>>(
		blueprint: BlueprintDef<P>,
		props: P
	) => Effect.Effect<void, RenderError | BlueprintError>;

	readonly render: (node: EffuseChild) => Effect.Effect<void, RenderError>;

	readonly dispose: () => Effect.Effect<void>;
}

export class CanvasService extends Context.Tag('effuse/Canvas')<
	CanvasService,
	CanvasServiceInterface
>() {}
