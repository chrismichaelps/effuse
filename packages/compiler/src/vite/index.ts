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

import type { Plugin, TransformResult as ViteTransformResult } from 'vite';
import { Effect, pipe } from 'effect';

import {
	type CompilerConfig,
	mergeConfig,
	defaultConfig,
} from '../config/index.js';
import { transform, TransformerLive } from '../transformer/index.js';
import { formatError, isCompilerError } from '../errors/index.js';
import { VitePluginConfig } from '../constants/index.js';

export type EffusePluginOptions = Partial<CompilerConfig>;

const shouldProcess = (id: string, config: CompilerConfig): boolean => {
	const hasValidExtension = config.extensions.some((ext) => id.endsWith(ext));
	if (!hasValidExtension) return false;

	const isExcluded = config.exclude.some((pattern) => id.includes(pattern));
	if (isExcluded) return false;

	return true;
};

export const effuse = (options: EffusePluginOptions = {}): Plugin => {
	const config = mergeConfig({ ...defaultConfig, ...options });

	let isDebug = config.debug;

	return {
		name: VitePluginConfig.NAME,
		enforce: VitePluginConfig.ENFORCE,

		configResolved(resolvedConfig) {
			if (
				options.debug === undefined &&
				resolvedConfig.mode === 'development'
			) {
				isDebug = true;
			}
		},

		transform(code: string, id: string): ViteTransformResult | null {
			if (!shouldProcess(id, config)) {
				return null;
			}

			const hasAccessor = config.signalAccessors.some((acc) =>
				code.includes(acc)
			);
			if (!hasAccessor) {
				return null;
			}

			const program = pipe(
				transform(code, id, config),
				Effect.provide(TransformerLive),
				Effect.match({
					onSuccess: (result) => {
						if (isDebug && result.transformed) {
							const cacheStatus = result.cached ? ' (cached)' : '';
							console.log(
								`[effuse] Transformed ${id}${cacheStatus}: ` +
									`${result.stats.expressionsWrapped} expressions, ` +
									`${result.stats.propsWrapped} props wrapped`
							);
						}
						return result;
					},
					onFailure: (error) => {
						const message = isCompilerError(error)
							? formatError(error)
							: String(error);
						console.error(`[effuse] Transform error: ${message}`);
						return null;
					},
				})
			);

			const result = Effect.runSync(program);

			if (!result || !result.transformed) {
				return null;
			}

			return {
				code: result.code,
				map: result.map as ViteTransformResult['map'],
			};
		},
	};
};

export default effuse;
