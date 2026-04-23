import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store.js';

describe('createStore Integration', () => {
	it('should create a store with initial state', () => {
		const store = createStore('testConfig', { count: 0, user: 'admin' });
		expect(store.count.value).toBe(0);
		expect(store.user.value).toBe('admin');
		expect(store.state.count.value).toBe(0);
	});

	it('should allow updates via proxy setters', () => {
		const store = createStore('testUpdates', { count: 0 });
		// @ts-expect-error testing proxy assignment
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

		// @ts-expect-error testing proxy assignment
		store.count = 5;
		expect(doubled.value).toBe(10);
	});

	it('should batch updates', () => {
		const store = createStore('testBatch', { a: 0, b: 0 });
		const callback = vi.fn();
		store.subscribe(callback);

		store.batch(() => {
			// @ts-expect-error testing proxy assignment
			store.a = 1;
			// @ts-expect-error testing proxy assignment
			store.b = 2;
		});

		expect(store.a.value).toBe(1);
		expect(store.b.value).toBe(2);
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('should reset state to initial', () => {
		const store = createStore('testReset', { count: 0 });
		// @ts-expect-error testing proxy assignment
		store.count = 5;
		store.reset();
		expect(store.count.value).toBe(0);
	});

	it('should support key subscriptions', () => {
		const store = createStore('testKeySub', { count: 0, username: 'test' });
		const callback = vi.fn();

		store.subscribeToKey('count', callback);

		// @ts-expect-error testing proxy assignment
		store.count = 1;
		expect(callback).toHaveBeenCalledWith(1);

		// @ts-expect-error testing proxy assignment
		store.username = 'changed';
		expect(callback).toHaveBeenCalledTimes(1); // Should not accept name change
	});

	it('should prevent overwriting store methods', () => {
		const store = createStore('testStrict', { count: 0 });
		expect(() => {
			// @ts-expect-error testing proxy assignment
			store.subscribe = () => {};
		}).toThrow();
	});

	it('should handle snapshots', () => {
		const store = createStore('testSnapshot', { a: 1 });
		const snap = store.getSnapshot();
		expect(snap).toEqual({ a: 1 });

		// @ts-expect-error testing proxy assignment
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
			(state) => (state.users as Array<{ id: number; name: string }>)[0].name
		);

		expect(firstUserName.value).toBe('Alice');

		// @ts-expect-error testing proxy assignment
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
			riskyAction() {
				return Promise.reject(new Error('boom'));
			},
		});

		await expect(store.riskyAction()).rejects.toThrow('boom');
	});

	it('should support middleware', () => {
		const store = createStore('testMiddleware', { count: 0 });
		const log: string[] = [];

		store.use((state, action, args) => {
			log.push(`${action}:${args.join(',')}`);
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
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => {
				storage.set(k, v);
			},
			removeItem: (k: string) => {
				storage.delete(k);
			},
			has: (k: string) => storage.has(k),
			clear: () => { storage.clear(); },
			keys: () => Array.from(storage.keys()),
			size: () => storage.size,
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
		expect(JSON.parse(stored as string)).toEqual({ count: 5 });
	});

	it('should load initial state from persistence', () => {
		const storage = new Map<string, string>();
		storage.set('restored-store', JSON.stringify({ count: 42 }));

		const mockAdapter = {
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => {
				storage.set(k, v);
			},
			removeItem: (k: string) => {
				storage.delete(k);
			},
			has: (k: string) => storage.has(k),
			clear: () => { storage.clear(); },
			keys: () => Array.from(storage.keys()),
			size: () => storage.size,
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

	describe('DX convenience methods', () => {
		describe('get / set', () => {
			it('should get value by key', () => {
				const store = createStore('dxGet', { count: 42, name: 'test' });
				expect(store.get('count')).toBe(42);
				expect(store.get('name')).toBe('test');
			});

			it('should set value by key', () => {
				const store = createStore('dxSet', { count: 0 });
				store.set('count', 10);
				expect(store.count.value).toBe(10);
				expect(store.get('count')).toBe(10);
			});
		});

		describe('patch', () => {
			it('should apply partial updates', () => {
				const store = createStore('dxPatch', { a: 1, b: 2, c: 3 });
				store.patch({ a: 10, b: 20 });
				expect(store.get('a')).toBe(10);
				expect(store.get('b')).toBe(20);
				expect(store.get('c')).toBe(3);
			});

			it('should batch patch updates', () => {
				const store = createStore('dxPatchBatch', { x: 0, y: 0 });
				const callback = vi.fn();
				store.subscribe(callback);

				store.patch({ x: 1, y: 2 });
				expect(callback).toHaveBeenCalledTimes(1);
			});
		});

		describe('toggle', () => {
			it('should toggle boolean values', () => {
				const store = createStore('dxToggle', { flag: false });
				store.toggle('flag');
				expect(store.get('flag')).toBe(true);
				store.toggle('flag');
				expect(store.get('flag')).toBe(false);
			});

			it('should not toggle non-boolean values', () => {
				const store = createStore('dxToggleNoop', { count: 5 });
				store.toggle('count');
				expect(store.get('count')).toBe(5);
			});
		});

		describe('resetKey', () => {
			it('should reset a single key to initial value', () => {
				const store = createStore('dxResetKey', { count: 0, label: 'init' });
				// @ts-expect-error testing proxy assignment
				store.count = 99;
				// @ts-expect-error testing proxy assignment
				store.label = 'changed';

				store.resetKey('count');
				expect(store.get('count')).toBe(0);
				expect(store.get('label')).toBe('changed');
			});
		});

		describe('watch', () => {
			it('should call callback when selector value changes', () => {
				const store = createStore('dxWatch', { count: 0 });
				const callback = vi.fn();

				const unsub = store.watch(
					(snap) => snap.count,
					(newVal, oldVal) => {
						callback({ newVal, oldVal });
					}
				);

				// Initial call on setup
				expect(callback).toHaveBeenCalledWith({ newVal: 0, oldVal: undefined });

				// @ts-expect-error testing proxy assignment
				store.count = 5;
				expect(callback).toHaveBeenCalledWith({ newVal: 5, oldVal: 0 });

				// @ts-expect-error testing proxy assignment
				store.count = 10;
				expect(callback).toHaveBeenCalledWith({ newVal: 10, oldVal: 5 });

				unsub();
			});

			it('should not call callback when selector value is unchanged', () => {
				const store = createStore('dxWatchNoop', { count: 0 });
				const callback = vi.fn();

				store.watch((snap) => snap.count, callback);

				// @ts-expect-error testing proxy assignment
				store.count = 0;
				expect(callback).toHaveBeenCalledTimes(1); // initial call only
			});

			it('should support custom equality function', () => {
				const store = createStore('dxWatchEq', { items: [1, 2, 3] });
				const callback = vi.fn();

				store.watch(
					(snap) => snap.items,
					callback,
					(a, b) => JSON.stringify(a) === JSON.stringify(b)
				);

				// @ts-expect-error testing proxy assignment
				store.items = [1, 2, 3];
				expect(callback).toHaveBeenCalledTimes(1); // no change with custom eq
			});
		});

		describe('subscribeToKeys', () => {
			it('should notify when any subscribed key changes', () => {
				const store = createStore('dxSubKeys', { a: 1, b: 2, c: 3 });
				const callback = vi.fn();

				store.subscribeToKeys(['a', 'b'], callback);

				// @ts-expect-error testing proxy assignment
				store.a = 10;
				expect(callback).toHaveBeenCalledWith({ a: 10, b: 2 });

				// @ts-expect-error testing proxy assignment
				store.c = 30;
				expect(callback).toHaveBeenCalledTimes(1); // c not subscribed
			});
		});

		describe('batch returning value', () => {
			it('should return the result of the callback', () => {
				const store = createStore('dxBatchReturn', { count: 5 });
				const result = store.batch(() => {
					// @ts-expect-error testing proxy assignment
					store.count = 10;
					return store.count.value * 2;
				});
				expect(result).toBe(20);
				expect(store.get('count')).toBe(10);
			});
		});

		describe('destroy', () => {
			it('should clear all subscribers', () => {
				const store = createStore('dxDestroySub', { count: 0 });
				const callback = vi.fn();
				store.subscribe(callback);

				store.destroy();

				// @ts-expect-error testing proxy assignment
				store.count = 1;
				expect(callback).not.toHaveBeenCalled();
			});

			it('should remove from registry', async () => {
				const store = createStore('dxDestroyReg', { count: 0 });
				const { hasStore } = await import('../registry/index.js');
				expect(hasStore('dxDestroyReg')).toBe(true);
				store.destroy();
				expect(hasStore('dxDestroyReg')).toBe(false);
			});

			it('should prevent action calls after destroy', () => {
				const store = createStore('dxDestroyAction', {
					count: 0,
					increment() {
						this.count.value++;
					},
				});
				store.destroy();
				expect(() => {
					store.increment();
				}).toThrow(
					'Cannot call action "increment" on destroyed store "dxDestroyAction"'
				);
			});

			it('should clean up computed selectors', () => {
				const store = createStore('dxDestroyComputed', { count: 1 });
				const doubled = store.computed(
					(snap) => (snap.count as number) * 2
				);
				expect(doubled.value).toBe(2);

				store.destroy();
				// @ts-expect-error testing proxy assignment
				store.count = 5;
				// After destroy, computed should not update
				expect(doubled.value).toBe(2);
			});
		});

		describe('getSnapshot omits actions', () => {
			it('should not include actions in snapshot', () => {
				const store = createStore('dxSnapshot', {
					count: 0,
					increment() {
						this.count.value++;
					},
				});
				const snap = store.getSnapshot();
				expect(Object.keys(snap)).toEqual(['count']);
				expect(snap).toEqual({ count: 0 });
			});
		});
	});
});
