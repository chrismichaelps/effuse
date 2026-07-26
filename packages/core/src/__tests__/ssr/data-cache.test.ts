import { describe, it, expect, expectTypeOf } from 'vitest';
import { createDataCache } from '../../ssr/data-cache.js';
import { isServer, runWithSSRContext } from '../../ssr/use-head.js';

describe('cached()', () => {
	it('preserves the exact signature of the wrapped function', () => {
		const { cached } = createDataCache();
		const source = async (id: string, count: number): Promise<string[]> =>
			Array.from({ length: count }, () => id);

		const wrapped = cached(source, { life: { stale: 60 } });

		// The whole point of a wrapper over a directive: types survive.
		expectTypeOf(wrapped).parameters.toEqualTypeOf<[string, number]>();
		expectTypeOf(wrapped).returns.toEqualTypeOf<Promise<string[]>>();
	});

	it('runs once for repeated identical arguments', async () => {
		const { cached } = createDataCache();
		let calls = 0;
		const wrapped = cached(
			async (id: string) => {
				calls += 1;
				return `value-${id}`;
			},
			{ life: { stale: 60 } }
		);

		expect(await wrapped('a')).toBe('value-a');
		expect(await wrapped('a')).toBe('value-a');
		expect(calls).toBe(1);
	});

	it('caches distinct arguments independently', async () => {
		const { cached } = createDataCache();
		let calls = 0;
		const wrapped = cached(
			async (id: string) => {
				calls += 1;
				return id.toUpperCase();
			},
			{ life: { stale: 60 } }
		);

		expect(await wrapped('a')).toBe('A');
		expect(await wrapped('b')).toBe('B');
		expect(await wrapped('a')).toBe('A');
		expect(calls).toBe(2);
	});

	it('coalesces concurrent cold calls into one run', async () => {
		const { cached } = createDataCache();
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const wrapped = cached(
			async (id: string) => {
				calls += 1;
				await gate;
				return id;
			},
			{ life: { stale: 60 } }
		);

		const inflight = Array.from({ length: 20 }, () => wrapped('hot'));
		release();
		const results = await Promise.all(inflight);

		expect(calls).toBe(1);
		expect(results.every((value) => value === 'hot')).toBe(true);
	});

	it('invalidates by argument-derived tags', async () => {
		const cache = createDataCache();
		let calls = 0;
		const wrapped = cache.cached(
			async (category: string) => {
				calls += 1;
				return `${category}-data`;
			},
			{
				life: { stale: 60 },
				tags: (category: string) => [`category:${category}`],
			}
		);

		await wrapped('electronics');
		await wrapped('books');
		expect(calls).toBe(2);

		cache.invalidateTags(['category:electronics']);

		await wrapped('electronics'); // invalidated, re-runs
		await wrapped('books'); // untouched, still cached
		expect(calls).toBe(3);
	});

	it('accepts static tags', async () => {
		const cache = createDataCache();
		let calls = 0;
		const wrapped = cache.cached(
			async () => {
				calls += 1;
				return 'x';
			},
			{ life: { stale: 60 }, tags: ['static'] }
		);

		await wrapped();
		cache.invalidateTags(['static']);
		await wrapped();

		expect(calls).toBe(2);
	});

	it('re-runs after the fresh window expires', async () => {
		let now = 1_000_000;
		const { cached } = createDataCache({ now: () => now });
		let calls = 0;
		const wrapped = cached(
			async () => {
				calls += 1;
				return calls;
			},
			{ life: { stale: 1 } }
		);

		expect(await wrapped()).toBe(1);
		now += 2_000;
		expect(await wrapped()).toBe(2);
	});

	it('serves stale while one refresh runs', async () => {
		let now = 1_000_000;
		const cache = createDataCache({ now: () => now });
		let calls = 0;
		const wrapped = cache.cached(
			async () => {
				calls += 1;
				return `v${String(calls)}`;
			},
			{ life: { stale: 1, expire: 60 } }
		);

		expect(await wrapped()).toBe('v1');
		now += 2_000; // stale but not expired

		expect(await wrapped()).toBe('v1'); // served stale immediately
		await cache.idle();
		expect(calls).toBe(2); // refreshed behind it
		expect(await wrapped()).toBe('v2');
	});

	it('does not cache a rejection or poison the key', async () => {
		const { cached } = createDataCache();
		let calls = 0;
		const wrapped = cached(
			async () => {
				calls += 1;
				throw new Error('upstream down');
			},
			{ life: { stale: 60 } }
		);

		await expect(wrapped()).rejects.toThrow('upstream down');
		await expect(wrapped()).rejects.toThrow('upstream down');
		expect(calls).toBe(2);
	});

	it('supports a custom key for non-serialisable arguments', async () => {
		const { cached } = createDataCache();
		let calls = 0;
		const wrapped = cached(
			async (user: { id: string; fetchedAt: Date }) => {
				calls += 1;
				return user.id;
			},
			{
				life: { stale: 60 },
				// Only the id identifies the result; the timestamp must not.
				key: (user: { id: string; fetchedAt: Date }) => user.id,
			}
		);

		await wrapped({ id: 'u1', fetchedAt: new Date(1) });
		await wrapped({ id: 'u1', fetchedAt: new Date(2) });

		expect(calls).toBe(1);
	});

	it('bounds entries with LRU eviction', async () => {
		const cache = createDataCache({ maxEntries: 2 });
		let calls = 0;
		const wrapped = cache.cached(
			async (id: string) => {
				calls += 1;
				return id;
			},
			{ life: { stale: 60 } }
		);

		await wrapped('a');
		await wrapped('b');
		await wrapped('a'); // 'b' becomes least recently used
		await wrapped('c'); // evicts 'b'
		expect(calls).toBe(3);

		await wrapped('a'); // still cached
		expect(calls).toBe(3);
		await wrapped('b'); // was evicted
		expect(calls).toBe(4);
		expect(cache.size).toBeLessThanOrEqual(2);
	});

	it('prevents a caller from mutating the cached value for everyone else', async () => {
		const { cached } = createDataCache();
		const wrapped = cached(
			async (id: string) => ({ id, roles: ['user'] }),
			{ life: { stale: 60 } }
		);

		const first = await wrapped('u1');
		// A cached value is shared by every later caller, so mutating it would
		// be a privilege-escalation vector. It must not be mutable.
		expect(() => {
			first.roles.push('admin');
		}).toThrow();

		const second = await wrapped('u1');
		expect(second.roles).toEqual(['user']);
	});

	it('freezes nested structures, not just the top level', async () => {
		const { cached } = createDataCache();
		const wrapped = cached(
			async () => ({ nested: { list: [{ value: 1 }] } }),
			{ life: { stale: 60 } }
		);

		const result = await wrapped();
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.nested)).toBe(true);
		expect(Object.isFrozen(result.nested.list)).toBe(true);
		expect(Object.isFrozen(result.nested.list[0])).toBe(true);
	});

	it('can opt out of freezing for values that must stay mutable', async () => {
		const { cached } = createDataCache();
		const wrapped = cached(async () => ({ count: 0 }), {
			life: { stale: 60 },
			freeze: false,
		});

		const result = await wrapped();
		expect(() => {
			result.count = 1;
		}).not.toThrow();
	});

	it('runs the cached function detached from the request context', async () => {
		const { cached } = createDataCache();
		const wrapped = cached(
			async () => isServer(),
			{ life: { stale: 60 } }
		);

		// Inside a request, but cached work must not observe it — otherwise a
		// value computed for one request leaks into every later request.
		const observed = await runWithSSRContext({ push: () => undefined }, () =>
			wrapped()
		);

		expect(observed).toBe(false);
	});

	it('clears every entry', async () => {
		const cache = createDataCache();
		let calls = 0;
		const wrapped = cache.cached(
			async () => {
				calls += 1;
				return 'x';
			},
			{ life: { stale: 60 } }
		);

		await wrapped();
		cache.clear();
		await wrapped();

		expect(calls).toBe(2);
	});
});
