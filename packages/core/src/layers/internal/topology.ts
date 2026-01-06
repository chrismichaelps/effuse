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

import { Effect, Either, Option } from 'effect';
import type { AnyResolvedLayer } from '../types.js';
import { CircularDependencyError } from '../errors.js';

export interface TopologyLevel {
	readonly level: number;
	readonly layers: readonly AnyResolvedLayer[];
}

type LayerMap = Map<string, AnyResolvedLayer>;

const enum NodeState {
	Unvisited = 0,
	Visiting = 1,
	Visited = 2,
}

const detectCycle = (
	node: string,
	layerMap: LayerMap,
	state: Map<string, NodeState>,
	path: string[]
): Option.Option<readonly string[]> => {
	state.set(node, NodeState.Visiting);
	path.push(node);

	const layer = layerMap.get(node);
	const deps = (layer?.dependencies as string[] | undefined) ?? [];

	for (const dep of deps) {
		const depState = state.get(dep) ?? NodeState.Unvisited;

		if (depState === NodeState.Visiting) {
			const cycleStart = path.indexOf(dep);
			return Option.some(path.slice(cycleStart));
		}

		if (depState === NodeState.Unvisited && layerMap.has(dep)) {
			const cycle = detectCycle(dep, layerMap, state, path);
			if (Option.isSome(cycle)) {
				return cycle;
			}
		}
	}

	path.pop();
	state.set(node, NodeState.Visited);
	return Option.none();
};

const detectCircularDependencies = (
	layers: readonly AnyResolvedLayer[]
): Effect.Effect<void, CircularDependencyError> =>
	Effect.gen(function* () {
		const layerMap: LayerMap = new Map();
		for (const layer of layers) {
			layerMap.set(layer.name, layer);
		}

		const state = new Map<string, NodeState>();

		for (const layer of layers) {
			if (
				(state.get(layer.name) ?? NodeState.Unvisited) === NodeState.Unvisited
			) {
				const cycle = detectCycle(layer.name, layerMap, state, []);

				if (Option.isSome(cycle)) {
					const cyclePath = cycle.value;
					const lastNode = cyclePath[cyclePath.length - 1] ?? layer.name;
					yield* Effect.fail(
						new CircularDependencyError({
							layerName: lastNode,
							dependencyChain: cyclePath.slice(0, -1),
						})
					);
				}
			}
		}
	});

const buildLevelsFromLayers = (
	layers: readonly AnyResolvedLayer[]
): readonly TopologyLevel[] => {
	const layerMap: LayerMap = new Map();
	for (const layer of layers) {
		layerMap.set(layer.name, layer);
	}

	const levels: TopologyLevel[] = [];
	const built = new Set<string>();
	const remaining = new Set(layers.map((l) => l.name));

	while (remaining.size > 0) {
		const readyLayers: AnyResolvedLayer[] = [];

		for (const name of remaining) {
			const layer = layerMap.get(name);
			if (!layer) continue;

			const deps = (layer.dependencies as string[] | undefined) ?? [];
			const allDepsBuilt = deps.every((dep) => built.has(dep));

			if (allDepsBuilt) {
				readyLayers.push(layer);
			}
		}

		for (const layer of readyLayers) {
			built.add(layer.name);
			remaining.delete(layer.name);
		}

		if (readyLayers.length > 0) {
			levels.push({
				level: levels.length,
				layers: readyLayers,
			});
		}
	}

	return levels;
};

const buildTopologyLevelsEffect = (
	layers: readonly AnyResolvedLayer[]
): Effect.Effect<readonly TopologyLevel[], CircularDependencyError> =>
	Effect.gen(function* () {
		yield* detectCircularDependencies(layers);
		return buildLevelsFromLayers(layers);
	});

export const buildTopologyLevels = (
	layers: readonly AnyResolvedLayer[]
): readonly TopologyLevel[] => {
	const result = Effect.runSync(
		Effect.either(buildTopologyLevelsEffect(layers))
	);

	if (Either.isLeft(result)) {
		throw result.left;
	}

	return result.right;
};

export const getMaxParallelism = (levels: readonly TopologyLevel[]): number =>
	levels.reduce((max, level) => Math.max(max, level.layers.length), 0);
