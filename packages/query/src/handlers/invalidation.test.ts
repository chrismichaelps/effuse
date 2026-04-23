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
		it('should mark entry as invalidated without removing', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users",1]', createEntry({ id: 1 }));
			await Effect.runPromise(invalidateKey(deps, '["users",1]'));
			expect(deps.internals.cache.has('["users",1]')).toBe(true);
			const entry = deps.internals.cache.get('["users",1]');
			expect(entry?.isInvalidated).toBe(true);
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

		it('should reset GC timer when invalidating', async () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('data'));
			const oldTimer = setTimeout(() => {}, 1000);
			deps.internals.gcTimers.set('key1', oldTimer);
			await Effect.runPromise(invalidateKey(deps, 'key1'));
			// GC timer is reset by setEntry, not cleared
			expect(deps.internals.gcTimers.has('key1')).toBe(true);
			expect(deps.internals.gcTimers.get('key1')).not.toBe(oldTimer);
			vi.useRealTimers();
		});
	});

	describe('invalidatePattern', () => {
		it('should mark entries matching pattern prefix as invalidated', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users",1]', createEntry({ id: 1 }));
			deps.internals.cache.set('["users",2]', createEntry({ id: 2 }));
			deps.internals.cache.set('["posts",1]', createEntry({ id: 1 }));
			await Effect.runPromise(invalidatePattern(deps, { pattern: ['users'] }));
			expect(deps.internals.cache.get('["users",1]')?.isInvalidated).toBe(true);
			expect(deps.internals.cache.get('["users",2]')?.isInvalidated).toBe(true);
			expect(deps.internals.cache.get('["posts",1]')?.isInvalidated).toBeFalsy();
		});

		it('should match nested patterns', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["users","profile",1]', createEntry({}));
			deps.internals.cache.set('["users","settings",1]', createEntry({}));
			deps.internals.cache.set('["users","profile",2]', createEntry({}));
			await Effect.runPromise(
				invalidatePattern(deps, { pattern: ['users', 'profile'] })
			);
			expect(
				deps.internals.cache.get('["users","profile",1]')?.isInvalidated
			).toBe(true);
			expect(
				deps.internals.cache.get('["users","profile",2]')?.isInvalidated
			).toBe(true);
			expect(
				deps.internals.cache.get('["users","settings",1]')?.isInvalidated
			).toBeFalsy();
		});

		it('should handle empty pattern (matches all)', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('["a"]', createEntry(1));
			deps.internals.cache.set('["b"]', createEntry(2));
			await Effect.runPromise(invalidatePattern(deps, { pattern: [] }));
			expect(deps.internals.cache.size).toBe(2);
			expect(deps.internals.cache.get('["a"]')?.isInvalidated).toBe(true);
			expect(deps.internals.cache.get('["b"]')?.isInvalidated).toBe(true);
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
		it('should mark all entries as invalidated', async () => {
			const deps = createMockDeps();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.cache.set('c', createEntry(3));
			await Effect.runPromise(invalidateAll(deps));
			expect(deps.internals.cache.size).toBe(3);
			expect(deps.internals.cache.get('a')?.isInvalidated).toBe(true);
			expect(deps.internals.cache.get('b')?.isInvalidated).toBe(true);
			expect(deps.internals.cache.get('c')?.isInvalidated).toBe(true);
		});

		it('should reset GC timers rather than clear them', async () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			const oldTimerA = setTimeout(() => {}, 1000);
			const oldTimerB = setTimeout(() => {}, 1000);
			deps.internals.gcTimers.set('a', oldTimerA);
			deps.internals.gcTimers.set('b', oldTimerB);
			await Effect.runPromise(invalidateAll(deps));
			expect(deps.internals.gcTimers.size).toBe(2);
			expect(deps.internals.gcTimers.get('a')).not.toBe(oldTimerA);
			expect(deps.internals.gcTimers.get('b')).not.toBe(oldTimerB);
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
