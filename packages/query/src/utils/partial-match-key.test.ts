import { describe, it, expect } from 'vitest';
import { partialMatchKey } from './partial-match-key.js';

describe('partialMatchKey', () => {
	it('should match exact arrays', () => {
		expect(partialMatchKey(['todos'], ['todos'])).toBe(true);
	});

	it('should match prefix arrays', () => {
		expect(partialMatchKey(['todos', { page: 1 }], ['todos'])).toBe(true);
		expect(partialMatchKey(['todos', { page: 1 }], ['todos', { page: 1 }])).toBe(true);
	});

	it('should not match if pattern is longer than key', () => {
		expect(partialMatchKey(['todos'], ['todos', { page: 1 }])).toBe(false);
	});

	it('should match nested object prefixes', () => {
		expect(
			partialMatchKey(['users', { id: 1, name: 'a' }], ['users', { id: 1 }])
		).toBe(true);
		expect(
			partialMatchKey(['users', { id: 1, name: 'a' }], ['users', { id: 2 }])
		).toBe(false);
	});

	it('should handle primitives', () => {
		expect(partialMatchKey(['todos', 1], ['todos', 1])).toBe(true);
		expect(partialMatchKey(['todos', 1], ['todos', 2])).toBe(false);
	});

	it('should handle null safely', () => {
		expect(partialMatchKey(['todos', null], ['todos', null])).toBe(true);
		expect(partialMatchKey(['todos'], ['todos', null])).toBe(false);
	});

	it('should handle empty arrays', () => {
		expect(partialMatchKey([], [])).toBe(true);
		expect(partialMatchKey(['a'], [])).toBe(true);
	});
});
