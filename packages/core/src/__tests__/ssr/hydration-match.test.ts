/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { checkHydrationMatch } from '../../ssr/hydration.js';

describe('checkHydrationMatch', () => {
	it('matches identical state', () => {
		expect(checkHydrationMatch({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
	});

	it('matches state built in a different key order', () => {
		// Key order is not part of the state's meaning, and server and client
		// routinely build the same content by different routes.
		expect(checkHydrationMatch({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
	});

	it('matches nested state built in a different key order', () => {
		expect(
			checkHydrationMatch({ o: { a: 1, b: 2 } }, { o: { b: 2, a: 1 } })
		).toBe(true);
	});

	it('separates different values', () => {
		expect(checkHydrationMatch({ a: 1 }, { a: 2 })).toBe(false);
	});

	it('separates a missing key', () => {
		expect(checkHydrationMatch({ a: 1, b: 2 }, { a: 1 })).toBe(false);
	});

	it('separates differing nested values', () => {
		expect(
			checkHydrationMatch({ o: { a: 1, b: 2 } }, { o: { a: 1, b: 3 } })
		).toBe(false);
	});

	it('keeps array order significant', () => {
		expect(checkHydrationMatch({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
		expect(checkHydrationMatch({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
	});

	it('separates arrays of different length', () => {
		expect(checkHydrationMatch({ a: [1, 2] }, { a: [1, 2, 3] })).toBe(false);
	});

	it('treats an undefined value as absent', () => {
		// State reaches the client as JSON, where such a key never survives, so
		// reporting a mismatch here would flag something that cannot happen.
		expect(checkHydrationMatch({ a: 1, b: undefined }, { a: 1 })).toBe(true);
	});

	it('separates null from absent', () => {
		expect(checkHydrationMatch({ a: null }, {})).toBe(false);
	});

	it('separates an object from an array', () => {
		expect(checkHydrationMatch({ a: {} }, { a: [] })).toBe(false);
	});

	it('separates values of different types', () => {
		expect(checkHydrationMatch({ a: 1 }, { a: '1' })).toBe(false);
		expect(checkHydrationMatch({ a: false }, { a: 0 })).toBe(false);
	});

	it('matches empty state', () => {
		expect(checkHydrationMatch({}, {})).toBe(true);
	});

	it('does not hang on cyclic input', () => {
		const left: Record<string, unknown> = { a: 1 };
		left['self'] = left;
		const right: Record<string, unknown> = { a: 1 };
		right['self'] = right;

		// The answer matters less than terminating; `JSON.stringify` threw here.
		expect(() => checkHydrationMatch(left, right)).not.toThrow();
	});
});
