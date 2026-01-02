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

import { Effect, Context, Layer } from 'effect';
import type { EffuseChild, BlueprintDef, Portals } from '../../render/node.js';
import { BlueprintError } from '../../errors/internal.js';

export interface BlueprintServiceInterface {
	readonly instantiate: <P extends Record<string, unknown>>(
		def: BlueprintDef<P>,
		props: P,
		portals: Portals
	) => Effect.Effect<EffuseChild, BlueprintError>;
}

export class BlueprintService extends Context.Tag('effuse/Blueprint')<
	BlueprintService,
	BlueprintServiceInterface
>() {}

export const BlueprintLive = Layer.succeed(BlueprintService, {
	instantiate: <P extends Record<string, unknown>>(
		def: BlueprintDef<P>,
		props: P,
		portals: Portals
	) =>
		Effect.try({
			try: () => {
				const state = def.state ? def.state(props) : {};
				const context = { props, state, portals };
				return def.view(context);
			},
			catch: (error) =>
				new BlueprintError({
					message: String(error),
					blueprint: def,
					props,
				}),
		}),
});
