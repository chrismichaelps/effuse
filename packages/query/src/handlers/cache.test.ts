import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	getEntry,
	setEntry,
	removeEntry,
	hasEntry,
	clearCache,
	getQueryKeys,
	isStale,
} from './cache.js';
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

const createEntry = <T>(
	data: T,
	status: 'success' | 'error' = 'success'
): CacheEntry<T> => ({
	data,
	dataUpdatedAt: Date.now(),
	status,
	fetchCount: 1,
});

describe('cache handlers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('getEntry', () => {
		it('should return entry for existing key', () => {
			const deps = createMockDeps();
			const entry = createEntry({ id: 1 });
			deps.internals.cache.set('key1', entry);
			const result = getEntry(deps, { keyStr: 'key1' });
			expect(result).toEqual(entry);
		});

		it('should return undefined for non-existent key', () => {
			const deps = createMockDeps();
			const result = getEntry(deps, { keyStr: 'missing' });
			expect(result).toBeUndefined();
		});

		it('should handle empty keyStr', () => {
			const deps = createMockDeps();
			const entry = createEntry('test');
			deps.internals.cache.set('', entry);
			expect(getEntry(deps, { keyStr: '' })).toEqual(entry);
		});
	});

	describe('setEntry', () => {
		it('should add entry to cache', () => {
			const deps = createMockDeps();
			const entry = createEntry({ id: 1 });
			setEntry(deps, { keyStr: 'key1', entry });
			expect(deps.internals.cache.get('key1')).toEqual(entry);
		});

		it('should overwrite existing entry', () => {
			const deps = createMockDeps();
			const oldEntry = createEntry({ id: 1 });
			const newEntry = createEntry({ id: 2 });
			setEntry(deps, { keyStr: 'key1', entry: oldEntry });
			setEntry(deps, { keyStr: 'key1', entry: newEntry });
			expect(deps.internals.cache.get('key1')).toEqual(newEntry);
		});

		it('should notify subscribers', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			deps.internals.subscribers.set('key1', new Set([callback]));
			const entry = createEntry({ id: 1 });
			setEntry(deps, { keyStr: 'key1', entry });
			expect(callback).toHaveBeenCalled();
		});

		it('should schedule garbage collection', () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			const entry = createEntry({ id: 1 });
			setEntry(deps, { keyStr: 'key1', entry });
			expect(deps.internals.gcTimers.has('key1')).toBe(true);
		});
	});

	describe('removeEntry', () => {
		it('should remove entry and return true', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('data'));
			const result = removeEntry(deps, { keyStr: 'key1' });
			expect(result).toBe(true);
			expect(deps.internals.cache.has('key1')).toBe(false);
		});

		it('should return false for non-existent key', () => {
			const deps = createMockDeps();
			const result = removeEntry(deps, { keyStr: 'missing' });
			expect(result).toBe(false);
		});

		it('should clear GC timer', () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('data'));
			deps.internals.gcTimers.set(
				'key1',
				setTimeout(() => {}, 1000)
			);
			removeEntry(deps, { keyStr: 'key1' });
			expect(deps.internals.gcTimers.has('key1')).toBe(false);
		});

		it('should notify subscribers', () => {
			const deps = createMockDeps();
			const callback = vi.fn();
			deps.internals.cache.set('key1', createEntry('data'));
			deps.internals.subscribers.set('key1', new Set([callback]));
			removeEntry(deps, { keyStr: 'key1' });
			expect(callback).toHaveBeenCalled();
		});
	});

	describe('hasEntry', () => {
		it('should return true for existing entry', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('data'));
			expect(hasEntry(deps, { keyStr: 'key1' })).toBe(true);
		});

		it('should return false for non-existent entry', () => {
			const deps = createMockDeps();
			expect(hasEntry(deps, { keyStr: 'missing' })).toBe(false);
		});
	});

	describe('clearCache', () => {
		it('should remove all entries', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.cache.set('c', createEntry(3));
			clearCache(deps);
			expect(deps.internals.cache.size).toBe(0);
		});

		it('should clear all GC timers', () => {
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
			clearCache(deps);
			expect(deps.internals.gcTimers.size).toBe(0);
		});

		it('should notify all subscribers', () => {
			const deps = createMockDeps();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.subscribers.set('a', new Set([cb1]));
			deps.internals.subscribers.set('b', new Set([cb2]));
			clearCache(deps);
			expect(cb1).toHaveBeenCalled();
			expect(cb2).toHaveBeenCalled();
		});

		it('should handle empty cache', () => {
			const deps = createMockDeps();
			expect(() => clearCache(deps)).not.toThrow();
		});
	});

	describe('getQueryKeys', () => {
		it('should return all cache keys', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('a', createEntry(1));
			deps.internals.cache.set('b', createEntry(2));
			deps.internals.cache.set('c', createEntry(3));
			const keys = getQueryKeys(deps);
			expect(keys).toHaveLength(3);
			expect(keys).toContain('a');
			expect(keys).toContain('b');
			expect(keys).toContain('c');
		});

		it('should return empty array for empty cache', () => {
			const deps = createMockDeps();
			expect(getQueryKeys(deps)).toEqual([]);
		});
	});

	describe('isStale', () => {
		it('should return true for stale entries', () => {
			vi.useFakeTimers();
			const deps = createMockDeps();
			deps.internals.cache.set('key1', {
				data: 'test',
				dataUpdatedAt: Date.now() - 10000,
				status: 'success',
				fetchCount: 1,
			});
			expect(isStale(deps, { keyStr: 'key1' })).toBe(true);
		});

		it('should return false for fresh entries', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('key1', createEntry('fresh'));
			expect(isStale(deps, { keyStr: 'key1' })).toBe(false);
		});

		it('should return true for non-existent entries', () => {
			const deps = createMockDeps();
			expect(isStale(deps, { keyStr: 'missing' })).toBe(true);
		});

		it('should use custom staleTime when provided', () => {
			const deps = createMockDeps();
			deps.internals.cache.set('key1', {
				data: 'test',
				dataUpdatedAt: Date.now() - 100,
				status: 'success',
				fetchCount: 1,
			});
			expect(isStale(deps, { keyStr: 'key1' }, 50)).toBe(true);
			expect(isStale(deps, { keyStr: 'key1' }, 200)).toBe(false);
		});
	});
});
