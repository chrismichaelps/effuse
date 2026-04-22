/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import type { Plugin, TransformResult as ViteTransformResult } from 'vite';

import {
	type CompilerConfig,
	mergeConfig,
	defaultConfig,
} from '../config/index.js';
import { transformSync } from '../transformer/index.js';
import { formatError, isCompilerError } from '../errors/index.js';
import { SourceCache } from '../services/source-cache.js';
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
	const cache = new SourceCache();
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

			try {
				const result = transformSync(code, id, config, cache);

				if (isDebug && result.transformed) {
					const cacheStatus = result.cached ? ' (cached)' : '';
					console.log(
						`[effuse] Transformed ${id}${cacheStatus}: ` +
							`${result.stats.expressionsWrapped} expressions, ` +
							`${result.stats.propsWrapped} props wrapped`
					);
				}

				if (!result.transformed) {
					return null;
				}

				return {
					code: result.code,
					map: result.map as ViteTransformResult['map'],
				};
			} catch (error) {
				const message = isCompilerError(error)
					? formatError(error)
					: String(error);
				console.error(`[effuse] Transform error: ${message}`);
				return null;
			}
		},
	};
};

export default effuse;
