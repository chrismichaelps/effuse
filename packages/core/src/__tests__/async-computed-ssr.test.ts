import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { asyncComputed } from '../reactivity/async-computed.js';
import {
	clearHydratedAsyncState,
	createAsyncCollector,
	getAsyncCollector,
	hydrateAsyncState,
	runWithAsyncCollector,
} from '../reactivity/async-hydration.js';

const flush = async (times = 3): Promise<void> => {
	for (let i = 0; i < times; i += 1) await Promise.resolve();
};

/**
 * These tests run in a Node environment, where `window` is undefined and the
 * module therefore behaves as it does during a server render. The client-side
 * cases install a `window` stub for the duration of the test.
 */
const asClient = async (body: () => Promise<void> | void): Promise<void> => {
	const globals = globalThis as { window?: unknown };
	const had = 'window' in globals;
	globals.window = {};
	try {
		await body();
	} finally {
		if (!had) delete globals.window;
	}
};

afterEach(() => {
	clearHydratedAsyncState();
});

describe('server collection', () => {
	it('registers a keyed computation with the ambient collector', async () => {
		const collector = createAsyncCollector();

		const derived = runWithAsyncCollector(collector, () =>
			asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve({ name: 'Ada' }),
			})
		);

		expect(collector.size()).toBe(1);

		await collector.settle();
		expect(derived.value).toEqual({ name: 'Ada' });

		collector.dispose();
	});

	it('does not register a computation with no hydration key', () => {
		// Opting out is legitimate — not every async value belongs in the payload.
		const collector = createAsyncCollector();

		const derived = runWithAsyncCollector(collector, () =>
			asyncComputed({ source: () => 1, load: () => Promise.resolve('x') })
		);

		expect(collector.size()).toBe(0);

		derived.dispose();
		collector.dispose();
	});

	it('awaits every pending computation before settling', async () => {
		const collector = createAsyncCollector();
		let resolveFirst!: (value: string) => void;
		let resolveSecond!: (value: string) => void;

		runWithAsyncCollector(collector, () => {
			asyncComputed({
				source: () => 1,
				hydrationKey: 'a',
				load: () => new Promise<string>((r) => (resolveFirst = r)),
			});
			asyncComputed({
				source: () => 1,
				hydrationKey: 'b',
				load: () => new Promise<string>((r) => (resolveSecond = r)),
			});
		});

		let settled = false;
		const settling = collector.settle().then(() => {
			settled = true;
		});

		await flush();
		expect(settled).toBe(false);

		resolveFirst('first');
		await flush();
		expect(settled).toBe(false);

		resolveSecond('second');
		await settling;

		expect(collector.serialize()).toEqual({ a: 'first', b: 'second' });

		collector.dispose();
	});

	it('collects a computation created during another one\'s load', async () => {
		// A render wave: the page loads a user, and that load creates a second
		// computation for the user's permissions. Settling in one pass would
		// serialise the page before the second finished.
		const collector = createAsyncCollector();

		runWithAsyncCollector(collector, () => {
			asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: async () => {
					await Promise.resolve();
					runWithAsyncCollector(collector, () => {
						asyncComputed({
							source: () => 1,
							hydrationKey: 'permissions',
							load: () => Promise.resolve(['read']),
						});
					});
					return { name: 'Ada' };
				},
			});
		});

		await collector.settle();

		expect(collector.serialize()).toEqual({
			user: { name: 'Ada' },
			permissions: ['read'],
		});

		collector.dispose();
	});

	it('gives up on a load that never settles rather than hanging the request', async () => {
		// A provider that never responds must degrade to a page rendered without
		// that data, not a request that never returns.
		const collector = createAsyncCollector();

		runWithAsyncCollector(collector, () => {
			asyncComputed({
				source: () => 1,
				hydrationKey: 'never',
				load: () => new Promise<string>(() => undefined),
			});
		});

		const started = Date.now();
		await collector.settle({ timeoutMs: 40 });

		expect(Date.now() - started).toBeLessThan(2000);
		expect(collector.serialize()).toEqual({});

		collector.dispose();
	});

	it('stops after the wave limit rather than looping forever', async () => {
		// A computation whose load creates another, endlessly. Bounded so a cyclic
		// dependency is a slow request rather than a hung one.
		const collector = createAsyncCollector();
		let created = 0;

		// Depth-capped, because `settle` bounds how many waves it *awaits*, not how
		// many computations a runaway loader can create. Uncapped, this test would
		// exhaust memory rather than demonstrate anything — which is itself worth
		// knowing: the wave limit protects the request, not the process.
		const MAX_DEPTH = 12;

		const spawn = (depth: number): void => {
			if (depth > MAX_DEPTH) return;

			runWithAsyncCollector(collector, () => {
				asyncComputed({
					source: () => depth,
					hydrationKey: `level-${String(depth)}`,
					load: async () => {
						created += 1;
						// A real timer, not a microtask. With microtask-fast spawning a
						// single wave absorbs the whole chain, and the wave limit —
						// which is what this test exists to check — never engages.
						await new Promise((resolve) => setTimeout(resolve, 5));
						spawn(depth + 1);
						return depth;
					},
				});
			});
		};

		spawn(0);
		await collector.settle({ maxWaves: 3, timeoutMs: 2000 });

		// Settling stopped at the wave limit rather than following the chain to
		// its end, so the deepest levels were never awaited and never serialised.
		expect(created).toBeGreaterThan(0);
		expect(Object.keys(collector.serialize()).length).toBeLessThan(MAX_DEPTH);

		collector.dispose();
	});

	it('omits an undefined value from the payload', async () => {
		// `undefined` survives neither JSON nor a round trip. Emitting it would
		// have the client adopt "loaded, and the answer is nothing" for something
		// that never loaded.
		const collector = createAsyncCollector();

		runWithAsyncCollector(collector, () => {
			asyncComputed<number, string | undefined>({
				source: () => 1,
				hydrationKey: 'maybe',
				load: () => Promise.resolve(undefined),
			});
		});

		await collector.settle();

		expect(collector.serialize()).toEqual({});

		collector.dispose();
	});

	it('disposes every collected computation', async () => {
		const collector = createAsyncCollector();
		let captured: AbortSignal | undefined;

		runWithAsyncCollector(collector, () => {
			asyncComputed({
				source: () => 1,
				hydrationKey: 'pending',
				load: (_source, ctx) => {
					captured = ctx.signal;
					return new Promise<string>(() => undefined);
				},
			});
		});

		await flush();
		expect(captured?.aborted).toBe(false);

		collector.dispose();

		// The request ended; in-flight work must not outlive it.
		expect(captured?.aborted).toBe(true);
	});
});

describe('request isolation', () => {
	it('keeps concurrent requests separate', async () => {
		// The reason the collector lives in async context rather than a module
		// global. Concurrent requests interleave across every await in Node, so a
		// shared global would hand one request's data to another — a leak between
		// users, not merely a bug.
		const first = createAsyncCollector();
		const second = createAsyncCollector();

		const render = async (
			collector: ReturnType<typeof createAsyncCollector>,
			name: string,
			delay: number
		): Promise<Record<string, unknown>> => {
			runWithAsyncCollector(collector, () => {
				asyncComputed({
					source: () => name,
					hydrationKey: 'user',
					load: async (value) => {
						await new Promise((resolve) => setTimeout(resolve, delay));
						return value;
					},
				});
			});

			await collector.settle();
			return collector.serialize();
		};

		// Deliberately inverted delays so the requests finish out of order.
		const [a, b] = await Promise.all([
			render(first, 'alice', 30),
			render(second, 'bob', 5),
		]);

		expect(a).toEqual({ user: 'alice' });
		expect(b).toEqual({ user: 'bob' });

		first.dispose();
		second.dispose();
	});

	it('reports no collector outside a render', () => {
		expect(getAsyncCollector()).toBeUndefined();
	});
});

describe('client hydration', () => {
	it('adopts the server value and skips the initial load', async () => {
		await asClient(async () => {
			hydrateAsyncState({ user: { name: 'Ada' } });

			const load = vi.fn(() => Promise.resolve({ name: 'refetched' }));
			const derived = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load,
			});

			// Settled synchronously, with the server's value. No spinner, no
			// second request for data the page already had.
			expect(derived.value).toEqual({ name: 'Ada' });
			expect(derived.loading).toBe(false);
			expect(derived.settled).toBe(true);

			await flush();
			expect(load).not.toHaveBeenCalled();

			derived.dispose();
		});
	});

	it('loads normally when the payload has no entry for the key', async () => {
		await asClient(async () => {
			hydrateAsyncState({ other: 'value' });

			const derived = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve('loaded'),
			});

			expect(derived.loading).toBe(true);
			await derived.whenSettled();
			expect(derived.value).toBe('loaded');

			derived.dispose();
		});
	});

	it('reloads when the source changes after hydrating', async () => {
		// Hydration seeds the first render. It must not make the computation inert
		// thereafter.
		await asClient(async () => {
			hydrateAsyncState({ user: 'server-value' });

			const id = signal(1);
			const load = vi.fn((value: number) => Promise.resolve(`client-${String(value)}`));

			const derived = asyncComputed({
				source: () => id.value,
				hydrationKey: 'user',
				load,
			});

			expect(derived.value).toBe('server-value');

			id.value = 2;
			await derived.whenSettled();

			expect(derived.value).toBe('client-2');
			expect(load).toHaveBeenCalledTimes(1);

			derived.dispose();
		});
	});

	it('reloads on an explicit refresh after hydrating', async () => {
		await asClient(async () => {
			hydrateAsyncState({ user: 'server-value' });

			const derived = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve('fresh'),
			});

			expect(derived.value).toBe('server-value');

			derived.refresh();
			await derived.whenSettled();

			expect(derived.value).toBe('fresh');

			derived.dispose();
		});
	});

	it('consumes the entry, so a remount fetches fresh data', async () => {
		// The payload describes the *initial* render. A component remounted later
		// must not silently resurrect a value that may be minutes old.
		await asClient(async () => {
			hydrateAsyncState({ user: 'server-value' });

			const first = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve('fresh'),
			});
			expect(first.value).toBe('server-value');
			first.dispose();

			const second = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve('fresh'),
			});

			expect(second.loading).toBe(true);
			await second.whenSettled();
			expect(second.value).toBe('fresh');

			second.dispose();
		});
	});

	it('adopts a falsy server value rather than treating it as absent', async () => {
		// `0`, `''`, `false`, and `null` are all legitimate results. Testing for
		// presence rather than truthiness is what stops a zero count refetching.
		for (const value of [0, '', false, null]) {
			await asClient(async () => {
				hydrateAsyncState({ count: value });

				const load = vi.fn(() => Promise.resolve('refetched'));
				const derived = asyncComputed({
					source: () => 1,
					hydrationKey: 'count',
					load,
				});

				expect(derived.value).toBe(value);
				expect(derived.settled).toBe(true);

				await flush();
				expect(load).not.toHaveBeenCalled();

				derived.dispose();
			});

			clearHydratedAsyncState();
		}
	});

	it('loads normally when no payload was installed at all', async () => {
		await asClient(async () => {
			const derived = asyncComputed({
				source: () => 1,
				hydrationKey: 'user',
				load: () => Promise.resolve('loaded'),
			});

			await derived.whenSettled();
			expect(derived.value).toBe('loaded');

			derived.dispose();
		});
	});
});

describe('server rendering without a collector', () => {
	it('still works, just without payload collection', async () => {
		// A keyed computation created outside a render must not throw. Tests, jobs,
		// and scripts all construct these with no ambient collector.
		const derived = asyncComputed({
			source: () => 1,
			hydrationKey: 'orphan',
			load: () => Promise.resolve('value'),
		});

		await derived.whenSettled();
		expect(derived.value).toBe('value');

		derived.dispose();
	});
});
