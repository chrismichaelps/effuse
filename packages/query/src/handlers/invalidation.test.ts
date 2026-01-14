import { describe, it, expect, vi, afterEach } from 'vitest';
import { Effect } from 'effect';
import {
	invalidateKey,
	invalidatePattern,
	invalidateAll,
} from './invalidation.js';
import type { QueryHandlerDeps, QueryCacheInternals } from './types.js';
import type { CacheEntry } from '../client/types.js';

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

const createEntry = <T>(data: T): CacheEntry<T> => ({
	data,
	dataUpdatedAt: Date.now(),
	status: 'success',
	fetchCount: 1,
});

describe('invalidation handlers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('invalidateKey', () => {
		it('should remove entry for exact key', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users",1]', createEntry({ id: 1 }));
			await Effect.runPromise(invalidateKey(deps, '["users",1]'));
			expect(deps.internals.cache.has('["users",1]')).toBe(false);
		});

		it('should notify subscribers', async () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			deps.internals.cache.set('key1', createEntry('data'));
			deps.internals.subscribers.set('key1', new Set([callback]));
			await Effect.runPromise(invalidateKey(deps, 'key1'));
			expect(callback).toHaveBeenCalled();
		});

		it('should handle non-existent key without error', async () => {
			const deps = createMockDeps();
			await expect(
				Effect.runPromise(invalidateKey(deps, 'missing'))
			).resolves.not.toThrow();
		});

		it('should clear GC timer when invalidating', async () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('data'));
			deps.internals.gcTimers.set(
				'key1',
				setTimeout(() => {}, 1000)
			);
			await Effect.runPromise(invalidateKey(deps, 'key1'));
			expect(deps.internals.gcTimers.has('key1')).toBe(false);
			vi.useRealTimers();
		});
	});

	describe('invalidatePattern', () => {
		it('should remove entries matching pattern prefix', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users",1]', createEntry({ id: 1 }));
			deps.internals.cache.set('["users",2]', createEntry({ id: 2 }));
			deps.internals.cache.set('["posts",1]', createEntry({ id: 1 }));
			await Effect.runPromise(invalidatePattern(deps, { pattern: ['users'] }));
			expect(deps.internals.cache.has('["users",1]')).toBe(false);
			expect(deps.internals.cache.has('["users",2]')).toBe(false);
			expect(deps.internals.cache.has('["posts",1]')).toBe(true);
		});

		it('should match nested patterns', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users","profile",1]', createEntry({}));
			deps.internals.cache.set('["users","settings",1]', createEntry({}));
			deps.internals.cache.set('["users","profile",2]', createEntry({}));
			await Effect.runPromise(
				invalidatePattern(deps, { pattern: ['users', 'profile'] })
			);
			expect(deps.internals.cache.has('["users","profile",1]')).toBe(false);
			expect(deps.internals.cache.has('["users","profile",2]')).toBe(false);
			expect(deps.internals.cache.has('["users","settings",1]')).toBe(true);
		});

		it('should handle empty pattern (matches none)', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["a"]', createEntry(1));
			deps.internals.cache.set('["b"]', createEntry(2));
			await Effect.runPromise(invalidatePattern(deps, { pattern: [] }));
			expect(deps.internals.cache.size).toBe(2);
		});

		it('should notify subscribers for each invalidated key', async () => {
			const deps = createMockDeps();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			deps.internals.cache.set('["users",1]', createEntry({}));
			deps.internals.cache.set('["users",2]', createEntry({}));
			deps.internals.subscribers.set('["users",1]', new Set([cb1]));
			deps.internals.subscribers.set('["users",2]', new Set([cb2]));
			await Effect.runPromise(invalidatePattern(deps, { pattern: ['users'] }));
			expect(cb1).toHaveBeenCalled();
			expect(cb2).toHaveBeenCalled();
		});

		it('should handle no matching entries', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["posts",1]', createEntry({}));
			await expect(
				Effect.runPromise(invalidatePattern(deps, { pattern: ['users'] }))
			).resolves.not.toThrow();
			expect(deps.internals.cache.size).toBe(1);
		});
	});

	describe('invalidateAll', () => {
		it('should remove all entries', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.cache.set('c', createEntry(3));
			await Effect.runPromise(invalidateAll(deps));
			expect(deps.internals.cache.size).toBe(0);
		});

		it('should clear all GC timers', async () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.gcTimers.set(
				'a',
				setTimeout(() => {}, 1000)
			);
			deps.internals.gcTimers.set(
				'b',
				setTimeout(() => {}, 1000)
			);
			await Effect.runPromise(invalidateAll(deps));
			expect(deps.internals.gcTimers.size).toBe(0);
			vi.useRealTimers();
		});

		it('should notify all subscribers', async () => {
			const deps = createMockDeps();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.subscribers.set('a', new Set([cb1]));
			deps.internals.subscribers.set('b', new Set([cb2]));
			await Effect.runPromise(invalidateAll(deps));
			expect(cb1).toHaveBeenCalled();
			expect(cb2).toHaveBeenCalled();
		});

		it('should handle empty cache', async () => {
			const deps = createMockDeps();
			await expect(
				Effect.runPromise(invalidateAll(deps))
			).resolves.not.toThrow();
		});
	});
});
