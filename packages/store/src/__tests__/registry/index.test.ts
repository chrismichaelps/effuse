import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerStore,
	getStore,
	hasStore,
	removeStore,
	clearStores,
	getStoreNames,
} from '../../registry/index.js';
import { createStore } from '../../core/store.js';
import { StoreNotFoundError } from '../../errors.js';

describe('registry', () => {
	beforeEach(() => {
		clearStores();
	});

	it('should register and get stores', () => {
		const store = createStore('reg1', { count: 0 });
		registerStore('reg1', store);
		expect(hasStore('reg1')).toBe(true);
		expect(getStore('reg1')).toBe(store);
	});

	it('should throw for missing stores', () => {
		expect(() => getStore('missing')).toThrow(StoreNotFoundError);
	});

	it('should remove stores', () => {
		const store = createStore('reg2', { count: 0 });
		registerStore('reg2', store);
		expect(removeStore('reg2')).toBe(true);
		expect(hasStore('reg2')).toBe(false);
	});

	it('should clear all stores', () => {
		registerStore('a', createStore('a', { x: 1 }));
		registerStore('b', createStore('b', { y: 2 }));
		clearStores();
		expect(getStoreNames()).toEqual([]);
	});

	it('should list store names', () => {
		registerStore('a', createStore('a', { x: 1 }));
		registerStore('b', createStore('b', { y: 2 }));
		const names = getStoreNames();
		expect(names).toContain('a');
		expect(names).toContain('b');
	});
});
