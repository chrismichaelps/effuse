import { describe, expect, it } from 'vitest';
import { getSignalDep, signal } from '../../reactivity/signal.js';
import {
	SUSPEND_TOKEN,
	Suspense,
	type SuspendToken,
} from '../../suspense/Suspense.js';
import type { EffuseChild } from '../../render/node.js';
import type { Signal } from '../../types/index.js';

interface Deferred {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
	readonly reject: (error: unknown) => void;
}

interface SuspenseState {
	readonly exposed: {
		readonly boundary: {
			readonly pendingResources: Map<string, Promise<void>>;
			readonly registerPending: (
				resourceId: string,
				promise: Promise<void>
			) => void;
			readonly waitForAll: () => Promise<void>;
		};
		readonly isPending: Signal<boolean>;
		readonly shouldShowFallback: Signal<boolean>;
		readonly resolvedChildren: Signal<EffuseChild>;
	};
	readonly lifecycle: { readonly runCleanup: () => void };
}

const deferred = (): Deferred => {
	let resolve: (() => void) | undefined;
	let reject: ((error: unknown) => void) | undefined;
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return {
		promise,
		resolve: () => resolve?.(),
		reject: (error) => reject?.(error),
	};
};

const token = (resourceId: string, promise: Promise<void>): SuspendToken => ({
	[SUSPEND_TOKEN]: true,
	resourceId,
	promise,
});

const createState = (
	children: () => EffuseChild
): SuspenseState =>
	Suspense.state!({ fallback: 'loading', children }) as unknown as SuspenseState;

const flushPromises = async (): Promise<void> => {
	for (let index = 0; index < 4; index++) await Promise.resolve();
};

describe('Suspense lifecycle (issue #511)', () => {
	it('releases child dependencies when its component lifecycle ends', () => {
		const source = signal(0);
		let renders = 0;
		const state = createState(() => {
			renders++;
			return source.value;
		});

		expect(getSignalDep(source)?.subscriberCount).toBe(1);
		expect(renders).toBe(1);

		state.lifecycle.runCleanup();
		expect(getSignalDep(source)?.subscriberCount ?? 0).toBe(0);
		source.value++;
		expect(renders).toBe(1);
	});

	it('ignores token settlement and clears bookkeeping after teardown', async () => {
		const gate = deferred();
		const suspended = token('profile', gate.promise);
		let renders = 0;
		const state = createState(() => {
			renders++;
			throw suspended;
		});

		expect(state.exposed.boundary.pendingResources.size).toBe(1);
		state.lifecycle.runCleanup();
		expect(state.exposed.boundary.pendingResources.size).toBe(0);

		gate.resolve();
		await flushPromises();
		expect(renders).toBe(1);
		expect(state.exposed.boundary.pendingResources.size).toBe(0);
	});

	it('tracks pending state across a later suspension and resolution', async () => {
		const mode = signal<'ready' | 'suspend'>('ready');
		const gate = deferred();
		const suspended = token('details', gate.promise);
		const state = createState(() => {
			if (mode.value === 'suspend') throw suspended;
			return 'ready';
		});

		expect(state.exposed.isPending.value).toBe(false);
		expect(state.exposed.shouldShowFallback.value).toBe(false);
		mode.value = 'suspend';
		expect(state.exposed.isPending.value).toBe(true);
		expect(state.exposed.shouldShowFallback.value).toBe(true);

		mode.value = 'ready';
		gate.resolve();
		await flushPromises();
		expect(state.exposed.isPending.value).toBe(false);
		expect(state.exposed.shouldShowFallback.value).toBe(false);
		expect(state.exposed.resolvedChildren.value).toBe('ready');
		state.lifecycle.runCleanup();
	});

	it('ignores rejected tokens after teardown', async () => {
		const gate = deferred();
		const suspended = token('rejected', gate.promise);
		let renders = 0;
		const state = createState(() => {
			renders++;
			throw suspended;
		});

		state.lifecycle.runCleanup();
		gate.reject(new Error('late rejection'));
		await flushPromises();

		expect(renders).toBe(1);
		expect(state.exposed.boundary.pendingResources.size).toBe(0);
	});
});

describe('Suspense boundary waiting (issue #513)', () => {
	it('waits for resources registered while an active wait is settling', async () => {
		const first = deferred();
		const second = deferred();
		const state = createState(() => 'ready');
		const { boundary } = state.exposed;
		boundary.registerPending('first', first.promise);

		let settled = false;
		const waiting = boundary.waitForAll().then(() => {
			settled = true;
		});
		boundary.registerPending('second', second.promise);

		first.resolve();
		await flushPromises();
		expect(settled).toBe(false);
		expect(boundary.pendingResources.has('second')).toBe(true);

		second.resolve();
		await waiting;
		expect(boundary.pendingResources.size).toBe(0);
		state.lifecycle.runCleanup();
	});

	it('keeps a same-id replacement pending when the old promise settles', async () => {
		const replaced = deferred();
		const current = deferred();
		const state = createState(() => 'ready');
		const { boundary } = state.exposed;
		boundary.registerPending('profile', replaced.promise);
		boundary.registerPending('profile', current.promise);

		replaced.resolve();
		await flushPromises();
		expect(boundary.pendingResources.get('profile')).toBe(current.promise);

		let settled = false;
		const waiting = boundary.waitForAll().then(() => {
			settled = true;
		});
		await flushPromises();
		expect(settled).toBe(false);

		current.resolve();
		await waiting;
		expect(boundary.pendingResources.size).toBe(0);
		state.lifecycle.runCleanup();
	});

	it('removes a rejected resource while preserving waitForAll rejection', async () => {
		const gate = deferred();
		const state = createState(() => 'ready');
		const { boundary } = state.exposed;
		boundary.registerPending('failed', gate.promise);
		const waiting = boundary.waitForAll();

		gate.reject(new Error('load failed'));
		await expect(waiting).rejects.toThrow('load failed');
		expect(boundary.pendingResources.size).toBe(0);
		state.lifecycle.runCleanup();
	});

	it('resolves an empty boundary without scheduling pending work', async () => {
		const state = createState(() => 'ready');
		await expect(state.exposed.boundary.waitForAll()).resolves.toBeUndefined();
		state.lifecycle.runCleanup();
	});
});
