import { describe, it, expect, vi, afterEach } from 'vitest';
import { addSubscriber } from './subscriptions.js';
import type { QueryHandlerDeps, QueryCacheInternals } from './types.js';

const createMockDeps = (): QueryHandlerDeps => {
	const internals: QueryCacheInternals = {
		cache: new Map(),
		subscribers: new Map(),
		gcTimers: new Map(),
	};
	return {
		internals,
		config: {
			staleTimeMs: 5000,
			gcTimeMs: 30000,
		},
	};
};

describe('query subscriptions handlers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('addSubscriber', () => {
		it('should add subscriber for new key', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			addSubscriber(deps, { keyStr: 'key1', callback });
			const subs = deps.internals.subscribers.get('key1');
			expect(subs?.has(callback)).toBe(true);
		});

		it('should create subscriber set for new key', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			addSubscriber(deps, { keyStr: 'newKey', callback });
			expect(deps.internals.subscribers.has('newKey')).toBe(true);
		});

		it('should add to existing subscriber set', () => {
			const deps = createMockDeps();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			addSubscriber(deps, { keyStr: 'key1', callback: cb1 });
			addSubscriber(deps, { keyStr: 'key1', callback: cb2 });
			const subs = deps.internals.subscribers.get('key1');
			expect(subs?.size).toBe(2);
		});

		it('should return unsubscribe function', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(deps, { keyStr: 'key1', callback });
			expect(typeof unsubscribe).toBe('function');
		});

		it('should remove subscriber when unsubscribe is called', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(deps, { keyStr: 'key1', callback });
			unsubscribe();
			const subs = deps.internals.subscribers.get('key1');
			expect(subs?.has(callback)).toBeUndefined(); // Map entry deleted if empty
		});

		it('should delete map entry when last subscriber unsubscribes', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(deps, { keyStr: 'key1', callback });
			unsubscribe();
			expect(deps.internals.subscribers.has('key1')).toBe(false);
		});

		it('should handle multiple keys independently', () => {
			const deps = createMockDeps();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			addSubscriber(deps, { keyStr: 'a', callback: cb1 });
			addSubscriber(deps, { keyStr: 'b', callback: cb2 });
			expect(deps.internals.subscribers.get('a')?.size).toBe(1);
			expect(deps.internals.subscribers.get('b')?.size).toBe(1);
		});
	});
});
