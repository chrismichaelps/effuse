import { describe, it, expect, beforeEach } from 'vitest';
import { Option } from 'effect';
import {
	runWithContextRegistry,
	pushContext,
	popContext,
	getContext,
	hasContext,
	getRegisteredContexts,
	clearAllContexts,
} from '../../context/registry.js';

describe('ContextRegistry', () => {
	beforeEach(() => {
		clearAllContexts();
	});

	describe('runWithContextRegistry', () => {
		it('should isolate context stacks between runs', () => {
			let valueA: unknown;
			let valueB: unknown;

			runWithContextRegistry(() => {
				pushContext('test', 'A');
				valueA = getContext('test');
			});

			runWithContextRegistry(() => {
				pushContext('test', 'B');
				valueB = getContext('test');
			});

		expect(Option.isSome(valueA as any)).toBe(true);
		expect((valueA as any).value).toBe('A');
		expect(Option.isSome(valueB as any)).toBe(true);
		expect((valueB as any).value).toBe('B');
		});

		it('should prevent data leaks between concurrent requests', async () => {
			const results = await Promise.all(
				[1, 2, 3].map((i) =>
					new Promise<string>((resolve) => {
						runWithContextRegistry(() => {
							pushContext('requestId', `req-${i}`);
							// Simulate async work
							setTimeout(() => {
								const ctx = getContext('requestId');
								resolve((ctx as any).value);
							}, 10);
						});
					})
				)
			);

			expect(results.sort()).toEqual(['req-1', 'req-2', 'req-3']);
		});

		it('should return the function result', () => {
			const result = runWithContextRegistry(() => {
				pushContext('key', 42);
				return (getContext('key') as any).value;
			});

			expect(result).toBe(42);
		});
	});

	describe('global registry fallback', () => {
		it('should use global registry when not inside runWithContextRegistry', () => {
			pushContext('globalKey', 'globalValue');
			const ctx = getContext('globalKey');
			expect(Option.isSome(ctx as any)).toBe(true);
		expect((ctx as any).value).toBe('globalValue');
		});

		it('should not leak global state into isolated registries', () => {
			pushContext('shared', 'global');

			let isolatedValue: unknown;
			runWithContextRegistry(() => {
				isolatedValue = getContext('shared');
			});

			// Isolated registry should not see global value
			expect(Option.isNone(isolatedValue as any)).toBe(true);
		});
	});

	describe('context operations', () => {
		it('should push and pop contexts in LIFO order', () => {
			pushContext('stack', 'first');
			pushContext('stack', 'second');

			expect((getContext('stack') as any).value).toBe('second');

			popContext('stack');
			expect((getContext('stack') as any).value).toBe('first');

			popContext('stack');
			expect(hasContext('stack')).toBe(false);
		});

		it('should return all registered context ids', () => {
			pushContext('a', 1);
			pushContext('b', 2);

			const ids = getRegisteredContexts();
			expect(ids).toContain('a');
			expect(ids).toContain('b');
		});

		it('should clear all contexts', () => {
			pushContext('a', 1);
			pushContext('b', 2);

			clearAllContexts();

			expect(hasContext('a')).toBe(false);
			expect(hasContext('b')).toBe(false);
			expect(getRegisteredContexts()).toEqual([]);
		});
	});
});
