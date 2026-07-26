import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPluginHost } from '../plugins.js';
import type { PluginEvent } from '../plugins.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('createPluginHost', () => {
	it('runs setup in registration order', async () => {
		const order: string[] = [];
		const host = createPluginHost();

		for (const name of ['a', 'b', 'c']) {
			host.use({
				name,
				setup: () => {
					order.push(name);
				},
			});
		}
		await host.start();

		expect(order).toEqual(['a', 'b', 'c']);
		await host.stop();
	});

	it('tears down in the exact reverse of setup order', async () => {
		const order: string[] = [];
		const host = createPluginHost();

		for (const name of ['a', 'b', 'c']) {
			host.use({
				name,
				setup: (ctx) => {
					ctx.onTeardown(() => {
						order.push(name);
					});
				},
			});
		}
		await host.start();
		await host.stop();

		// A dependency must never be torn down before its dependent.
		expect(order).toEqual(['c', 'b', 'a']);
	});

	it('rolls back already-started plugins when a setup fails', async () => {
		const torn: string[] = [];
		const host = createPluginHost();

		host.use({
			name: 'first',
			setup: (ctx) => {
				ctx.onTeardown(() => {
					torn.push('first');
				});
			},
		});
		host.use({
			name: 'second',
			setup: (ctx) => {
				ctx.onTeardown(() => {
					torn.push('second');
				});
			},
		});
		host.use({
			name: 'boom',
			setup: () => {
				throw new Error('setup failed');
			},
		});

		await expect(host.start()).rejects.toThrow('setup failed');

		// A failed boot must leave nothing running.
		expect(torn).toEqual(['second', 'first']);
		expect(host.started).toBe(false);
	});

	it('exposes values returned by setup', async () => {
		const host = createPluginHost();
		host.use({
			name: 'provider',
			setup: () => ({ answer: 42 }),
		});
		await host.start();

		expect(host.get<{ answer: number }>('provider')?.answer).toBe(42);
		await host.stop();
	});

	it('continues teardown after one plugin fails and aggregates failures', async () => {
		const torn: string[] = [];
		const host = createPluginHost();

		host.use({
			name: 'a',
			setup: (ctx) => {
				ctx.onTeardown(() => {
					torn.push('a');
				});
			},
		});
		host.use({
			name: 'bad',
			setup: (ctx) => {
				ctx.onTeardown(() => {
					throw new Error('teardown failed');
				});
			},
		});
		host.use({
			name: 'c',
			setup: (ctx) => {
				ctx.onTeardown(() => {
					torn.push('c');
				});
			},
		});
		await host.start();

		await expect(host.stop()).rejects.toThrow(/teardown/i);

		// The failure must not prevent the remaining teardowns.
		expect(torn).toEqual(['c', 'a']);
	});

	it('supports async setup and teardown', async () => {
		const order: string[] = [];
		const host = createPluginHost();

		host.use({
			name: 'async',
			setup: async (ctx) => {
				await Promise.resolve();
				order.push('setup');
				ctx.onTeardown(async () => {
					await Promise.resolve();
					order.push('teardown');
				});
			},
		});
		await host.start();
		await host.stop();

		expect(order).toEqual(['setup', 'teardown']);
	});

	it('is idempotent for repeated start and stop', async () => {
		let setups = 0;
		let teardowns = 0;
		const host = createPluginHost();

		host.use({
			name: 'once',
			setup: (ctx) => {
				setups += 1;
				ctx.onTeardown(() => {
					teardowns += 1;
				});
			},
		});

		await host.start();
		await host.start();
		expect(setups).toBe(1);

		await host.stop();
		await host.stop();
		expect(teardowns).toBe(1);
	});

	it('bounds stop with a timeout so shutdown cannot hang', async () => {
		vi.useFakeTimers();
		const host = createPluginHost();

		host.use({
			name: 'stuck',
			setup: (ctx) => {
				ctx.onTeardown(() => new Promise<void>(() => undefined));
			},
		});
		await host.start();

		const stopping = host.stop({ timeoutMs: 500 });
		await vi.advanceTimersByTimeAsync(600);
		await expect(stopping).resolves.toBeUndefined();
	});

	it('rejects a duplicate plugin name', () => {
		const host = createPluginHost();
		host.use({ name: 'dup', setup: () => undefined });

		expect(() => host.use({ name: 'dup', setup: () => undefined })).toThrow(
			/duplicate/i
		);
	});

	it('rejects registration after start', async () => {
		const host = createPluginHost();
		await host.start();

		expect(() => host.use({ name: 'late', setup: () => undefined })).toThrow(
			/start/i
		);
		await host.stop();
	});

	it('reports setup and teardown events', async () => {
		const events: PluginEvent[] = [];
		const host = createPluginHost({ onEvent: (event) => events.push(event) });

		host.use({
			name: 'observed',
			setup: (ctx) => {
				ctx.onTeardown(() => undefined);
			},
		});
		await host.start();
		await host.stop();

		expect(events.map((event) => `${event.type}:${event.name}`)).toEqual([
			'setup:observed',
			'teardown:observed',
		]);
	});
});
