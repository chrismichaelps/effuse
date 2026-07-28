import { describe, expect, it } from 'vitest';
import { createRuntimeContext } from '../../context/runtime-context.js';

describe('createRuntimeContext', () => {
	it('preserves ownership across await', async () => {
		const context = createRuntimeContext<string>();

		const value = await context.run('request-a', async () => {
			await Promise.resolve();
			return context.current();
		});

		expect(value).toBe('request-a');
		expect(context.current()).toBeUndefined();
	});

	it('isolates overlapping async executions', async () => {
		const context = createRuntimeContext<string>();
		const first = context.run('request-a', async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			return context.current();
		});
		const second = context.run('request-b', async () => {
			await Promise.resolve();
			return context.current();
		});

		await expect(Promise.all([first, second])).resolves.toEqual([
			'request-a',
			'request-b',
		]);
	});
});
