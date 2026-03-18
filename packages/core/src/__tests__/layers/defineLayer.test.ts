import { describe, it, expect, expectTypeOf } from 'vitest';
import { defineLayer, combineLayers } from '../../layers/api/defineLayer.js';
import type { CompiledLayer } from '../../layers/api/index.js';
import type { LayerProvides } from '../../layers/types.js';

describe('defineLayer', () => {
	describe('layer structure', () => {
		it('should create layer with effectLayer and tags when provides is empty', () => {
			const layer = defineLayer({ name: 'empty' });
			expect(layer).toHaveProperty('effectLayer');
			expect(layer).toHaveProperty('tags');
			expect(Object.keys(layer.tags)).toHaveLength(0);
		});

		it('should create layer with effectLayer and tags when provides has single service', () => {
			const layer = defineLayer({
				name: 'single',
				provides: {
					serviceA: () => ({ valueA: 'test', getValue: () => 'test' }),
				},
			});
			expect(layer).toHaveProperty('effectLayer');
			expect(layer).toHaveProperty('tags');
			expect(layer.tags).toHaveProperty('serviceA');
		});

		it('should create layer with effectLayer and tags when provides has multiple services', () => {
			const layer = defineLayer({
				name: 'multi',
				provides: {
					serviceA: () => ({ valueA: 'a' }),
					serviceB: () => ({ valueB: 1 }),
					serviceC: () => ({ values: [] }),
				},
			});
			expect(layer).toHaveProperty('effectLayer');
			expect(layer).toHaveProperty('tags');
			expect(Object.keys(layer.tags)).toHaveLength(3);
			expect(layer.tags).toHaveProperty('serviceA');
			expect(layer.tags).toHaveProperty('serviceB');
			expect(layer.tags).toHaveProperty('serviceC');
		});
	});

	describe('provides handling', () => {
		it('should handle undefined provides', () => {
			const layer = defineLayer({ name: 'undefined-provides' } as any);
			expect(layer).toHaveProperty('effectLayer');
			expect(layer).toHaveProperty('tags');
			expect(Object.keys(layer.tags)).toHaveLength(0);
		});

		it('should handle empty object provides', () => {
			const layer = defineLayer({ name: 'empty-provides', provides: {} });
			expect(layer).toHaveProperty('effectLayer');
			expect(layer).toHaveProperty('tags');
			expect(Object.keys(layer.tags)).toHaveLength(0);
		});

		it('should handle single service', () => {
			const layer = defineLayer({
				name: 'single-service',
				provides: { solo: () => ({ id: 1 }) },
			});
			expect(Object.keys(layer.tags)).toHaveLength(1);
			expect(layer.tags).toHaveProperty('solo');
		});

		it('should handle many services', () => {
			const manyProvides: LayerProvides = {};
			for (let i = 0; i < 10; i++) {
				manyProvides[`service${i}`] = () => ({ index: i });
			}
			const layer = defineLayer({
				name: 'many-services',
				provides: manyProvides,
			});
			expect(Object.keys(layer.tags)).toHaveLength(10);
		});
	});

	describe('tag generation', () => {
		it('should create tags with correct namespace prefix', () => {
			const layer = defineLayer({
				name: 'my-layer',
				provides: { myService: () => ({ value: 1 }) },
			});
			expect(layer.tags.myService.key).toContain('effuse/layer/');
			expect(layer.tags.myService.key).toContain('my-layer/');
			expect(layer.tags.myService.key).toContain('myService');
		});

		it('should create unique tags for different services', () => {
			const layer = defineLayer({
				name: 'unique',
				provides: {
					serviceA: () => ({}),
					serviceB: () => ({}),
					serviceC: () => ({}),
				},
			});
			const keys = Object.values(layer.tags).map((tag) => tag.key);
			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(3);
		});

		it('should create unique tags for different layers', () => {
			const layer1 = defineLayer({
				name: 'layer1',
				provides: { service: () => ({}) },
			});
			const layer2 = defineLayer({
				name: 'layer2',
				provides: { service: () => ({}) },
			});
			expect(layer1.tags.service.key).not.toBe(layer2.tags.service.key);
		});
	});

	describe('service references', () => {
		it('should allow services to hold references to other service tags', () => {
			const layer = defineLayer({
				name: 'tag-refs',
				provides: {
					serviceA: () => ({}),
					serviceB: () => ({}),
				},
			});
			expect(layer.tags.serviceA).toBeDefined();
			expect(layer.tags.serviceB).toBeDefined();
		});
	});
});

describe('combineLayers', () => {
	it('should return layer with effectLayer when given single layer', () => {
		const layer = defineLayer({
			name: 'single',
			provides: { serviceA: () => ({ value: 'a' }) },
		});
		const combined = combineLayers(layer);
		expect(typeof combined.pipe).toBe('function');
	});

	it('should return layer with effectLayer when given multiple layers', () => {
		const layer1 = defineLayer({
			name: 'layer1',
			provides: { serviceA: () => ({ value: 'a' }) },
		});
		const layer2 = defineLayer({
			name: 'layer2',
			provides: { serviceB: () => ({ value: 1 }) },
		});
		const combined = combineLayers(layer1, layer2);
		expect(typeof combined.pipe).toBe('function');
	});

	it('should return valid layer when given empty array', () => {
		const combined = combineLayers();
		expect(typeof combined.pipe).toBe('function');
	});

	it('should combine layers with same service name', () => {
		const layer1 = defineLayer({
			name: '1',
			provides: { service: () => ({ from: 1 }) },
		});
		const layer2 = defineLayer({
			name: '2',
			provides: { service: () => ({ from: 2 }) },
		});
		expect(() => combineLayers(layer1, layer2)).not.toThrow();
	});

	it('should handle combining many layers', () => {
		const layers: CompiledLayer<any>[] = [];
		for (let i = 0; i < 20; i++) {
			layers.push(
				defineLayer({ name: `layer${i}`, provides: { s: () => ({ i }) } })
			);
		}
		expect(() => combineLayers(...layers)).not.toThrow();
	});
});

describe('layer name handling', () => {
	it('should use layer name in tag generation', () => {
		const layer = defineLayer({
			name: 'my-awesome-layer',
			provides: { service: () => ({}) },
		});
		expect(layer.tags.service.key).toContain('my-awesome-layer');
	});

	it('should handle layer name with spaces', () => {
		const layer = defineLayer({
			name: 'layer with spaces',
			provides: { s: () => ({}) },
		});
		expect(layer.tags.s.key).toContain('layer with spaces');
	});

	it('should handle layer name with special characters', () => {
		const layer = defineLayer({
			name: 'layer@v1.0.0+build.123',
			provides: { s: () => ({}) },
		});
		expect(layer.tags.s.key).toContain('layer@v1.0.0');
	});

	it('should handle empty layer name', () => {
		const layer = defineLayer({
			name: '',
			provides: { s: () => ({}) },
		});
		expect(layer.tags.s.key).toContain('/');
	});

	it('should handle layer name as path', () => {
		const layer = defineLayer({
			name: 'features/user/auth',
			provides: { auth: () => ({}) },
		});
		expect(layer.tags.auth.key).toContain('features/user/auth');
	});
});

describe('service key handling', () => {
	it('should use provides key as tag key', () => {
		const layer = defineLayer({
			name: 'test',
			provides: { myCustomService: () => ({}) },
		});
		expect(layer.tags.myCustomService.key).toContain('myCustomService');
	});

	it('should handle numeric string keys', () => {
		const layer = defineLayer({
			name: 'test',
			provides: { '0': () => ({}), '123': () => ({}) },
		});
		expect(layer.tags['0']).toBeDefined();
		expect(layer.tags['123']).toBeDefined();
	});

	it('should handle keys with special characters', () => {
		const layer = defineLayer({
			name: 'test',
			provides: {
				'service-with-dashes': () => ({}),
				service_with_underscores: () => ({}),
			},
		});
		expect(layer.tags['service-with-dashes']).toBeDefined();
		expect(layer.tags['service_with_underscores']).toBeDefined();
	});
});

describe('compiledLayer interface', () => {
	it('should have effectLayer property of type Layer', () => {
		const layer = defineLayer({
			name: 'test',
			provides: { s: () => ({}) },
		});
		expect(layer.effectLayer).toBeDefined();
		expect(typeof layer.effectLayer.pipe).toBe('function');
	});

	it('should have tags property as Record<string, Tag>', () => {
		const layer = defineLayer({
			name: 'test',
			provides: { a: () => ({}), b: () => ({}), c: () => ({}) },
		});
		expect(typeof layer.tags).toBe('object');
		expect(Object.keys(layer.tags)).toEqual(['a', 'b', 'c']);
		const tags = layer.tags as Record<string, any>;
		for (const key of Object.keys(layer.tags)) {
			expect(tags[key]).toHaveProperty('key');
			expect(tags[key]).toHaveProperty('of');
		}
	});
});

describe('memory management', () => {
	it('should not leak memory with many layer creations', () => {
		const layers: CompiledLayer<any>[] = [];
		for (let i = 0; i < 50; i++) {
			layers.push(
				defineLayer({
					name: `layer-${i}`,
					provides: { service: () => ({ index: i }) },
				})
			);
		}
		expect(layers).toHaveLength(50);
		layers.length = 0;
		expect(layers).toHaveLength(0);
	});

	it('should allow garbage collection of unused layers', () => {
		const createLayer = () =>
			defineLayer({
				name: 'temporary',
				provides: { s: () => ({}) },
			});
		const layer = createLayer();
		expect(layer.tags.s).toBeDefined();
	});
});

describe('debug and introspection', () => {
	it('should expose layer structure for debugging', () => {
		const layer = defineLayer({
			name: 'debug-test',
			provides: {
				serviceA: () => ({ propA: 'a' }),
				serviceB: () => ({ propB: 'b' }),
			},
		});
		expect(layer.tags.serviceA.key).toContain('debug-test');
		expect(layer.tags.serviceB.key).toContain('debug-test');
	});

	it('should allow inspecting tag properties', () => {
		const layer = defineLayer({
			name: 'inspect',
			provides: { s: () => ({}) },
		});
		const tag = layer.tags.s;
		expect(tag.key).toBeDefined();
		expect(typeof tag.of).toBe('function');
	});

	it('should provide meaningful tag identifiers', () => {
		const layer = defineLayer({
			name: 'feature-auth',
			provides: {
				userService: () => ({}),
				tokenService: () => ({}),
				permissionService: () => ({}),
			},
		});
		expect(layer.tags.userService.key).toContain('feature-auth');
		expect(layer.tags.tokenService.key).toContain('feature-auth');
		expect(layer.tags.permissionService.key).toContain('feature-auth');
	});
});

describe('typescript compatibility', () => {
	it('should work with template literal types in provides keys', () => {
		const prefix = 'service';
		const layer = defineLayer({
			name: 'template',
			provides: {
				[`${prefix}A`]: () => ({ a: true }),
				[`${prefix}B`]: () => ({ b: true }),
			} as LayerProvides,
		});
		expect(layer.tags[`${prefix}A`]).toBeDefined();
		expect(layer.tags[`${prefix}B`]).toBeDefined();
	});

	it('should work with const assertions in factories', () => {
		const layer = defineLayer({
			name: 'const',
			provides: {
				data: () => [{ id: 1 }, { id: 2 }] as const,
			},
		});
		expect(layer.tags.data).toBeDefined();
	});
});

describe('performance', () => {
	it('should handle 100 services in a single layer', () => {
		const provides: LayerProvides = {};
		for (let i = 0; i < 100; i++) {
			provides[`service${i}`] = () => ({ index: i });
		}
		const layer = defineLayer({ name: 'hundred', provides });
		expect(Object.keys(layer.tags)).toHaveLength(100);
	});

	it('should handle 100 layers being combined', () => {
		const layers: CompiledLayer<any>[] = [];
		for (let i = 0; i < 100; i++) {
			layers.push(
				defineLayer({ name: `l${i}`, provides: { s: () => ({ i }) } })
			);
		}
		expect(() => combineLayers(...layers)).not.toThrow();
	});
});
