import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store.js';
import { Effect, Option } from 'effect';

describe('createStore Integration', () => {
	it('should create a store with initial state', () => {
		const store = createStore('testConfig', { count: 0, user: 'admin' });
		expect(store.count.value).toBe(0);
		expect(store.user.value).toBe('admin');
		expect(store.state.count.value).toBe(0);
	});

	it('should allow updates via proxy setters', () => {
		const store = createStore('testUpdates', { count: 0 });
		// @ts-expect-error
		store.count = 10;
		expect(store.count.value).toBe(10);
	});

	it('should support actions', () => {
		const store = createStore('testActions', {
			count: 0,
			increment() {
				this.count.value++;
			},
		});

		store.increment();
		expect(store.count.value).toBe(1);
	});

	it('should support computed derived state', () => {
		const store = createStore('testComputed', { count: 1, multiplier: 2 });
		const doubled = store.computed(
			(state) => (state.count as number) * (state.multiplier as number)
		);

		expect(doubled.value).toBe(2);

		// @ts-expect-error
		store.count = 5;
		expect(doubled.value).toBe(10);
	});

	it('should batch updates', () => {
		const store = createStore('testBatch', { a: 0, b: 0 });
		const callback = vi.fn();
		store.subscribe(callback);

		store.batch(() => {
			// @ts-expect-error
			store.a = 1;
			// @ts-expect-error
			store.b = 2;
		});

		expect(store.a.value).toBe(1);
		expect(store.b.value).toBe(2);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('should reset state to initial', () => {
		const store = createStore('testReset', { count: 0 });
		// @ts-expect-error
		store.count = 5;
		store.reset();
		expect(store.count.value).toBe(0);
	});

	it('should support key subscriptions', () => {
		const store = createStore('testKeySub', { count: 0, username: 'test' });
		const callback = vi.fn();

		store.subscribeToKey('count', callback);

		// @ts-expect-error
		store.count = 1;
		expect(callback).toHaveBeenCalledWith(1);

		// @ts-expect-error
		store.username = 'changed';
		expect(callback).toHaveBeenCalledTimes(1); // Should not accept name change
	});

	it('should prevent overwriting store methods', () => {
		const store = createStore('testStrict', { count: 0 });
		expect(() => {
			// @ts-expect-error
			store.subscribe = () => {};
		}).toThrow();
	});

	it('should handle snapshots', () => {
		const store = createStore('testSnapshot', { a: 1 });
		const snap = store.getSnapshot();
		expect(snap).toEqual({ a: 1 });

		// @ts-expect-error
		store.a = 2;
		expect(store.getSnapshot()).toEqual({ a: 2 });
		// Snapshot should be immutable/copy
		expect(snap).toEqual({ a: 1 });
	});

	it('should support update method', () => {
		const store = createStore('testUpdate', { count: 0 });
		store.update((draft) => {
			draft.count = 10;
		});
		expect(store.count.value).toBe(10);
	});

	it('should support select method', () => {
		const store = createStore('testSelect', {
			users: [{ id: 1, name: 'Alice' }],
		});
		const firstUserName = store.select(
			(state) => (state.users as any[])[0].name
		);

		expect(firstUserName.value).toBe('Alice');

		// @ts-expect-error
		store.users = [{ id: 1, name: 'Bob' }];
		expect(firstUserName.value).toBe('Bob');
	});
	it('should support computed chaining', () => {
		const store = createStore('testChain', { count: 1 });
		const double = store.computed((state) => (state.count as number) * 2);
		const quadruple = store.computed(() => double.value * 2);

		expect(quadruple.value).toBe(4);

		// @ts-expect-error - Proxy assignment
		store.count = 2;
		expect(double.value).toBe(4);
		expect(quadruple.value).toBe(8);
	});

	it('should unsubscribe correctly', () => {
		const store = createStore('testUnsub', { count: 0 });
		const callback = vi.fn();
		const unsub = store.subscribe(callback);

		// @ts-expect-error - Proxy assignment
		store.count = 1;
		expect(callback).toHaveBeenCalledTimes(1);

		unsub();
		// @ts-expect-error - Proxy assignment
		store.count = 2;
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('should handle async actions (success)', async () => {
		const store = createStore('testAsyncSuccess', {
			data: null as string | null,
			async fetchData() {
				await new Promise((resolve) => setTimeout(resolve, 10));
				this.data.value = 'loaded';
				return 'result';
			},
		});

		const result = await store.fetchData();
		expect(result).toBe('result');
		expect(store.data.value).toBe('loaded');
	});

	it('should handle async actions (failure)', async () => {
		const store = createStore('testAsyncFail', {
			error: null as string | null,
			async riskyAction() {
				throw new Error('boom');
			},
		});

		await expect(store.riskyAction()).rejects.toThrow('boom');
	});

	it('should support middleware', () => {
		const store = createStore('testMiddleware', { count: 0 });
		const log: string[] = [];

		store.use((state, action, args) => {
			log.push(`${action}:${args}`);
			if (action === 'set:count' && args[0] === 100) {
				return { ...state, count: 99 }; // Cap value
			}
			return state;
		});

		// @ts-expect-error - Proxy assignment
		store.count = 10;
		expect(log).toContain('set:count:10');
		expect(store.count.value).toBe(10);

		// @ts-expect-error - Proxy assignment
		store.count = 100;
		expect(store.count.value).toBe(99); // Middleware modified it
	});

	it('should integrate with persistence', () => {
		const storage = new Map<string, string>();
		const mockAdapter = {
			getItem: (k: string) =>
				Effect.succeed(Option.fromNullable(storage.get(k))),
			setItem: (k: string, v: string) => Effect.sync(() => storage.set(k, v)),
			removeItem: (k: string) => Effect.sync(() => storage.delete(k)),
			has: (k: string) => Effect.succeed(storage.has(k)),
			clear: () => Effect.sync(() => storage.clear()),
			keys: () => Effect.succeed(Array.from(storage.keys())),
			size: () => Effect.succeed(storage.size),
		};

		const store = createStore(
			'testPersist',
			{ count: 0 },
			{
				persist: true,
				storage: mockAdapter,
				storageKey: 'my-store',
			}
		);

		// @ts-expect-error - Proxy assignment
		store.count = 5;

		const stored = storage.get('my-store');
		expect(stored).toBeDefined();
		expect(JSON.parse(stored!)).toEqual({ count: 5 });
	});

	it('should load initial state from persistence', () => {
		const storage = new Map<string, string>();
		storage.set('restored-store', JSON.stringify({ count: 42 }));

		const mockAdapter = {
			getItem: (k: string) =>
				Effect.succeed(Option.fromNullable(storage.get(k))),
			setItem: (k: string, v: string) => Effect.sync(() => storage.set(k, v)),
			removeItem: (k: string) => Effect.sync(() => storage.delete(k)),
			has: (k: string) => Effect.succeed(storage.has(k)),
			clear: () => Effect.sync(() => storage.clear()),
			keys: () => Effect.succeed(Array.from(storage.keys())),
			size: () => Effect.succeed(storage.size),
		};

		const store = createStore(
			'testRestore',
			{ count: 0 },
			{
				persist: true,
				storage: mockAdapter,
				storageKey: 'restored-store',
			}
		);

		expect(store.count.value).toBe(42);
	});
});
