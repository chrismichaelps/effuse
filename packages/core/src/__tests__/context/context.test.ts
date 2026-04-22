import { describe, it, expect } from 'vitest';
import { createContext } from '../../context/context.js';

describe('createContext deduplication', () => {
	it('should return the same context instance for the same id', () => {
		const ctx1 = createContext({ id: 'test-dedup', defaultValue: 42 });
		const ctx2 = createContext({ id: 'test-dedup', defaultValue: 99 });

		expect(ctx1).toBe(ctx2);
		// Should preserve the first default value
		expect(ctx1.defaultValue).toBe(42);
	});

	it('should create distinct contexts for different ids', () => {
		const ctxA = createContext({ id: 'test-a' });
		const ctxB = createContext({ id: 'test-b' });

		expect(ctxA).not.toBe(ctxB);
		expect(ctxA.id).toBe('test-a');
		expect(ctxB.id).toBe('test-b');
	});
});
