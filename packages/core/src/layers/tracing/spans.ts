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

/* eslint-disable no-console */
import { Effect } from 'effect';
import { TracingService } from './TracingService.js';
import type { AnyResolvedLayer } from '../types.js';

export const withLayerSpan = <A, E, R>(
	layer: AnyResolvedLayer,
	effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | TracingService> =>
	Effect.gen(function* () {
		const tracing = yield* TracingService;
		if (!tracing.isEnabled()) {
			return yield* effect;
		}

		const attributes: Record<string, unknown> = {
			layer: layer.name,
		};

		if (
			layer.dependencies &&
			(layer.dependencies as readonly string[]).length > 0
		) {
			attributes['depends'] = layer.dependencies;
		}

		if (layer.provides) {
			const provides = Object.keys(layer.provides);
			if (provides.length > 0) {
				attributes['provides'] = provides;
			}
		}

		const start = performance.now();
		tracing.startSpan(`Layer: ${layer.name}`, attributes);

		try {
			const result = yield* effect;
			const duration = performance.now() - start;
			tracing.logSpan(`Layer: ${layer.name}`, duration, attributes, 1);
			return result;
		} finally {
			tracing.endSpan(`Layer: ${layer.name}`);
		}
	});

export const withRuntimeSpan = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	layerCount: number
): Effect.Effect<A, E, R | TracingService> =>
	Effect.gen(function* () {
		const tracing = yield* TracingService;
		if (!tracing.isEnabled()) {
			return yield* effect;
		}

		const start = performance.now();
		tracing.startSpan('LayerRuntime.init', { layers: layerCount });

		try {
			const result = yield* effect;
			const duration = performance.now() - start;
			tracing.logSpan('LayerRuntime.init', duration, { layers: layerCount }, 0);
			return result;
		} finally {
			tracing.endSpan('LayerRuntime.init');
		}
	});

export const logDependencyGraph = (
	layers: readonly AnyResolvedLayer[]
): Effect.Effect<void, never, TracingService> =>
	Effect.gen(function* () {
		const tracing = yield* TracingService;
		if (!tracing.isEnabled() || !tracing.config.verbose) {
			return;
		}

		const styles = {
			label: 'color: gray; font-weight: lighter;',
			name: 'color: inherit; font-weight: bold;',
			time: 'color: gray; font-weight: lighter;',
			layer: 'color: #03A9F4; font-weight: bold;',
			deps: 'color: #9E9E9E;',
		};

		const time = new Date().toLocaleTimeString();
		console.groupCollapsed(
			`%clayers %c${String(layers.length)} registered %c@ ${time}`,
			styles.label,
			styles.name,
			styles.time
		);

		for (const layer of layers) {
			const deps =
				layer.dependencies &&
				(layer.dependencies as readonly string[]).length > 0
					? ` <- [${(layer.dependencies as string[]).join(', ')}]`
					: '';
			console.log(`%c${layer.name}%c${deps}`, styles.layer, styles.deps);
		}

		console.groupEnd();
	});
