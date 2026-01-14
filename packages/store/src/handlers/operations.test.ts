import { describe, it, expect, vi } from 'vitest';
import { signal } from '@effuse/core';
import {
	setValue,
	resetState,
	batchUpdates,
	updateState,
	getSnapshot,
} from './operations.js';
import type { StoreHandlerDeps, StoreInternals } from './types.js';
import { createCancellationScope } from '../actions/cancellation.js';
import { createAtomicState } from '../core/state.js';
import { createMiddlewareManager } from '../middleware/index.js';
import { createMemoryAdapter } from '../persistence/adapters.js';

const createMockDeps = (
	initialState: Record<string, unknown> = {}
): StoreHandlerDeps => {
	const signalMap = new Map<string, ReturnType<typeof signal>>();
	for (const [key, value] of Object.entries(initialState)) {
		signalMap.set(key, signal(value));
	}

	const internals: StoreInternals = {
		signalMap,
		initialState: { ...initialState },
		actions: {},
		subscribers: new Set(),
		keySubscribers: new Map(),
		computedSelectors: new Map(),
		isBatching: false,
		cancellationScope: createCancellationScope(),
		pendingActions: new Map(),
	};

	return {
		internals,
		atomicState: createAtomicState(initialState),
		middlewareManager: createMiddlewareManager(),
		config: {
			name: 'testStore',
			shouldPersist: false,
			storageKey: 'test_store',
			enableDevtools: false,
			adapter: createMemoryAdapter(),
		},
	};
};

describe('operations handlers', () => {
	describe('setValue', () => {
		it('should set a value in the signal map', () => {
			const deps = createMockDeps({ count: 0 });
			setValue(deps, { prop: 'count', value: 5 });
			expect(deps.internals.signalMap.get('count')?.value).toBe(5);
		});

		it('should create new signal for non-existent property', () => {
			const deps = createMockDeps({});
			setValue(deps, { prop: 'newProp', value: 'hello' });
			expect(deps.internals.signalMap.get('newProp')?.value).toBe('hello');
		});

		it('should notify subscribers after value change', () => {
			const deps = createMockDeps({ count: 0 });
			const subscriber = vi.fn();
			deps.internals.subscribers.add(subscriber);
			setValue(deps, { prop: 'count', value: 10 });
			expect(subscriber).toHaveBeenCalled();
		});

		it('should notify key subscribers with new value', () => {
			const deps = createMockDeps({ count: 0 });
			const keySubscriber = vi.fn();
			deps.internals.keySubscribers.set('count', new Set([keySubscriber]));
			setValue(deps, { prop: 'count', value: 42 });
			expect(keySubscriber).toHaveBeenCalledWith(42);
		});

		it('should NOT notify subscribers when batching', () => {
			const deps = createMockDeps({ count: 0 });
			deps.internals.isBatching = true;
			const subscriber = vi.fn();
			deps.internals.subscribers.add(subscriber);
			setValue(deps, { prop: 'count', value: 5 });
			expect(subscriber).not.toHaveBeenCalled();
		});

		it('should handle setting undefined value', () => {
			const deps = createMockDeps({ count: 0 });
			setValue(deps, { prop: 'count', value: undefined });
			expect(deps.internals.signalMap.get('count')?.value).toBe(undefined);
		});

		it('should handle setting null value', () => {
			const deps = createMockDeps({ name: 'test' });
			setValue(deps, { prop: 'name', value: null });
			expect(deps.internals.signalMap.get('name')?.value).toBe(null);
		});

		it('should handle complex object values', () => {
			const deps = createMockDeps({ user: null });
			const complexValue = { id: 1, nested: { a: [1, 2, 3] } };
			setValue(deps, { prop: 'user', value: complexValue });
			expect(deps.internals.signalMap.get('user')?.value).toEqual(complexValue);
		});
	});

	describe('resetState', () => {
		it('should reset all values to initial state', () => {
			const deps = createMockDeps({ count: 0, name: 'initial' });
			setValue(deps, { prop: 'count', value: 100 });
			setValue(deps, { prop: 'name', value: 'changed' });
			resetState(deps);
			expect(deps.internals.signalMap.get('count')?.value).toBe(0);
			expect(deps.internals.signalMap.get('name')?.value).toBe('initial');
		});

		it('should notify subscribers after reset', () => {
			const deps = createMockDeps({ count: 0 });
			const subscriber = vi.fn();
			deps.internals.subscribers.add(subscriber);
			setValue(deps, { prop: 'count', value: 50 });
			subscriber.mockClear();
			resetState(deps);
			expect(subscriber).toHaveBeenCalled();
		});

		it('should handle empty initial state', () => {
			const deps = createMockDeps({});
			expect(() => resetState(deps)).not.toThrow();
		});
	});

	describe('batchUpdates', () => {
		it('should batch multiple updates without intermediate notifications', () => {
			const deps = createMockDeps({ a: 0, b: 0 });
			const subscriber = vi.fn();
			deps.internals.subscribers.add(subscriber);
			batchUpdates(deps, () => {
				setValue(deps, { prop: 'a', value: 1 });
				setValue(deps, { prop: 'b', value: 2 });
			});
			expect(subscriber).toHaveBeenCalledTimes(1);
		});

		it('should execute all updates within batch', () => {
			const deps = createMockDeps({ a: 0, b: 0, c: 0 });
			batchUpdates(deps, () => {
				setValue(deps, { prop: 'a', value: 10 });
				setValue(deps, { prop: 'b', value: 20 });
				setValue(deps, { prop: 'c', value: 30 });
			});
			expect(deps.internals.signalMap.get('a')?.value).toBe(10);
			expect(deps.internals.signalMap.get('b')?.value).toBe(20);
			expect(deps.internals.signalMap.get('c')?.value).toBe(30);
		});

		it('should reset batching flag even if updates throw', () => {
			const deps = createMockDeps({ count: 0 });
			try {
				batchUpdates(deps, () => {
					setValue(deps, { prop: 'count', value: 5 });
					throw new Error('test error');
				});
			} catch {
				// Expected
			}
			expect(deps.internals.isBatching).toBe(false);
		});

		it('should handle nested batches correctly', () => {
			const deps = createMockDeps({ a: 0 });
			const subscriber = vi.fn();
			deps.internals.subscribers.add(subscriber);
			batchUpdates(deps, () => {
				setValue(deps, { prop: 'a', value: 1 });
				batchUpdates(deps, () => {
					setValue(deps, { prop: 'a', value: 2 });
				});
			});
			expect(deps.internals.signalMap.get('a')?.value).toBe(2);
		});
	});

	describe('updateState', () => {
		it('should update state via draft function', () => {
			const deps = createMockDeps({ count: 0, items: [] });
			updateState(deps, {
				updater: (draft) => {
					draft.count = 10;
				},
			});
			expect(deps.internals.signalMap.get('count')?.value).toBe(10);
		});

		it('should handle multiple property updates', () => {
			const deps = createMockDeps({ a: 1, b: 2, c: 3 });
			updateState(deps, {
				updater: (draft) => {
					draft.a = 100;
					draft.b = 200;
					draft.c = 300;
				},
			});
			expect(deps.internals.signalMap.get('a')?.value).toBe(100);
			expect(deps.internals.signalMap.get('b')?.value).toBe(200);
			expect(deps.internals.signalMap.get('c')?.value).toBe(300);
		});
	});

	describe('getSnapshot', () => {
		it('should return snapshot of current state', () => {
			const deps = createMockDeps({ count: 5, name: 'test' });
			const snapshot = getSnapshot(deps.internals.signalMap);
			expect(snapshot).toEqual({ count: 5, name: 'test' });
		});

		it('should return empty object for empty state', () => {
			const deps = createMockDeps({});
			const snapshot = getSnapshot(deps.internals.signalMap);
			expect(snapshot).toEqual({});
		});

		it('should return copy not reference', () => {
			const deps = createMockDeps({ items: [1, 2, 3] });
			const snapshot1 = getSnapshot(deps.internals.signalMap);
			const snapshot2 = getSnapshot(deps.internals.signalMap);
			expect(snapshot1).not.toBe(snapshot2);
		});
	});
});
