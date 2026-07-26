/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { useLayerService } from '../../blueprint/hooks.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { runWithLayerContext } from '../../layers/context.js';
import { ServiceNotFoundError } from '../../layers/errors.js';
import type { PropsRegistry } from '../../layers/services/PropsService.js';
import type { LayerRegistry } from '../../layers/services/RegistryService.js';

describe('useLayerService', () => {
	it('should return a service when layer runtime is initialized', () => {
		const authSvc = { login: () => 'ok' };

		const authLayer = defineLayer({
			name: 'auth',
			provides: { authSvc: () => authSvc },
		});

		const layerRegistry = {
			getLayer: () => undefined,
			getService: (key: string) => (key === 'authSvc' ? authSvc : undefined),
			getComponent: () => undefined,
		} as unknown as LayerRegistry;

		const propsRegistry = {} as unknown as PropsRegistry;

		const result = runWithLayerContext(
			{ propsRegistry, layerRegistry, layers: [] },
			() => useLayerService(authLayer, 'authSvc')
		);

		expect(result).toBe(authSvc);
	});

	it('should reject service keys that are not provided by the layer', () => {
		const authLayer = defineLayer({
			name: 'auth',
			provides: {},
		});

		const layerRegistry = {
			getLayer: () => undefined,
			getService: () => undefined,
			getComponent: () => undefined,
		} as unknown as LayerRegistry;

		const propsRegistry = {} as unknown as PropsRegistry;
		const unsafeUseLayerService = useLayerService as unknown as (
			layer: typeof authLayer,
			key: string
		) => unknown;

		expect(() =>
			runWithLayerContext(
				{ propsRegistry, layerRegistry, layers: [] },
				() => unsafeUseLayerService(authLayer, 'missing')
			)
		).toThrow(ServiceNotFoundError);
	});

	it('should reject declared services missing from the active runtime', () => {
		const authLayer = defineLayer({
			name: 'auth',
			provides: { authSvc: () => ({ login: () => 'ok' }) },
		});

		const layerRegistry = {
			getLayer: () => undefined,
			getService: () => undefined,
			getComponent: () => undefined,
		} as unknown as LayerRegistry;

		const propsRegistry = {} as unknown as PropsRegistry;

		expect(() =>
			runWithLayerContext(
				{ propsRegistry, layerRegistry, layers: [] },
				() => useLayerService(authLayer, 'authSvc')
			)
		).toThrow(ServiceNotFoundError);
	});
});
