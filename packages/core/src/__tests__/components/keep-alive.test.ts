import { describe, it, expect } from 'vitest';
import { KeepAlive, type KeepAliveNode } from '../../components/KeepAlive.js';
import { signal } from '../../reactivity/index.js';
import { createListNode } from '../../render/node.js';
import type { EffuseChild } from '../../render/node.js';
import { Effect } from 'effect';

interface MockComponent {
	readonly type: string;
}

const createMockComponent = (typeName: string): MockComponent => ({
	type: typeName,
});

describe('KeepAlive Component', () => {
	describe('Basic Rendering', () => {
		it('should render children correctly', () => {
			const child = createListNode([]) as unknown as EffuseChild;
			const node = KeepAlive({ children: child }) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node.children[0]).toBe(child);
		});

		it('should handle null children', () => {
			const currentChild = signal<EffuseChild | null>(null);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(0);
			expect(node._activeKey.value).toBe(null);
		});

		it('should handle undefined-like children gracefully', () => {
			const currentChild = signal<EffuseChild | null>(null);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toEqual([]);
			currentChild.value = createMockComponent(
				'Valid'
			) as unknown as EffuseChild;
			expect(node.children).toHaveLength(1);
		});
	});

	describe('Cache Operations', () => {
		it('should cache components based on key', () => {
			const component1 = createMockComponent(
				'ComponentA'
			) as unknown as EffuseChild;
			const component2 = createMockComponent(
				'ComponentB'
			) as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(component1);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children[0]).toBe(component1);
			expect(node._activeKey.value).toBe('ComponentA');

			currentChild.value = component2;
			expect(node.children[0]).toBe(component2);
			expect(node._activeKey.value).toBe('ComponentB');

			currentChild.value = component1;
			expect(node.children[0]).toBe(component1);

			expect(Effect.runSync(node._cache.size)).toBe(2);
		});

		it('should respect max capacity (LRU eviction)', () => {
			const componentA = createMockComponent('A') as unknown as EffuseChild;
			const componentB = createMockComponent('B') as unknown as EffuseChild;
			const componentC = createMockComponent('C') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(componentA);
			const node = KeepAlive({
				max: 2,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);

			currentChild.value = componentB;
			expect(node.children).toHaveLength(1);

			currentChild.value = componentC;
			expect(node.children).toHaveLength(1);

			expect(Effect.runSync(node._cache.size)).toBe(2);
			expect(Effect.runSync(node._cache.contains('C'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('B'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('A'))).toBe(false);
		});

		it('should handle max capacity of 1', () => {
			const componentA = createMockComponent('A') as unknown as EffuseChild;
			const componentB = createMockComponent('B') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(componentA);
			const node = KeepAlive({
				max: 1,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(Effect.runSync(node._cache.size)).toBe(1);

			currentChild.value = componentB;
			expect(node.children).toHaveLength(1);
			expect(Effect.runSync(node._cache.size)).toBe(1);
			expect(Effect.runSync(node._cache.contains('B'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('A'))).toBe(false);
		});

		it('should use default max capacity from CacheDefaults', () => {
			const currentChild = signal<EffuseChild>(
				createMockComponent('Test') as unknown as EffuseChild
			);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(Effect.runSync(node._cache.size)).toBe(1);
		});
	});

	describe('Include/Exclude Patterns', () => {
		it('should exclude components matching exclude pattern', () => {
			const included = createMockComponent(
				'IncludeMe'
			) as unknown as EffuseChild;
			const excluded = createMockComponent(
				'ExcludeMe'
			) as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(included);
			const node = KeepAlive({
				exclude: /Exclude/,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);

			currentChild.value = excluded;
			expect(node.children).toHaveLength(1);

			expect(Effect.runSync(node._cache.size)).toBe(1);
			expect(Effect.runSync(node._cache.contains('IncludeMe'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('ExcludeMe'))).toBe(false);
			expect(node._activeKey.value).toBe(null);
		});

		it('should include only components matching include pattern', () => {
			const allowed = createMockComponent(
				'AllowedItem'
			) as unknown as EffuseChild;
			const denied = createMockComponent(
				'DeniedItem'
			) as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(allowed);
			const node = KeepAlive({
				include: /Allowed/,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('AllowedItem');

			currentChild.value = denied;
			expect(node.children).toHaveLength(1);

			expect(Effect.runSync(node._cache.size)).toBe(1);
			expect(Effect.runSync(node._cache.contains('AllowedItem'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('DeniedItem'))).toBe(false);
		});

		it('should handle array-based exclude patterns', () => {
			const comp1 = createMockComponent('RouteA') as unknown as EffuseChild;
			const comp2 = createMockComponent('RouteB') as unknown as EffuseChild;
			const comp3 = createMockComponent('RouteC') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(comp1);
			const node = KeepAlive({
				exclude: ['RouteB', 'RouteC'],
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('RouteA');

			currentChild.value = comp2;
			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe(null);

			currentChild.value = comp3;
			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe(null);

			expect(Effect.runSync(node._cache.size)).toBe(1);
		});

		it('should handle array-based include patterns', () => {
			const comp1 = createMockComponent('Dashboard') as unknown as EffuseChild;
			const comp2 = createMockComponent('Settings') as unknown as EffuseChild;
			const comp3 = createMockComponent('Profile') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(comp1);
			const node = KeepAlive({
				include: ['Dashboard', 'Settings'],
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('Dashboard');

			currentChild.value = comp2;
			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('Settings');

			currentChild.value = comp3;
			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe(null);

			expect(Effect.runSync(node._cache.size)).toBe(2);
		});

		it('should prioritize exclude over include when both match', () => {
			const component = createMockComponent(
				'TestItem'
			) as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(component);
			const node = KeepAlive({
				include: /Test/,
				exclude: /Item/,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe(null);
			expect(Effect.runSync(node._cache.size)).toBe(0);
		});

		it('should cache all when no include/exclude specified', () => {
			const comp1 = createMockComponent('Any') as unknown as EffuseChild;
			const comp2 = createMockComponent('Random') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(comp1);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('Any');

			currentChild.value = comp2;
			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('Random');

			expect(Effect.runSync(node._cache.size)).toBe(2);
		});
	});

	describe('Rapid State Changes', () => {
		it('should handle rapid switching between two components', () => {
			const compA = createMockComponent('A') as unknown as EffuseChild;
			const compB = createMockComponent('B') as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(compA);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			for (let i = 0; i < 100; i++) {
				currentChild.value = i % 2 === 0 ? compA : compB;
				expect(node.children).toHaveLength(1);
			}

			expect(Effect.runSync(node._cache.size)).toBe(2);
		});

		it('should handle sequential component cycling', () => {
			const components = Array.from(
				{ length: 5 },
				(_, i) =>
					createMockComponent(`Comp${String(i)}`) as unknown as EffuseChild
			);

			const currentChild = signal<EffuseChild>(components[0]);
			const node = KeepAlive({
				max: 3,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			for (let cycle = 0; cycle < 3; cycle++) {
				for (const component of components) {
					currentChild.value = component;
					expect(node.children).toHaveLength(1);
				}
			}

			expect(Effect.runSync(node._cache.size)).toBe(3);
		});
	});

	describe('Component Key Extraction', () => {
		it('should handle components with nested type.name', () => {
			const component = {
				type: { name: 'NestedName' },
			} as unknown as EffuseChild;
			const currentChild = signal<EffuseChild>(component);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).toBe('NestedName');
		});

		it('should handle components without type property using generated keys', () => {
			const component = { data: 'someData' } as unknown as EffuseChild;
			const currentChild = signal<EffuseChild>(component);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			expect(node._activeKey.value).not.toBe(null);
			expect(typeof node._activeKey.value).toBe('string');
		});

		it('should generate timestamp-based keys for typeless components', () => {
			const comp1 = { data: 'first' } as unknown as EffuseChild;
			const comp2 = { data: 'second' } as unknown as EffuseChild;

			const currentChild = signal<EffuseChild>(comp1);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);
			const key1 = node._activeKey.value;
			expect(key1).not.toBe(null);

			currentChild.value = comp2;
			expect(node.children).toHaveLength(1);
			const key2 = node._activeKey.value;
			expect(key2).not.toBe(null);

			expect(Effect.runSync(node._cache.size)).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Scope and Cleanup', () => {
		it('should cleanup scope on destroy without throwing', () => {
			const child = createListNode([]) as unknown as EffuseChild;
			const node = KeepAlive({ children: child }) as unknown as KeepAliveNode;

			expect(node._cleanup).toBeDefined();
			expect(() => {
				node._cleanup();
			}).not.toThrow();
		});

		it('should be safe to call cleanup multiple times', () => {
			const child = createListNode([]) as unknown as EffuseChild;
			const node = KeepAlive({ children: child }) as unknown as KeepAliveNode;

			expect(() => {
				node._cleanup();
				node._cleanup();
				node._cleanup();
			}).not.toThrow();
		});
	});

	describe('Performance - O(1) Operations', () => {
		it('should use Effect.Cache for O(1) operations with large datasets', () => {
			const maxCapacity = 50;
			const totalComponents = 100;

			const components = Array.from(
				{ length: totalComponents },
				(_, i) =>
					createMockComponent(`Component${String(i)}`) as unknown as EffuseChild
			);

			const currentChild = signal<EffuseChild>(components[0]);
			const node = KeepAlive({
				max: maxCapacity,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			for (let i = 0; i < totalComponents; i++) {
				currentChild.value = components[i];
				expect(node.children).toHaveLength(1);
			}

			expect(Effect.runSync(node._cache.size)).toBe(maxCapacity);
			expect(Effect.runSync(node._cache.contains('Component99'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('Component50'))).toBe(true);
			expect(Effect.runSync(node._cache.contains('Component0'))).toBe(false);
		});

		it('should maintain consistent cache size under stress', () => {
			const maxCapacity = 10;
			const iterations = 1000;

			const currentChild = signal<EffuseChild>(
				createMockComponent('Init') as unknown as EffuseChild
			);
			const node = KeepAlive({
				max: maxCapacity,
				children: currentChild,
			}) as unknown as KeepAliveNode;

			for (let i = 0; i < iterations; i++) {
				currentChild.value = createMockComponent(
					`Stress${String(i)}`
				) as unknown as EffuseChild;
				expect(node.children).toHaveLength(1);
				expect(Effect.runSync(node._cache.size)).toBeLessThanOrEqual(
					maxCapacity
				);
			}
		});
	});

	describe('useKeepAliveContext', () => {
		it('should return context with activeKey and cacheSize', async () => {
			const { useKeepAliveContext } =
				await import('../../components/KeepAlive.js');

			const component = createMockComponent('Test') as unknown as EffuseChild;
			const currentChild = signal<EffuseChild>(component);
			const node = KeepAlive({
				children: currentChild,
			}) as unknown as KeepAliveNode;

			expect(node.children).toHaveLength(1);

			const context = useKeepAliveContext(node);

			expect(context.activeKey.value).toBe('Test');
			expect(context.cacheSize()).toBe(1);
		});

		it('should return default context for non-KeepAlive nodes', async () => {
			const { useKeepAliveContext } =
				await import('../../components/KeepAlive.js');

			const regularNode = createListNode([]);
			const context = useKeepAliveContext(regularNode);

			expect(context.activeKey.value).toBe(null);
			expect(context.cacheSize()).toBe(0);
		});
	});
});
