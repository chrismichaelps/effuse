/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { defaultConfig, mergeConfig } from '../config/index.js';

describe('config', () => {
	describe('defaultConfig', () => {
		it('should have sensible defaults', () => {
			expect(defaultConfig.autoUnwrap).toBe(true);
			expect(defaultConfig.autoUnwrapProps).toBe(true);
			expect(defaultConfig.sourceMaps).toBe(true);
			expect(defaultConfig.debug).toBe(false);
			expect(defaultConfig.enableCache).toBe(true);
			expect(defaultConfig.extensions).toEqual(['.tsx', '.jsx']);
			expect(defaultConfig.exclude).toEqual(['node_modules', 'dist']);
			expect(defaultConfig.signalAccessors).toEqual(['.value']);
			// `on` only, matching the runtime. `handle` made the compiler skip props
			// the runtime then applied as ordinary ones, so they never updated.
			expect(defaultConfig.eventHandlerPrefixes).toEqual(['on']);
		});
	});

	describe('mergeConfig', () => {
		it('should override defaults', () => {
			const config = mergeConfig({ autoUnwrap: false });
			expect(config.autoUnwrap).toBe(false);
			expect(config.autoUnwrapProps).toBe(true); // unchanged
		});

		it('should merge arrays', () => {
			const config = mergeConfig({
				signalAccessors: ['.current'],
			});
			expect(config.signalAccessors).toEqual(['.current']);
		});

		it('should accept empty object', () => {
			const config = mergeConfig({});
			expect(config).toEqual(defaultConfig);
		});
	});

});
