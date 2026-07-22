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

import { createHookContext, reportHookCleanupError } from './context.js';
import { traceHookSetup } from '../layers/tracing/hooks.js';
import type { HookSetupFn } from './types.js';
import {
	assertLayerBindingsRegistered,
	type LayerSource,
} from '../layers/api/layersAccessor.js';

export function defineHook<
	C = undefined,
	R = unknown,
	L extends LayerSource = readonly never[],
>(definition: {
	readonly name?: string;
	readonly layers?: L;
	readonly setup: HookSetupFn<C, R, L>;
}): C extends undefined ? () => R : (config: C) => R {
	const hookName = definition.name || definition.setup.name || 'anonymous';
	const layers = (definition.layers ?? []) as L;

	const hookFn = (config?: C): R => {
		const start = performance.now();
		const { ctx, dispose } = createHookContext<C, L>(
			config as C,
			layers,
			hookName
		);
		let result: R;
		try {
			assertLayerBindingsRegistered(layers, { kind: 'hook', name: hookName });
			result = definition.setup(ctx);
		} catch (error) {
			void dispose().catch((cleanupError: unknown) => {
				reportHookCleanupError(hookName, 'setup rollback', cleanupError);
			});
			throw error;
		}
		const duration = performance.now() - start;

		traceHookSetup(hookName, duration, config as Record<string, unknown>);

		return result;
	};

	return hookFn as C extends undefined ? () => R : (config: C) => R;
}
