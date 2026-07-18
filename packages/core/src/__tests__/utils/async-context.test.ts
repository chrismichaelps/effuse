import { describe, expect, it } from 'vitest';
import { createAsyncContextStorage } from '../../utils/async-context.js';

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
});
