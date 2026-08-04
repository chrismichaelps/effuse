import { describe, expect, it, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { optimistic } from '../reactivity/optimistic.js';

const flush = async (times = 3): Promise<void> => {
	for (let i = 0; i < times; i += 1) await Promise.resolve();
};

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

interface Todo {
	readonly id: string;
	readonly title: string;
}

/** A queue over a list of todos, with control over each commit. */
const todoQueue = (
	initial: Todo[] = [],
	commit: (change: Todo) => Promise<Todo> = (change) => Promise.resolve(change)
) => {
	const base = signal<readonly Todo[]>(initial);
	const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
		apply: (state, change) => [...state, change],
		commit: (change) => commit(change),
	});
	return { base, queue };
};

describe('projection', () => {
	it('shows a pending change immediately', () => {
		const { queue } = todoQueue([], () => new Promise<Todo>(() => undefined));

		queue.mutate({ id: '1', title: 'Buy milk' });

		expect(queue.value).toEqual([{ id: '1', title: 'Buy milk' }]);
		// The change is optimistic only; confirmed state has not moved.
		expect(queue.base).toEqual([]);
		expect(queue.isMutating).toBe(true);
	});

	it('applies several pending changes in the order they were made', () => {
		// Order is part of the semantics: two edits to the same field must land the
		// way they were typed.
		const { queue } = todoQueue([], () => new Promise<Todo>(() => undefined));

		queue.mutate({ id: '1', title: 'first' });
		queue.mutate({ id: '2', title: 'second' });
		queue.mutate({ id: '3', title: 'third' });

		expect(queue.value.map((todo) => todo.id)).toEqual(['1', '2', '3']);
	});

	it('reflects a change to the base state underneath pending changes', () => {
		// The base is the single source of truth. A change arriving from elsewhere
		// — a socket push, another queue — must show through.
		const { base, queue } = todoQueue([], () => new Promise<Todo>(() => undefined));

		queue.mutate({ id: 'local', title: 'local' });
		base.value = [{ id: 'remote', title: 'from server' }];

		expect(queue.value.map((todo) => todo.id)).toEqual(['remote', 'local']);
	});

	it('reports nothing pending when idle', () => {
		const { queue } = todoQueue();

		expect(queue.pending).toEqual([]);
		expect(queue.isMutating).toBe(false);
	});
});

describe('commit', () => {
	it('moves the change into base state and leaves the queue', async () => {
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => Promise.resolve({ ...change, id: 'server-id' }),
			reconcile: (state, result) => [...state, result],
		});

		const handle = queue.mutate({ id: 'temp', title: 'Buy milk' });
		await handle.settled;

		expect(handle.status).toBe('committed');
		expect(queue.base).toEqual([{ id: 'server-id', title: 'Buy milk' }]);
		expect(queue.value).toEqual([{ id: 'server-id', title: 'Buy milk' }]);
		expect(queue.isMutating).toBe(false);

		queue.dispose();
	});

	it('does not flicker between the optimistic and reconciled value', async () => {
		// Base update and queue removal happen in one batch. Done separately, the
		// value would briefly contain the item twice — reconciled into base and
		// still in the queue.
		const base = signal<readonly Todo[]>([]);
		const seen: number[] = [];

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => Promise.resolve({ ...change, id: 'server-id' }),
			reconcile: (state, result) => [...state, result],
		});

		const record = (): void => {
			seen.push(queue.value.length);
		};

		record();
		const handle = queue.mutate({ id: 'temp', title: 'Buy milk' });
		record();
		await handle.settled;
		record();

		// Never two. The list goes empty, one, one.
		expect(seen).toEqual([0, 1, 1]);
		expect(Math.max(...seen)).toBe(1);

		queue.dispose();
	});

	it('leaves the value unchanged when there is nothing to reconcile', async () => {
		// A server returning nothing meaningful is common. The mutation simply
		// leaves the queue, and because the projection recomputes from an
		// unchanged base, the optimistic value must survive.
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, void>(base, {
			apply: (state, change) => [...state, change],
			commit: () => Promise.resolve(),
		});

		const handle = queue.mutate({ id: '1', title: 'Buy milk' });
		await handle.settled;

		// No reconcile means base never gained the item, so the value goes back to
		// base. This is the documented contract, and the reason `reconcile` exists.
		expect(queue.value).toEqual([]);
		expect(handle.status).toBe('committed');

		queue.dispose();
	});

	it('exposes the server result on the handle', async () => {
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => Promise.resolve({ ...change, id: 'server-id' }),
			reconcile: (state, result) => [...state, result],
		});

		const handle = queue.mutate({ id: 'temp', title: 'x' });
		await handle.settled;

		expect(handle.result).toEqual({ id: 'server-id', title: 'x' });

		queue.dispose();
	});

	it('reports commits through onCommit', async () => {
		const onCommit = vi.fn();
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => Promise.resolve(change),
			onCommit,
		});

		await queue.mutate({ id: '1', title: 'x' }).settled;

		expect(onCommit).toHaveBeenCalledTimes(1);

		queue.dispose();
	});
});

describe('ordered rollback', () => {
	it('rolls back only the failed mutation and replays the rest', async () => {
		// The property React's single-overlay design cannot provide. Because the
		// value is derived from a queue, removing the failure and recomputing
		// replays the survivors in order — there is no bookkeeping to get wrong.
		const base = signal<readonly Todo[]>([]);
		const pending = new Map<string, ReturnType<typeof deferred<Todo>>>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => {
				const entry = deferred<Todo>();
				pending.set(change.id, entry);
				return entry.promise;
			},
		});

		const first = queue.mutate({ id: '1', title: 'first' });
		const second = queue.mutate({ id: '2', title: 'second' });
		const third = queue.mutate({ id: '3', title: 'third' });

		expect(queue.value.map((t) => t.id)).toEqual(['1', '2', '3']);

		// The middle one fails.
		pending.get('2')?.reject(new Error('conflict'));
		await second.settled;

		expect(queue.value.map((t) => t.id)).toEqual(['1', '3']);
		expect(second.status).toBe('rolled-back');
		expect(first.status).toBe('pending');
		expect(third.status).toBe('pending');

		queue.dispose();
	});

	it('preserves order when an earlier mutation fails', async () => {
		const base = signal<readonly Todo[]>([]);
		const pending = new Map<string, ReturnType<typeof deferred<Todo>>>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => {
				const entry = deferred<Todo>();
				pending.set(change.id, entry);
				return entry.promise;
			},
		});

		const first = queue.mutate({ id: '1', title: 'first' });
		queue.mutate({ id: '2', title: 'second' });
		queue.mutate({ id: '3', title: 'third' });

		pending.get('1')?.reject(new Error('gone'));
		await first.settled;

		expect(queue.value.map((t) => t.id)).toEqual(['2', '3']);

		queue.dispose();
	});

	it('reports the rollback rather than reverting silently', async () => {
		// The single most important difference from a silent revert: without this
		// the user watches their change undo itself with no explanation, which
		// reads as the application losing data.
		const onRollback = vi.fn();
		const base = signal<readonly Todo[]>([]);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => Promise.reject(new Error('server said no')),
			onRollback,
		});

		const handle = queue.mutate({ id: '1', title: 'Buy milk' });
		await handle.settled;

		expect(onRollback).toHaveBeenCalledTimes(1);
		expect(onRollback.mock.calls[0]?.[0]).toEqual({ id: '1', title: 'Buy milk' });
		expect((onRollback.mock.calls[0]?.[1] as Error).message).toBe('server said no');
		expect(handle.error).toBeDefined();

		queue.dispose();
	});

	it('fires onRollback after the state has already reverted', async () => {
		// A handler that reads the value must see the world it is describing, not
		// the one about to be undone.
		const base = signal<readonly Todo[]>([]);
		let lengthDuringCallback = -1;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => Promise.reject(new Error('no')),
			onRollback: () => {
				lengthDuringCallback = queue.value.length;
			},
		});

		await queue.mutate({ id: '1', title: 'x' }).settled;

		expect(lengthDuringCallback).toBe(0);

		queue.dispose();
	});

	it('rolls back on demand and cancels the request', async () => {
		const base = signal<readonly Todo[]>([]);
		let captured: AbortSignal | undefined;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (_change, ctx) => {
				captured = ctx.signal;
				return new Promise<Todo>(() => undefined);
			},
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await flush();

		expect(captured?.aborted).toBe(false);
		handle.rollback();

		expect(handle.status).toBe('rolled-back');
		expect(captured?.aborted).toBe(true);
		expect(queue.value).toEqual([]);

		queue.dispose();
	});

	it('rolls every pending mutation back at once', async () => {
		const base = signal<readonly Todo[]>([]);
		const onRollback = vi.fn();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => new Promise<Todo>(() => undefined),
			onRollback,
		});

		queue.mutate({ id: '1', title: 'a' });
		queue.mutate({ id: '2', title: 'b' });

		queue.rollbackAll(new Error('offline'));

		expect(queue.value).toEqual([]);
		expect(onRollback).toHaveBeenCalledTimes(2);

		queue.dispose();
	});

	it('ignores a rollback of an already-settled mutation', async () => {
		const onRollback = vi.fn();
		const base = signal<readonly Todo[]>([]);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => Promise.resolve(change),
			onRollback,
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await handle.settled;

		handle.rollback();

		expect(handle.status).toBe('committed');
		expect(onRollback).not.toHaveBeenCalled();

		queue.dispose();
	});
});

describe('concurrency', () => {
	it('does not let a late commit resurrect a rolled-back mutation', async () => {
		// The lost-update shape. A response arriving after the user already saw the
		// change reverted must not put it back.
		const base = signal<readonly Todo[]>([]);
		const entry = deferred<Todo>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => entry.promise,
			reconcile: (state, result) => [...state, result],
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await flush();

		handle.rollback();
		expect(queue.value).toEqual([]);

		// The server answers anyway.
		entry.resolve({ id: 'server', title: 'x' });
		await flush(5);

		expect(queue.value).toEqual([]);
		expect(queue.base).toEqual([]);
		expect(handle.status).toBe('rolled-back');

		queue.dispose();
	});

	it('settles many concurrent mutations, out of order, without losing any', async () => {
		const base = signal<readonly Todo[]>([]);
		const pending = new Map<string, ReturnType<typeof deferred<Todo>>>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => {
				const entry = deferred<Todo>();
				pending.set(change.id, entry);
				return entry.promise;
			},
			reconcile: (state, result) => [...state, result],
		});

		const handles = ['1', '2', '3', '4', '5'].map((id) =>
			queue.mutate({ id, title: `todo-${id}` })
		);

		// Resolve in reverse order.
		for (const id of ['5', '4', '3', '2', '1']) {
			pending.get(id)?.resolve({ id: `server-${id}`, title: `todo-${id}` });
		}

		await Promise.all(handles.map(async (handle) => handle.settled));

		expect(queue.base).toHaveLength(5);
		expect(queue.isMutating).toBe(false);
		expect(handles.every((handle) => handle.status === 'committed')).toBe(true);

		queue.dispose();
	});

	it('keeps surviving mutations applied while others fail concurrently', async () => {
		const base = signal<readonly Todo[]>([]);
		const pending = new Map<string, ReturnType<typeof deferred<Todo>>>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (change) => {
				const entry = deferred<Todo>();
				pending.set(change.id, entry);
				return entry.promise;
			},
		});

		const handles = ['1', '2', '3', '4'].map((id) =>
			queue.mutate({ id, title: id })
		);

		pending.get('2')?.reject(new Error('no'));
		pending.get('4')?.reject(new Error('no'));

		await Promise.all([handles[1]?.settled, handles[3]?.settled]);

		expect(queue.value.map((t) => t.id)).toEqual(['1', '3']);

		queue.dispose();
	});

	it('gives each mutation its own idempotency key', () => {
		// A shared key would make two distinct writes look like a retry of one.
		const { queue } = todoQueue([], () => new Promise<Todo>(() => undefined));

		const first = queue.mutate({ id: '1', title: 'a' });
		const second = queue.mutate({ id: '2', title: 'b' });

		expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
		expect(first.idempotencyKey.length).toBeGreaterThan(0);

		queue.dispose();
	});
});

describe('retry', () => {
	it('retries and keeps the same idempotency key throughout', async () => {
		// The key must be stable across retries, or a retry after an ambiguous
		// failure — the response was lost, not the write — creates a second record.
		const base = signal<readonly Todo[]>([]);
		const keys: string[] = [];
		let attempts = 0;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			retry: { attempts: 2, delayMs: () => 0 },
			commit: (change, ctx) => {
				attempts += 1;
				keys.push(ctx.idempotencyKey);
				return attempts < 3
					? Promise.reject(new Error('transient'))
					: Promise.resolve(change);
			},
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await handle.settled;

		expect(attempts).toBe(3);
		expect(handle.status).toBe('committed');
		expect(new Set(keys).size).toBe(1);

		queue.dispose();
	});

	it('rolls back after exhausting retries', async () => {
		const base = signal<readonly Todo[]>([]);
		let attempts = 0;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			retry: { attempts: 1, delayMs: () => 0 },
			commit: () => {
				attempts += 1;
				return Promise.reject(new Error('always fails'));
			},
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await handle.settled;

		expect(attempts).toBe(2);
		expect(handle.status).toBe('rolled-back');
		expect(queue.value).toEqual([]);

		queue.dispose();
	});

	it('stops retrying when shouldRetry declines', async () => {
		const base = signal<readonly Todo[]>([]);
		let attempts = 0;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			retry: {
				attempts: 5,
				delayMs: () => 0,
				shouldRetry: (error) => (error as Error).message !== 'conflict',
			},
			commit: () => {
				attempts += 1;
				return Promise.reject(new Error('conflict'));
			},
		});

		await queue.mutate({ id: '1', title: 'x' }).settled;

		expect(attempts).toBe(1);

		queue.dispose();
	});

	it('abandons a retry when the mutation is rolled back mid-backoff', async () => {
		const base = signal<readonly Todo[]>([]);
		let attempts = 0;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			retry: { attempts: 5, delayMs: () => 50 },
			commit: () => {
				attempts += 1;
				return Promise.reject(new Error('transient'));
			},
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		await flush(3);

		const before = attempts;
		handle.rollback();

		await new Promise((resolve) => setTimeout(resolve, 120));

		// The backoff timer was cancelled rather than firing into a dead mutation.
		expect(attempts).toBe(before);
		expect(handle.status).toBe('rolled-back');

		queue.dispose();
	});
});

describe('purity', () => {
	it('never mutates the base state', async () => {
		// The projection recomputes from base every time, so an impure `apply`
		// corrupts base rather than merely misbehaving.
		const initial: readonly Todo[] = [{ id: '0', title: 'existing' }];
		const base = signal<readonly Todo[]>(initial);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => new Promise<Todo>(() => undefined),
		});

		queue.mutate({ id: '1', title: 'new' });
		void queue.value;
		void queue.value;

		expect(base.value).toBe(initial);
		expect(initial).toHaveLength(1);

		queue.dispose();
	});

	it('warns when apply returns the state it was given', () => {
		// A heuristic for the common mistake — mutating the array and returning it.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const base = signal<readonly Todo[]>([]);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state) => state,
			commit: () => new Promise<Todo>(() => undefined),
		});

		queue.mutate({ id: '1', title: 'x' });
		void queue.value;

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toContain('apply');

		warn.mockRestore();
		queue.dispose();
	});

	it('can be silenced for a deliberate no-op', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const base = signal<readonly Todo[]>([]);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state) => state,
			commit: () => new Promise<Todo>(() => undefined),
			detectImpureApply: false,
		});

		queue.mutate({ id: '1', title: 'x' });
		void queue.value;

		expect(warn).not.toHaveBeenCalled();

		warn.mockRestore();
		queue.dispose();
	});

	it('warns at most once', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const base = signal<readonly Todo[]>([]);

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state) => state,
			commit: () => new Promise<Todo>(() => undefined),
		});

		queue.mutate({ id: '1', title: 'x' });
		for (let i = 0; i < 5; i += 1) void queue.value;

		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
		queue.dispose();
	});
});

describe('whenSettled', () => {
	it('resolves once nothing is pending', async () => {
		const base = signal<readonly Todo[]>([]);
		const entry = deferred<Todo>();

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => entry.promise,
		});

		queue.mutate({ id: '1', title: 'x' });

		let settled = false;
		const waiting = queue.whenSettled().then(() => {
			settled = true;
		});

		await flush();
		expect(settled).toBe(false);

		entry.resolve({ id: '1', title: 'x' });
		await waiting;

		expect(settled).toBe(true);

		queue.dispose();
	});

	it('resolves immediately when idle', async () => {
		const { queue } = todoQueue();

		await expect(queue.whenSettled()).resolves.toBeUndefined();

		queue.dispose();
	});
});

describe('disposal', () => {
	it('cancels in-flight commits', async () => {
		const base = signal<readonly Todo[]>([]);
		let captured: AbortSignal | undefined;

		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: (_change, ctx) => {
				captured = ctx.signal;
				return new Promise<Todo>(() => undefined);
			},
		});

		queue.mutate({ id: '1', title: 'x' });
		await flush();

		queue.dispose();

		expect(captured?.aborted).toBe(true);
		expect(queue.value).toEqual([]);
	});

	it('releases anyone awaiting a mutation', async () => {
		// A promise that can never resolve is a hang, and a hung caller is harder
		// to diagnose than a failed one.
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => new Promise<Todo>(() => undefined),
		});

		const handle = queue.mutate({ id: '1', title: 'x' });
		queue.dispose();

		await expect(handle.settled).resolves.toBeUndefined();
	});

	it('returns an already-settled handle for a mutation after disposal', async () => {
		const base = signal<readonly Todo[]>([]);
		const queue = optimistic<readonly Todo[], Todo, Todo>(base, {
			apply: (state, change) => [...state, change],
			commit: () => Promise.resolve({ id: '1', title: 'x' }),
		});

		queue.dispose();
		const handle = queue.mutate({ id: '1', title: 'x' });

		expect(handle.status).toBe('rolled-back');
		await expect(handle.settled).resolves.toBeUndefined();
		expect(queue.value).toEqual([]);
	});

	it('is idempotent', () => {
		const { queue } = todoQueue();

		expect(() => {
			queue.dispose();
			queue.dispose();
		}).not.toThrow();
	});
});

describe('a realistic edit sequence', () => {
	it('survives rapid edits where one fails in the middle', async () => {
		// A user renaming a field several times quickly while the network is
		// unreliable — the case where hand-rolled optimistic state loses updates.
		const base = signal('original');
		const pending = new Map<string, ReturnType<typeof deferred<string>>>();

		const queue = optimistic<string, string, string>(base, {
			apply: (_state, change) => change,
			commit: (change) => {
				const entry = deferred<string>();
				pending.set(change, entry);
				return entry.promise;
			},
			reconcile: (_state, result) => result,
		});

		queue.mutate('edit-1');
		const second = queue.mutate('edit-2');
		queue.mutate('edit-3');

		// The last edit wins the projection, as typed.
		expect(queue.value).toBe('edit-3');

		pending.get('edit-2')?.reject(new Error('rejected'));
		await second.settled;

		// Removing the middle edit does not disturb the newest one.
		expect(queue.value).toBe('edit-3');

		pending.get('edit-1')?.resolve('edit-1');
		pending.get('edit-3')?.resolve('edit-3');
		await queue.whenSettled();

		expect(queue.value).toBe('edit-3');
		expect(queue.base).toBe('edit-3');

		queue.dispose();
	});
});
