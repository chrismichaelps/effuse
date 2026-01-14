import { describe, it, expect } from 'vitest';
import { Option } from 'effect';
import {
	getItem,
	setItem,
	removeItem,
	hasItem,
	clearStorage,
	getStorageKeys,
	getStorageSize,
} from './persistence.js';
import type { StorageHandlerDeps } from './persistence.js';

const createMockDeps = (
	initial: Record<string, string> = {}
): StorageHandlerDeps => {
	const storage = new Map<string, string>(Object.entries(initial));
	return { storage };
};

describe('persistence handlers', () => {
	describe('getItem', () => {
		it('should return Some for existing key', () => {
			const deps = createMockDeps({ key1: 'value1' });
			const result = getItem(deps, { key: 'key1' });
			expect(Option.isSome(result)).toBe(true);
			expect(Option.getOrNull(result)).toBe('value1');
		});

		it('should return None for non-existent key', () => {
			const deps = createMockDeps({});
			const result = getItem(deps, { key: 'missing' });
			expect(Option.isNone(result)).toBe(true);
		});

		it('should return empty string value correctly', () => {
			const deps = createMockDeps({ empty: '' });
			const result = getItem(deps, { key: 'empty' });
			expect(Option.isSome(result)).toBe(true);
			expect(Option.getOrNull(result)).toBe('');
		});

		it('should handle special characters in key', () => {
			const deps = createMockDeps({ 'key.with.dots': 'value' });
			const result = getItem(deps, { key: 'key.with.dots' });
			expect(Option.getOrNull(result)).toBe('value');
		});

		it('should handle unicode key', () => {
			const deps = createMockDeps({ 日本語: 'japanese' });
			const result = getItem(deps, { key: '日本語' });
			expect(Option.getOrNull(result)).toBe('japanese');
		});
	});

	describe('setItem', () => {
		it('should set value for new key', () => {
			const deps = createMockDeps({});
			setItem(deps, { key: 'newKey', value: 'newValue' });
			expect(deps.storage.get('newKey')).toBe('newValue');
		});

		it('should overwrite existing value', () => {
			const deps = createMockDeps({ key1: 'oldValue' });
			setItem(deps, { key: 'key1', value: 'newValue' });
			expect(deps.storage.get('key1')).toBe('newValue');
		});

		it('should handle empty string value', () => {
			const deps = createMockDeps({});
			setItem(deps, { key: 'key1', value: '' });
			expect(deps.storage.get('key1')).toBe('');
		});

		it('should handle very long values', () => {
			const deps = createMockDeps({});
			const longValue = 'x'.repeat(10000);
			setItem(deps, { key: 'long', value: longValue });
			expect(deps.storage.get('long')).toBe(longValue);
		});

		it('should handle JSON stringified objects', () => {
			const deps = createMockDeps({});
			const jsonValue = JSON.stringify({ a: 1, b: [1, 2, 3] });
			setItem(deps, { key: 'json', value: jsonValue });
			expect(JSON.parse(deps.storage.get('json')!)).toEqual({
				a: 1,
				b: [1, 2, 3],
			});
		});
	});

	describe('removeItem', () => {
		it('should remove existing key and return true', () => {
			const deps = createMockDeps({ key1: 'value1' });
			const result = removeItem(deps, { key: 'key1' });
			expect(result).toBe(true);
			expect(deps.storage.has('key1')).toBe(false);
		});

		it('should return false for non-existent key', () => {
			const deps = createMockDeps({});
			const result = removeItem(deps, { key: 'missing' });
			expect(result).toBe(false);
		});

		it('should not affect other keys', () => {
			const deps = createMockDeps({ a: '1', b: '2', c: '3' });
			removeItem(deps, { key: 'b' });
			expect(deps.storage.get('a')).toBe('1');
			expect(deps.storage.get('c')).toBe('3');
		});
	});

	describe('hasItem', () => {
		it('should return true for existing key', () => {
			const deps = createMockDeps({ key1: 'value1' });
			expect(hasItem(deps, { key: 'key1' })).toBe(true);
		});

		it('should return false for non-existent key', () => {
			const deps = createMockDeps({});
			expect(hasItem(deps, { key: 'missing' })).toBe(false);
		});

		it('should return true for key with empty value', () => {
			const deps = createMockDeps({ empty: '' });
			expect(hasItem(deps, { key: 'empty' })).toBe(true);
		});
	});

	describe('clearStorage', () => {
		it('should remove all items', () => {
			const deps = createMockDeps({ a: '1', b: '2', c: '3' });
			clearStorage(deps);
			expect(deps.storage.size).toBe(0);
		});

		it('should handle empty storage', () => {
			const deps = createMockDeps({});
			expect(() => clearStorage(deps)).not.toThrow();
		});
	});

	describe('getStorageKeys', () => {
		it('should return all keys', () => {
			const deps = createMockDeps({ a: '1', b: '2', c: '3' });
			const keys = getStorageKeys(deps);
			expect(keys).toHaveLength(3);
			expect(keys).toContain('a');
			expect(keys).toContain('b');
			expect(keys).toContain('c');
		});

		it('should return empty array for empty storage', () => {
			const deps = createMockDeps({});
			expect(getStorageKeys(deps)).toEqual([]);
		});
	});

	describe('getStorageSize', () => {
		it('should return correct size', () => {
			const deps = createMockDeps({ a: '1', b: '2', c: '3' });
			expect(getStorageSize(deps)).toBe(3);
		});

		it('should return 0 for empty storage', () => {
			const deps = createMockDeps({});
			expect(getStorageSize(deps)).toBe(0);
		});

		it('should update after operations', () => {
			const deps = createMockDeps({});
			setItem(deps, { key: 'a', value: '1' });
			expect(getStorageSize(deps)).toBe(1);
			setItem(deps, { key: 'b', value: '2' });
			expect(getStorageSize(deps)).toBe(2);
			removeItem(deps, { key: 'a' });
			expect(getStorageSize(deps)).toBe(1);
		});
	});
});
