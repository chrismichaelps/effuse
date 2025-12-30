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

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { AnyResolvedLayer } from '../types.js';

export interface TopologyLevel {
  readonly level: number;
  readonly layers: readonly AnyResolvedLayer[];
}

export const buildTopologyLevels = (
  layers: readonly AnyResolvedLayer[]
): readonly TopologyLevel[] => {
  const layerMap = new Map<string, AnyResolvedLayer>();
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

      const deps: string[] = layer.dependencies ?? [];
      const allDepsBuilt = deps.every((dep: string) => built.has(dep));

      if (allDepsBuilt) {
        readyLayers.push(layer);
      }
    }

    if (readyLayers.length === 0 && remaining.size > 0) {
      const remainingLayers = Array.from(remaining)
        .map((name) => layerMap.get(name))
        .filter((l): l is AnyResolvedLayer => l !== undefined);
      levels.push({
        level: levels.length,
        layers: remainingLayers,
      });
      break;
    }

    for (const layer of readyLayers) {
      built.add(layer.name);
      remaining.delete(layer.name);
    }

    levels.push({
      level: levels.length,
      layers: readyLayers,
    });
  }

  return levels;
};

export const getMaxParallelism = (
  levels: readonly TopologyLevel[]
): number => {
  return levels.reduce((max, level) => Math.max(max, level.layers.length), 0);
};
