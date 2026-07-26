import { describe, expect, it } from 'vitest';
import { createAsyncContextStorage } from '../../utils/async-context.js';

const createFallbackStorage = <T>() => {
	const processDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		'process'
	);
	Object.defineProperty(globalThis, 'process', {
		configurable: true,
		value: undefined,
	});
	try {
		return createAsyncContextStorage<T>();
	} finally {
		if (processDescriptor) {
			Object.defineProperty(globalThis, 'process', processDescriptor);
		}
	}
};

describe('createAsyncContextStorage', () => {
	it('should isolate overlapping async scopes', async () => {
		const storage = createAsyncContextStorage<string>();
		let resumeFirst!: () => void;
		let resumeSecond!: () => void;

		const first = storage.run('first', async () => {
			expect(storage.getStore()).toBe('first');
			await new Promise<void>((resolve) => {
				resumeFirst = resolve;
			});
			return storage.getStore();
		});

		const second = storage.run('second', async () => {
			expect(storage.getStore()).toBe('second');
			await new Promise<void>((resolve) => {
				resumeSecond = resolve;
			});
			return storage.getStore();
		});

		resumeFirst();
		await expect(first).resolves.toBe('first');

		resumeSecond();
		await expect(second).resolves.toBe('second');
		expect(storage.getStore()).toBeUndefined();
	});

	it('restores nested fallback scopes in ownership order', () => {
		const storage = createFallbackStorage<string>();

		storage.run('outer', () => {
			expect(storage.getStore()).toBe('outer');
			storage.run('inner', () => {
				expect(storage.getStore()).toBe('inner');
			});
			expect(storage.getStore()).toBe('outer');
		});

		expect(storage.getStore()).toBeUndefined();
	});

	it('restores a fallback scope after a callback throws', () => {
		const storage = createFallbackStorage<string>();
		const failure = new Error('scope failed');

		expect(() =>
			storage.run('owned', () => {
				throw failure;
			})
		).toThrow(failure);
		expect(storage.getStore()).toBeUndefined();
	});

	it('does not leak a fallback scope while a returned promise is pending', async () => {
		const storage = createFallbackStorage<string>();
		let resolvePending!: () => void;

		const pending = storage.run('owned', () => {
			expect(storage.getStore()).toBe('owned');
			return new Promise<void>((resolve) => {
				resolvePending = resolve;
			});
		});

		expect(storage.getStore()).toBeUndefined();
		resolvePending();
		await pending;
		expect(storage.getStore()).toBeUndefined();
	});
});
