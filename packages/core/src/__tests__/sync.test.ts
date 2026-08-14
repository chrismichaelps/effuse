import { describe, expect, it, vi } from 'vitest';
import { signal } from '../reactivity/signal.js';
import {
	createLeaderElection,
	createMemoryTransportHub,
	createNoopTransport,
	syncedSignal,
	whenLeader,
} from '../sync/index.js';

/**
 * A controllable scheduler, so election timing is deterministic.
 *
 * Election is entirely about timeouts, and testing it against real timers
 * produces a suite that is either slow or flaky. Both outcomes mean the
 * interesting cases — crash handover, split brain — never get written.
 */
const createScheduler = () => {
	let current = 0;
	let seq = 0;
	const tasks = new Map<number, { at: number; fn: () => void }>();

	return {
		now: () => current,
		schedule: (fn: () => void, ms: number): (() => void) => {
			seq += 1;
			const id = seq;
			tasks.set(id, { at: current + ms, fn });
			return () => {
				tasks.delete(id);
			};
		},
		advance: (ms: number): void => {
			const target = current + ms;

			for (;;) {
				const due = [...tasks.entries()]
					.filter(([, task]) => task.at <= target)
					.sort((a, b) => a[1].at - b[1].at);

				const next = due[0];
				if (next === undefined) break;

				const [id, task] = next;
				tasks.delete(id);
				current = Math.max(current, task.at);
				task.fn();
			}

			current = target;
		},
	};
};

describe('transport', () => {
	it('delivers to peers but never to the sender', () => {
		const hub = createMemoryTransportHub();
		const a = hub.connect();
		const b = hub.connect();

		const seenByA: unknown[] = [];
		const seenByB: unknown[] = [];
		a.subscribe((m) => seenByA.push(m));
		b.subscribe((m) => seenByB.push(m));

		a.post({ hello: 'world' });

		expect(seenByA).toEqual([]);
		expect(seenByB).toEqual([{ hello: 'world' }]);
	});

	it('stops delivering to a closed participant', () => {
		const hub = createMemoryTransportHub();
		const a = hub.connect();
		const b = hub.connect();

		const seen: unknown[] = [];
		b.subscribe((m) => seen.push(m));

		b.close();
		a.post({ x: 1 });

		expect(seen).toEqual([]);
	});

	it('keeps delivering to peers when one handler throws', () => {
		// A sign-out reaching half the listeners is worse than one that logs an
		// error and reaches all of them.
		const hub = createMemoryTransportHub();
		const a = hub.connect();
		const b = hub.connect();

		let reached = false;
		b.subscribe(() => {
			throw new Error('bad handler');
		});
		b.subscribe(() => {
			reached = true;
		});

		expect(() => a.post({ x: 1 })).not.toThrow();
		expect(reached).toBe(true);
	});

	it('reports a no-op transport as disconnected', () => {
		const transport = createNoopTransport();

		expect(transport.connected).toBe(false);
		expect(() => transport.post({ x: 1 })).not.toThrow();
		expect(() => transport.close()).not.toThrow();
	});
});

describe('leader election', () => {
	const elect = (
		hub: ReturnType<typeof createMemoryTransportHub>,
		scheduler: ReturnType<typeof createScheduler>
	) =>
		createLeaderElection({
			name: 'socket',
			transport: hub.connect(),
			heartbeatMs: 100,
			timeoutMs: 300,
			now: scheduler.now,
			schedule: scheduler.schedule,
			preferHeartbeat: true,
		});

	it('elects exactly one leader among several tabs', () => {
		// The property the whole module exists for. Every tab opening its own
		// websocket is the failure being prevented.
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tabs = Array.from({ length: 5 }, () => elect(hub, scheduler));

		scheduler.advance(1000);

		expect(tabs.filter((tab) => tab.isLeader)).toHaveLength(1);

		for (const tab of tabs) tab.dispose();
	});

	it('hands leadership over when the leader closes cleanly', () => {
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tabs = Array.from({ length: 3 }, () => elect(hub, scheduler));
		scheduler.advance(1000);

		const leader = tabs.find((tab) => tab.isLeader);
		expect(leader).toBeDefined();
		leader?.dispose();

		scheduler.advance(1000);

		const survivors = tabs.filter((tab) => tab !== leader);
		expect(survivors.filter((tab) => tab.isLeader)).toHaveLength(1);

		for (const tab of tabs) tab.dispose();
	});

	it('hands leadership over when the leader crashes without cleanup', () => {
		// A tab killed by the OS runs no unload handler. A heartbeat is the only
		// thing that notices, which is exactly why the timeout exists.
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tabs = Array.from({ length: 3 }, () => elect(hub, scheduler));
		scheduler.advance(1000);

		const leader = tabs.find((tab) => tab.isLeader);
		expect(leader).toBeDefined();

		// Simulate a crash: the transport dies with no resignation announced.
		hub.closeAll();
		const survivors = tabs.filter((tab) => tab !== leader);

		// Reconnect the survivors, as they were never actually closed.
		const revived = survivors.map(() => elect(hub, scheduler));
		scheduler.advance(2000);

		expect(revived.filter((tab) => tab.isLeader)).toHaveLength(1);

		for (const tab of [...tabs, ...revived]) tab.dispose();
	});

	it('resolves a tie deterministically by the smallest id', () => {
		// Two tabs claiming at once must not both win. Arrival order differs per
		// tab, so the tie-break cannot depend on it.
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tabs = Array.from({ length: 4 }, () => elect(hub, scheduler));
		scheduler.advance(2000);

		const leaders = tabs.filter((tab) => tab.isLeader);
		expect(leaders).toHaveLength(1);

		const smallest = [...tabs].sort((a, b) => (a.id < b.id ? -1 : 1))[0];
		expect(leaders[0]?.id).toBe(smallest?.id);

		for (const tab of tabs) tab.dispose();
	});

	it('notifies subscribers when leadership changes', () => {
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tab = elect(hub, scheduler);
		const seen: boolean[] = [];
		tab.subscribe((isLeader) => seen.push(isLeader));

		scheduler.advance(1000);

		// Called immediately on subscribe, so a subscriber never misses the
		// transition it was created to observe.
		expect(seen[0]).toBe(false);
		expect(seen).toContain(true);

		tab.dispose();
	});

	it('elects immediately when there is no channel at all', () => {
		// The server-render and no-BroadcastChannel case: one participant needs no
		// coordination, and waiting out a timeout for peers that cannot reply would
		// leave the resource unowned.
		const election = createLeaderElection({
			name: 'socket',
			transport: createNoopTransport(),
		});

		expect(election.isLeader).toBe(true);

		election.dispose();
		expect(election.isLeader).toBe(false);
	});

	it('stops being leader after disposal', () => {
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();

		const tab = elect(hub, scheduler);
		scheduler.advance(1000);
		expect(tab.isLeader).toBe(true);

		tab.dispose();
		expect(tab.isLeader).toBe(false);
	});

	it('is idempotent on disposal', () => {
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();
		const tab = elect(hub, scheduler);

		expect(() => {
			tab.dispose();
			tab.dispose();
		}).not.toThrow();
	});
});

describe('whenLeader', () => {
	it('runs the task in exactly one tab', () => {
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();
		let running = 0;

		const tabs = Array.from({ length: 4 }, () =>
			whenLeader(
				() => {
					running += 1;
					return () => {
						running -= 1;
					};
				},
				{
					name: 'socket',
					transport: hub.connect(),
					heartbeatMs: 100,
					timeoutMs: 300,
					now: scheduler.now,
					schedule: scheduler.schedule,
					preferHeartbeat: true,
				}
			)
		);

		scheduler.advance(1000);

		expect(running).toBe(1);

		for (const tab of tabs) tab.dispose();
		expect(running).toBe(0);
	});

	it('releases the resource when leadership is lost, not only on disposal', () => {
		// A demoted tab that keeps its socket open makes the successor's connection
		// the second one rather than the only one.
		const hub = createMemoryTransportHub();
		const scheduler = createScheduler();
		let open = 0;

		const make = () =>
			whenLeader(
				() => {
					open += 1;
					return () => {
						open -= 1;
					};
				},
				{
					name: 'socket',
					transport: hub.connect(),
					heartbeatMs: 100,
					timeoutMs: 300,
					now: scheduler.now,
					schedule: scheduler.schedule,
					preferHeartbeat: true,
				}
			);

		const tabs = [make(), make(), make()];
		scheduler.advance(1000);
		expect(open).toBe(1);

		const leader = tabs.find((tab) => tab.isLeader());
		leader?.dispose();
		scheduler.advance(1000);

		// Still exactly one holder after handover.
		expect(open).toBe(1);

		for (const tab of tabs) tab.dispose();
		expect(open).toBe(0);
	});

	it('runs immediately with no channel', () => {
		let ran = false;
		const handle = whenLeader(
			() => {
				ran = true;
			},
			{ name: 'socket', transport: createNoopTransport() }
		);

		expect(ran).toBe(true);
		handle.dispose();
	});
});

describe('synced signal', () => {
	const connect = <T>(
		hub: ReturnType<typeof createMemoryTransportHub>,
		initial: T,
		now: () => number
	) => {
		const source = signal(initial);
		const synced = syncedSignal(source, {
			channel: 'app.state',
			transport: hub.connect(),
			now,
			reconcileOnWake: false,
		});
		return { source, synced };
	};

	it('propagates a write to other tabs', () => {
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const a = connect(hub, 'initial', now);
		const b = connect(hub, 'initial', now);

		a.source.value = 'changed';

		expect(b.source.value).toBe('changed');

		a.synced.dispose();
		b.synced.dispose();
	});

	it('propagates to every tab, not merely the first', () => {
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const a = connect(hub, 0, now);
		const others = Array.from({ length: 4 }, () => connect(hub, 0, now));

		a.source.value = 42;

		for (const other of others) {
			expect(other.source.value).toBe(42);
		}

		a.synced.dispose();
		for (const other of others) other.synced.dispose();
	});

	it('does not echo a received value back', () => {
		// Without the guard two tabs bounce a value between them forever.
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const a = connect(hub, 'x', now);
		const b = connect(hub, 'x', now);

		let posts = 0;
		const spy = hub.connect();
		spy.subscribe(() => {
			posts += 1;
		});

		a.source.value = 'y';

		// One update from A. B adopting it must not produce a second.
		expect(posts).toBe(1);
		expect(b.source.value).toBe('y');

		a.synced.dispose();
		b.synced.dispose();
		spy.close();
	});

	it('resolves a later write over an earlier one', () => {
		const hub = createMemoryTransportHub();
		let time = 100;

		const a = connect(hub, 'start', () => time);
		const b = connect(hub, 'start', () => time);

		time = 200;
		a.source.value = 'from-a';
		expect(b.source.value).toBe('from-a');

		time = 300;
		b.source.value = 'from-b';
		expect(a.source.value).toBe('from-b');

		a.synced.dispose();
		b.synced.dispose();
	});

	it('resolves an exact timestamp tie deterministically', () => {
		// Comparing timestamps alone leaves the outcome to arrival order, which
		// differs per tab — so two tabs can permanently disagree.
		const hub = createMemoryTransportHub();
		const frozen = () => 1000;

		const a = connect(hub, 'start', frozen);
		const b = connect(hub, 'start', frozen);

		a.source.value = 'from-a';
		b.source.value = 'from-b';

		// Both tabs must agree, whichever value won.
		expect(a.source.value).toBe(b.source.value);

		a.synced.dispose();
		b.synced.dispose();
	});

	it('lets a causally later write win despite an identical wall clock', () => {
		// The split-brain regression. B adopts A's value, then writes again. With a
		// raw wall-clock stamp that second write carries the same timestamp as the
		// value it replaces, the origin tie-break makes A reject it, and the two
		// tabs disagree permanently. A logical clock makes the later write strictly
		// greater, so it wins on merit rather than on identity.
		const hub = createMemoryTransportHub();
		const frozen = () => 1000;

		const a = connect(hub, 'start', frozen);
		const b = connect(hub, 'start', frozen);

		a.source.value = 'from-a';
		expect(b.source.value).toBe('from-a');

		// B now writes on top of what it just adopted. This is causally later.
		b.source.value = 'from-b';

		expect(b.source.value).toBe('from-b');
		expect(a.source.value).toBe('from-b');

		a.synced.dispose();
		b.synced.dispose();
	});

	it('converges after a long alternating exchange on a frozen clock', () => {
		// Repeated hand-offs are where an ordering scheme that is merely
		// almost-right drifts apart.
		const hub = createMemoryTransportHub();
		const frozen = () => 5000;

		const a = connect(hub, 0, frozen);
		const b = connect(hub, 0, frozen);

		for (let i = 1; i <= 20; i += 1) {
			if (i % 2 === 0) a.source.value = i;
			else b.source.value = i;

			expect(a.source.value).toBe(b.source.value);
		}

		expect(a.source.value).toBe(20);

		a.synced.dispose();
		b.synced.dispose();
	});

	it('honours a custom resolver', () => {
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const sourceA = signal(1);
		const sourceB = signal(1);

		// Largest value wins, regardless of who wrote last.
		const resolve = <T,>(
			mine: { value: T; at: number; origin: string },
			theirs: { value: T; at: number; origin: string }
		) => ((theirs.value as number) > (mine.value as number) ? theirs : mine);

		const syncedA = syncedSignal(sourceA, {
			channel: 'nums',
			transport: hub.connect(),
			now,
			reconcileOnWake: false,
			resolve,
		});
		const syncedB = syncedSignal(sourceB, {
			channel: 'nums',
			transport: hub.connect(),
			now,
			reconcileOnWake: false,
			resolve,
		});

		sourceA.value = 10;
		expect(sourceB.value).toBe(10);

		// A smaller value loses even though it is newer.
		sourceB.value = 5;
		expect(sourceA.value).toBe(10);

		syncedA.dispose();
		syncedB.dispose();
	});

	it('reconciles a tab that missed messages', () => {
		// A backgrounded tab can miss messages entirely — some browsers suspend
		// delivery — and would otherwise wake showing minutes-stale state.
		const hub = createMemoryTransportHub();
		let time = 100;

		const active = connect(hub, 'start', () => time);

		// A tab that was asleep: connected, but never received the update.
		const asleepSource = signal('start');
		const asleepTransport = hub.connect();
		let deliveries = 0;
		const unsub = asleepTransport.subscribe(() => {
			deliveries += 1;
		});
		unsub();

		const asleep = syncedSignal(asleepSource, {
			channel: 'app.state',
			transport: asleepTransport,
			now: () => time,
			reconcileOnWake: false,
		});

		time = 200;
		active.source.value = 'updated';

		time = 300;
		asleep.reconcile();

		expect(asleepSource.value).toBe('updated');
		expect(deliveries).toBe(0);

		active.synced.dispose();
		asleep.dispose();
	});

	it('ignores traffic on a different channel', () => {
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const source = signal('mine');
		const synced = syncedSignal(source, {
			channel: 'channel-a',
			transport: hub.connect(),
			now,
			reconcileOnWake: false,
		});

		const other = signal('theirs');
		const otherSynced = syncedSignal(other, {
			channel: 'channel-b',
			transport: hub.connect(),
			now,
			reconcileOnWake: false,
		});

		other.value = 'changed';

		expect(source.value).toBe('mine');

		synced.dispose();
		otherSynced.dispose();
	});

	it('stops syncing after disposal', () => {
		const hub = createMemoryTransportHub();
		let time = 0;
		const now = () => (time += 1);

		const a = connect(hub, 'x', now);
		const b = connect(hub, 'x', now);

		b.synced.dispose();
		a.source.value = 'changed';

		expect(b.source.value).toBe('x');

		a.synced.dispose();
	});

	it('is idempotent on disposal', () => {
		const hub = createMemoryTransportHub();
		const a = connect(hub, 'x', () => 1);

		expect(() => {
			a.synced.dispose();
			a.synced.dispose();
		}).not.toThrow();
	});
});

describe('server rendering', () => {
	// The whole surface must be safe to construct where there is no
	// BroadcastChannel, no document, and no peers.
	const withoutBrowserGlobals = (body: () => void): void => {
		const globals = globalThis as {
			BroadcastChannel?: unknown;
			document?: unknown;
		};
		const hadChannel = 'BroadcastChannel' in globals;
		const hadDocument = 'document' in globals;
		const channel = globals.BroadcastChannel;
		const doc = globals.document;

		delete globals.BroadcastChannel;
		delete globals.document;

		try {
			body();
		} finally {
			if (hadChannel) globals.BroadcastChannel = channel;
			if (hadDocument) globals.document = doc;
		}
	};

	it('creates a synced signal that behaves as an ordinary one', () => {
		withoutBrowserGlobals(() => {
			const source = signal('server-value');

			expect(() =>
				syncedSignal(source, { channel: 'app.state' })
			).not.toThrow();

			const synced = syncedSignal(source, { channel: 'app.state' });

			source.value = 'changed';
			expect(source.value).toBe('changed');

			synced.dispose();
		});
	});

	it('attaches no visibility listener when there is no document', () => {
		withoutBrowserGlobals(() => {
			const source = signal('x');
			// `reconcileOnWake` defaults to true; with no document it must simply not
			// attach rather than throw on a missing global.
			const synced = syncedSignal(source, { channel: 'app.state' });

			expect(() => synced.reconcile()).not.toThrow();
			synced.dispose();
		});
	});

	it('elects a leader immediately and runs the task', () => {
		withoutBrowserGlobals(() => {
			let ran = false;
			const handle = whenLeader(
				() => {
					ran = true;
				},
				{ name: 'socket' }
			);

			// One participant needs no coordination. Waiting for peers that cannot
			// reply would leave the resource unowned for the whole request.
			expect(ran).toBe(true);
			expect(handle.isLeader()).toBe(true);

			handle.dispose();
		});
	});

	it('schedules no timers', () => {
		// A server render must not leave work that outlives the request.
		withoutBrowserGlobals(() => {
			const spy = vi.spyOn(globalThis, 'setTimeout');
			const before = spy.mock.calls.length;

			const source = signal('x');
			const synced = syncedSignal(source, { channel: 'app.state' });
			const handle = whenLeader(() => undefined, { name: 'socket' });

			expect(spy.mock.calls.length).toBe(before);

			synced.dispose();
			handle.dispose();
			spy.mockRestore();
		});
	});
});
