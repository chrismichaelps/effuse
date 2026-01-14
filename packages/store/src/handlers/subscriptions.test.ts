import { describe, it, expect, vi } from 'vitest';
import { addSubscriber, addKeySubscriber } from './subscriptions.js';
import type { StoreInternals } from './types.js';
import { createCancellationScope } from '../actions/cancellation.js';

const createMockInternals = (): StoreInternals => ({
	signalMap: new Map(),
	initialState: {},
	actions: {},
	subscribers: new Set(),
	keySubscribers: new Map(),
	computedSelectors: new Map(),
	isBatching: false,
	cancellationScope: createCancellationScope(),
	pendingActions: new Map(),
});

describe('subscriptions handlers', () => {
	describe('addSubscriber', () => {
		it('should add subscriber to the set', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			addSubscriber(internals, { callback });
			expect(internals.subscribers.has(callback)).toBe(true);
		});

		it('should return unsubscribe function', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(internals, { callback });
			expect(typeof unsubscribe).toBe('function');
		});

		it('should remove subscriber when unsubscribe is called', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(internals, { callback });
			unsubscribe();
			expect(internals.subscribers.has(callback)).toBe(false);
		});

		it('should handle multiple subscribers', () => {
			const internals = createMockInternals();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			const cb3 = vi.fn();
			addSubscriber(internals, { callback: cb1 });
			addSubscriber(internals, { callback: cb2 });
			addSubscriber(internals, { callback: cb3 });
			expect(internals.subscribers.size).toBe(3);
		});

		it('should handle unsubscribing multiple times without error', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			const unsubscribe = addSubscriber(internals, { callback });
			unsubscribe();
			unsubscribe();
			unsubscribe();
			expect(internals.subscribers.size).toBe(0);
		});

		it('should not affect other subscribers when one unsubscribes', () => {
			const internals = createMockInternals();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			const unsub1 = addSubscriber(internals, { callback: cb1 });
			addSubscriber(internals, { callback: cb2 });
			unsub1();
			expect(internals.subscribers.has(cb1)).toBe(false);
			expect(internals.subscribers.has(cb2)).toBe(true);
		});
	});

	describe('addKeySubscriber', () => {
		it('should add key subscriber for new key', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			addKeySubscriber(internals, { key: 'count', callback });
			const subs = internals.keySubscribers.get('count');
			expect(subs?.has(callback)).toBe(true);
		});

		it('should create subscriber set for new key', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			addKeySubscriber(internals, { key: 'newKey', callback });
			expect(internals.keySubscribers.has('newKey')).toBe(true);
		});

		it('should add to existing subscriber set', () => {
			const internals = createMockInternals();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			addKeySubscriber(internals, { key: 'count', callback: cb1 });
			addKeySubscriber(internals, { key: 'count', callback: cb2 });
			const subs = internals.keySubscribers.get('count');
			expect(subs?.size).toBe(2);
		});

		it('should return unsubscribe function', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			const unsubscribe = addKeySubscriber(internals, {
				key: 'count',
				callback,
			});
			expect(typeof unsubscribe).toBe('function');
		});

		it('should remove subscriber when unsubscribe is called', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			const unsubscribe = addKeySubscriber(internals, {
				key: 'count',
				callback,
			});
			unsubscribe();
			const subs = internals.keySubscribers.get('count');
			expect(subs?.has(callback)).toBe(false);
		});

		it('should handle different keys independently', () => {
			const internals = createMockInternals();
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			addKeySubscriber(internals, { key: 'a', callback: cb1 });
			addKeySubscriber(internals, { key: 'b', callback: cb2 });
			expect(internals.keySubscribers.get('a')?.size).toBe(1);
			expect(internals.keySubscribers.get('b')?.size).toBe(1);
		});

		it('should handle empty string key', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			addKeySubscriber(internals, { key: '', callback });
			expect(internals.keySubscribers.has('')).toBe(true);
		});

		it('should handle special characters in key', () => {
			const internals = createMockInternals();
			const callback = vi.fn();
			addKeySubscriber(internals, { key: 'user.profile.name', callback });
			expect(internals.keySubscribers.has('user.profile.name')).toBe(true);
		});
	});
});
