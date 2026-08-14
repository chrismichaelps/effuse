import { describe, expect, it, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import { batch } from '../reactivity/dep.js';
import { asyncComputed } from '../reactivity/async-computed.js';

/** Yields to the microtask queue so pending loads can settle. */
const flush = async (times = 3): Promise<void> => {
	for (let i = 0; i < times; i += 1) await Promise.resolve();
};

/** A promise plus the handles to settle it later, for driving deliberate races. */
const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

describe('the basics', () => {
	it('loads on creation and exposes the value', async () => {
		const id = signal(1);
		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => Promise.resolve(`user-${String(value)}`),
		});

		expect(derived.loading).toBe(true);
		await derived.whenSettled();

		expect(derived.value).toBe('user-1');
		expect(derived.loading).toBe(false);
		expect(derived.settled).toBe(true);
		expect(derived.error).toBeUndefined();

		derived.dispose();
	});

	it('shows the initial value before the first load settles', async () => {
		const derived = asyncComputed({
			source: () => 1,
			initialValue: 'placeholder',
			load: () => Promise.resolve('loaded'),
		});

		expect(derived.value).toBe('placeholder');
		await derived.whenSettled();
		expect(derived.value).toBe('loaded');

		derived.dispose();
	});

	it('reloads when the source changes', async () => {
		const id = signal(1);
		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => Promise.resolve(`user-${String(value)}`),
		});

		await derived.whenSettled();
		expect(derived.value).toBe('user-1');

		id.value = 2;
		await derived.whenSettled();

		expect(derived.value).toBe('user-2');

		derived.dispose();
	});

	it('does not reload when the source is unchanged', async () => {
		const unrelated = signal(0);
		const id = signal(1);
		const load = vi.fn(() => Promise.resolve('value'));

		const derived = asyncComputed({ source: () => id.value, load });
		await derived.whenSettled();
		expect(load).toHaveBeenCalledTimes(1);

		// Touching a signal the source does not read must not reload.
		unrelated.value = 1;
		await flush();
		expect(load).toHaveBeenCalledTimes(1);

		// Nor must setting the source to the value it already holds.
		id.value = 1;
		await flush();
		expect(load).toHaveBeenCalledTimes(1);

		derived.dispose();
	});
});

describe('dependency tracking', () => {
	it('tracks every signal the source reads, not only the first', async () => {
		// The case VueUse's computedAsync cannot do: it tracks only dependencies
		// referenced before the first await, so a second one silently never
		// re-triggers. Here the source is synchronous, so there is no "before the
		// await" to be on the wrong side of.
		const first = signal(1);
		const second = signal('a');
		const load = vi.fn((source: { a: number; b: string }) =>
			Promise.resolve(`${String(source.a)}${source.b}`)
		);

		const derived = asyncComputed({
			source: () => ({ a: first.value, b: second.value }),
			equals: (x, y) => x.a === y.a && x.b === y.b,
			load,
		});

		await derived.whenSettled();
		expect(derived.value).toBe('1a');

		second.value = 'b';
		await derived.whenSettled();
		expect(derived.value).toBe('1b');

		first.value = 2;
		await derived.whenSettled();
		expect(derived.value).toBe('2b');

		expect(load).toHaveBeenCalledTimes(3);

		derived.dispose();
	});

	it('honours a custom equality so an object source does not reload per recompute', async () => {
		// Without `equals`, an object literal source produces a new reference every
		// recomputation and reloads forever.
		const id = signal(1);
		const unrelated = signal(0);
		const load = vi.fn(() => Promise.resolve('value'));

		const derived = asyncComputed({
			source: () => ({ id: id.value }),
			equals: (a, b) => a.id === b.id,
			load,
		});

		await derived.whenSettled();
		unrelated.value = 1;
		await flush();

		expect(load).toHaveBeenCalledTimes(1);

		derived.dispose();
	});

	it('re-runs when a dependency registered via ctx.track changes', async () => {
		// The documented escape hatch, for a dependency only discoverable after a
		// first request.
		const id = signal(1);
		const locale = signal('en');
		const load = vi.fn((value: number, ctx: { track: typeof locale.value extends never ? never : <T>(s: { value: T }) => T }) =>
			Promise.resolve(`${String(value)}-${ctx.track(locale)}`)
		);

		const derived = asyncComputed({
			source: () => id.value,
			load: load as never,
		});

		await derived.whenSettled();
		expect(derived.value).toBe('1-en');

		locale.value = 'fr';
		await derived.whenSettled();

		expect(derived.value).toBe('1-fr');

		derived.dispose();
	});
});

describe('glitch freedom', () => {
	it('produces one load when two source signals change in a batch', async () => {
		// Two changes in one batch are one logical change. Loading twice would
		// double the request count and briefly show a value derived from a mixed
		// state that never existed.
		const first = signal(1);
		const second = signal(1);
		const load = vi.fn(() => Promise.resolve('value'));

		const derived = asyncComputed({
			source: () => ({ a: first.value, b: second.value }),
			equals: (x, y) => x.a === y.a && x.b === y.b,
			load,
		});

		await derived.whenSettled();
		expect(load).toHaveBeenCalledTimes(1);

		batch(() => {
			first.value = 2;
			second.value = 2;
		});
		await derived.whenSettled();

		expect(load).toHaveBeenCalledTimes(2);

		derived.dispose();
	});

	it('does not loop when a load settles', async () => {
		// Regression: `run` executes synchronously inside the effect, so reading a
		// state signal there would make it an effect dependency — settling would
		// re-run the effect, which reloads, which settles. An infinite loop that
		// only appears once something actually resolves.
		const load = vi.fn(() => Promise.resolve('value'));

		const derived = asyncComputed({ source: () => 1, load });

		await derived.whenSettled();
		await flush(10);

		expect(load).toHaveBeenCalledTimes(1);

		derived.dispose();
	});
});

describe('race protection', () => {
	it('discards a superseded run even when it resolves last', async () => {
		// The lost-update bug. Timings are deliberately inverted so the stale
		// request wins the race, which is exactly when hand-rolled versions break.
		const id = signal(1);
		const first = deferred<string>();
		const second = deferred<string>();

		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => (value === 1 ? first.promise : second.promise),
		});

		await flush();
		id.value = 2;
		await flush();

		// The newer request finishes first.
		second.resolve('from-2');
		await flush();
		expect(derived.value).toBe('from-2');

		// The older one finishes afterwards and must be ignored.
		first.resolve('from-1');
		await flush();

		expect(derived.value).toBe('from-2');

		derived.dispose();
	});

	it('ignores a superseded failure rather than reporting it', async () => {
		// A cancelled request is normal operation. Surfacing it would make every
		// keystroke in a search box report an error the user never caused.
		const id = signal(1);
		const first = deferred<string>();
		const second = deferred<string>();

		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => (value === 1 ? first.promise : second.promise),
		});

		await flush();
		id.value = 2;
		await flush();

		second.resolve('from-2');
		await flush();

		first.reject(new Error('stale request failed'));
		await flush();

		expect(derived.error).toBeUndefined();
		expect(derived.value).toBe('from-2');

		derived.dispose();
	});

	it('aborts the in-flight request when the source changes', async () => {
		const id = signal(1);
		const seen: AbortSignal[] = [];

		const derived = asyncComputed({
			source: () => id.value,
			load: (_value, ctx) => {
				seen.push(ctx.signal);
				return new Promise<string>(() => undefined);
			},
		});

		await flush();
		expect(seen[0]?.aborted).toBe(false);

		id.value = 2;
		await flush();

		expect(seen[0]?.aborted).toBe(true);
		expect(seen[1]?.aborted).toBe(false);

		derived.dispose();
	});

	it('reports abort through throwIfAborted', async () => {
		const id = signal(1);
		let reached = false;

		const derived = asyncComputed({
			source: () => id.value,
			load: async (_value, ctx) => {
				await Promise.resolve();
				ctx.throwIfAborted();
				reached = true;
				return 'done';
			},
		});

		id.value = 2;
		await flush(5);

		// The first run threw at the checkpoint rather than continuing, and the
		// throw was recognised as cancellation rather than failure.
		expect(derived.error).toBeUndefined();
		expect(reached).toBe(true); // the second run completed

		derived.dispose();
	});
});

describe('errors', () => {
	it('captures a rejection as state rather than throwing on read', async () => {
		// Reading must never throw. A throw during render is a crash, and an
		// error boundary is a worse place to handle a failed fetch than a branch.
		const derived = asyncComputed({
			source: () => 1,
			load: () => Promise.reject(new Error('boom')),
		});

		await derived.whenSettled();

		expect(() => derived.value).not.toThrow();
		expect(derived.value).toBeUndefined();
		expect((derived.error as Error).message).toBe('boom');
		expect(derived.loading).toBe(false);
		expect(derived.settled).toBe(true);

		derived.dispose();
	});

	it('captures a loader that throws synchronously', async () => {
		// A loader that throws before returning a promise must land on the same
		// path, not escape as an unhandled rejection.
		const derived = asyncComputed({
			source: () => 1,
			load: () => {
				throw new Error('sync boom');
			},
		});

		await derived.whenSettled();

		expect((derived.error as Error).message).toBe('sync boom');

		derived.dispose();
	});

	it('clears a previous error on a successful reload', async () => {
		const id = signal(1);
		const derived = asyncComputed({
			source: () => id.value,
			load: (value) =>
				value === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok'),
		});

		await derived.whenSettled();
		expect(derived.error).toBeDefined();

		id.value = 2;
		await derived.whenSettled();

		expect(derived.error).toBeUndefined();
		expect(derived.value).toBe('ok');

		derived.dispose();
	});

	it('reports failures through onError, and cancellations never', async () => {
		const id = signal(1);
		const onError = vi.fn();
		const first = deferred<string>();

		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => (value === 1 ? first.promise : Promise.resolve('ok')),
			onError,
		});

		await flush();
		id.value = 2;
		await flush();

		first.reject(new Error('superseded failure'));
		await flush(5);

		expect(onError).not.toHaveBeenCalled();

		derived.dispose();
	});
});

describe('stale while revalidate', () => {
	it('keeps the previous value and marks it stale while reloading', async () => {
		const id = signal(1);
		const pending = deferred<string>();

		const derived = asyncComputed({
			source: () => id.value,
			load: (value) => (value === 1 ? Promise.resolve('first') : pending.promise),
		});

		await derived.whenSettled();
		expect(derived.value).toBe('first');
		expect(derived.stale).toBe(false);

		id.value = 2;
		await flush();

		// The old value is still readable, and flagged as belonging to a
		// superseded source rather than silently presented as current.
		expect(derived.value).toBe('first');
		expect(derived.stale).toBe(true);
		expect(derived.loading).toBe(true);

		pending.resolve('second');
		await flush();

		expect(derived.value).toBe('second');
		expect(derived.stale).toBe(false);

		derived.dispose();
	});

	it('blanks the value when keepPreviousValue is off', async () => {
		const id = signal(1);
		const pending = deferred<string>();

		const derived = asyncComputed({
			source: () => id.value,
			keepPreviousValue: false,
			load: (value) => (value === 1 ? Promise.resolve('first') : pending.promise),
		});

		await derived.whenSettled();
		id.value = 2;
		await flush();

		expect(derived.value).toBeUndefined();
		expect(derived.stale).toBe(false);

		derived.dispose();
	});

	it('is not stale on the very first load', async () => {
		const derived = asyncComputed({
			source: () => 1,
			load: () => new Promise<string>(() => undefined),
		});

		await flush();

		expect(derived.stale).toBe(false);

		derived.dispose();
	});
});

describe('retry', () => {
	it('retries up to the configured number of attempts', async () => {
		let calls = 0;
		const derived = asyncComputed({
			source: () => 1,
			retry: { attempts: 2, delayMs: () => 0 },
			load: () => {
				calls += 1;
				return calls < 3
					? Promise.reject(new Error('transient'))
					: Promise.resolve('recovered');
			},
		});

		await derived.whenSettled();

		expect(calls).toBe(3);
		expect(derived.value).toBe('recovered');
		expect(derived.error).toBeUndefined();

		derived.dispose();
	});

	it('gives up after the limit and reports the last error', async () => {
		let calls = 0;
		const derived = asyncComputed({
			source: () => 1,
			retry: { attempts: 1, delayMs: () => 0 },
			load: () => {
				calls += 1;
				return Promise.reject(new Error(`fail-${String(calls)}`));
			},
		});

		await derived.whenSettled();

		expect(calls).toBe(2);
		expect((derived.error as Error).message).toBe('fail-2');

		derived.dispose();
	});

	it('stops early when shouldRetry declines', async () => {
		// A 404 will not become a 200 by asking again; retrying it wastes time and
		// delays showing the user the truth.
		let calls = 0;
		const derived = asyncComputed({
			source: () => 1,
			retry: {
				attempts: 5,
				delayMs: () => 0,
				shouldRetry: (error) => (error as Error).message !== 'not-found',
			},
			load: () => {
				calls += 1;
				return Promise.reject(new Error('not-found'));
			},
		});

		await derived.whenSettled();

		expect(calls).toBe(1);

		derived.dispose();
	});

	it('exposes the attempt number while retrying', async () => {
		let calls = 0;
		const derived = asyncComputed({
			source: () => 1,
			retry: { attempts: 2, delayMs: () => 0 },
			load: () => {
				calls += 1;
				return calls < 3
					? Promise.reject(new Error('transient'))
					: Promise.resolve('ok');
			},
		});

		await derived.whenSettled();

		expect(derived.attempt).toBe(2);

		derived.dispose();
	});

	it('abandons a retry when the source changes mid-backoff', async () => {
		// Otherwise a slow backoff keeps a superseded request alive and it commits
		// after the user has already moved on.
		const id = signal(1);
		let firstSourceCalls = 0;

		const derived = asyncComputed({
			source: () => id.value,
			retry: { attempts: 5, delayMs: () => 50 },
			load: (value) => {
				if (value === 1) {
					firstSourceCalls += 1;
					return Promise.reject(new Error('transient'));
				}
				return Promise.resolve('second');
			},
		});

		await flush(3);
		const callsBeforeChange = firstSourceCalls;

		id.value = 2;
		await derived.whenSettled();

		expect(derived.value).toBe('second');
		expect(derived.error).toBeUndefined();

		// The backoff timer was cancelled rather than firing into a dead run.
		await new Promise((resolve) => setTimeout(resolve, 120));
		expect(firstSourceCalls).toBe(callsBeforeChange);
		expect(derived.value).toBe('second');

		derived.dispose();
	});
});

describe('refresh', () => {
	it('reloads even though the source has not changed', async () => {
		const load = vi.fn(() => Promise.resolve('value'));
		const derived = asyncComputed({ source: () => 1, load });

		await derived.whenSettled();
		expect(load).toHaveBeenCalledTimes(1);

		derived.refresh();
		await derived.whenSettled();

		expect(load).toHaveBeenCalledTimes(2);

		derived.dispose();
	});

	it('supersedes an in-flight run', async () => {
		const first = deferred<string>();
		let call = 0;

		const derived = asyncComputed({
			source: () => 1,
			load: () => {
				call += 1;
				return call === 1 ? first.promise : Promise.resolve('second');
			},
		});

		await flush();
		derived.refresh();
		await flush();

		first.resolve('first');
		await flush();

		expect(derived.value).toBe('second');

		derived.dispose();
	});
});

describe('immediate', () => {
	it('skips the initial load when disabled', async () => {
		const load = vi.fn(() => Promise.resolve('value'));
		const derived = asyncComputed({ source: () => 1, load, immediate: false });

		await flush();

		expect(load).not.toHaveBeenCalled();
		expect(derived.loading).toBe(false);

		derived.dispose();
	});

	it('still loads on a later source change', async () => {
		// The option defers the first fetch; it does not make the computation
		// permanently manual.
		const id = signal(1);
		const load = vi.fn((value: number) => Promise.resolve(`v${String(value)}`));

		const derived = asyncComputed({
			source: () => id.value,
			load,
			immediate: false,
		});

		await flush();
		expect(load).not.toHaveBeenCalled();

		id.value = 2;
		await derived.whenSettled();

		expect(derived.value).toBe('v2');

		derived.dispose();
	});

	it('loads on an explicit refresh', async () => {
		const load = vi.fn(() => Promise.resolve('value'));
		const derived = asyncComputed({ source: () => 1, load, immediate: false });

		derived.refresh();
		await derived.whenSettled();

		expect(derived.value).toBe('value');

		derived.dispose();
	});
});

describe('disposal', () => {
	it('aborts in-flight work', async () => {
		let captured: AbortSignal | undefined;

		const derived = asyncComputed({
			source: () => 1,
			load: (_value, ctx) => {
				captured = ctx.signal;
				return new Promise<string>(() => undefined);
			},
		});

		await flush();
		expect(captured?.aborted).toBe(false);

		derived.dispose();

		expect(captured?.aborted).toBe(true);
	});

	it('stops reacting to source changes', async () => {
		const id = signal(1);
		const load = vi.fn(() => Promise.resolve('value'));
		const derived = asyncComputed({ source: () => id.value, load });

		await derived.whenSettled();
		derived.dispose();

		id.value = 2;
		await flush();

		expect(load).toHaveBeenCalledTimes(1);
	});

	it('does not commit a load that resolves after disposal', async () => {
		const pending = deferred<string>();
		const derived = asyncComputed({
			source: () => 1,
			load: () => pending.promise,
		});

		await flush();
		derived.dispose();

		pending.resolve('too late');
		await flush();

		expect(derived.value).toBeUndefined();
	});

	it('releases anyone awaiting settlement', async () => {
		// A promise that can never resolve is a hang, and a hung test is worse
		// than a failing one.
		const derived = asyncComputed({
			source: () => 1,
			load: () => new Promise<string>(() => undefined),
		});

		const waiting = derived.whenSettled();
		derived.dispose();

		await expect(waiting).resolves.toBeUndefined();
	});

	it('is idempotent', async () => {
		const derived = asyncComputed({
			source: () => 1,
			load: () => Promise.resolve('value'),
		});

		await derived.whenSettled();

		expect(() => {
			derived.dispose();
			derived.dispose();
		}).not.toThrow();
	});

	it('ignores refresh after disposal', async () => {
		const load = vi.fn(() => Promise.resolve('value'));
		const derived = asyncComputed({ source: () => 1, load });

		await derived.whenSettled();
		derived.dispose();
		derived.refresh();
		await flush();

		expect(load).toHaveBeenCalledTimes(1);
	});
});

describe('rapid source changes', () => {
	it('settles on the value for the final source', async () => {
		// The search-box case: many changes in quick succession, each superseding
		// the last, with resolutions arriving in arbitrary order.
		const query = signal('a');
		const pending = new Map<string, ReturnType<typeof deferred<string>>>();

		const derived = asyncComputed({
			source: () => query.value,
			load: (value) => {
				const entry = deferred<string>();
				pending.set(value, entry);
				return entry.promise;
			},
		});

		await flush();
		for (const next of ['ab', 'abc', 'abcd']) {
			query.value = next;
			await flush();
		}

		// Resolve in reverse order, so every stale one lands after the current.
		pending.get('abcd')?.resolve('result-abcd');
		await flush();
		pending.get('abc')?.resolve('result-abc');
		pending.get('ab')?.resolve('result-ab');
		pending.get('a')?.resolve('result-a');
		await flush(5);

		expect(derived.value).toBe('result-abcd');
		expect(derived.error).toBeUndefined();

		derived.dispose();
	});

	it('leaves exactly one request unaborted', async () => {
		const query = signal(0);
		const signals: AbortSignal[] = [];

		const derived = asyncComputed({
			source: () => query.value,
			load: (_value, ctx) => {
				signals.push(ctx.signal);
				return new Promise<string>(() => undefined);
			},
		});

		await flush();
		for (let i = 1; i <= 5; i += 1) {
			query.value = i;
			await flush();
		}

		expect(signals).toHaveLength(6);
		expect(signals.filter((s) => !s.aborted)).toHaveLength(1);

		derived.dispose();
	});
});
