// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { define } from '../../blueprint/define.js';
import { Await } from '../../components/Await.js';
import { watchEffect } from '../../effects/effect.js';
import { getSignalDep, signal } from '../../reactivity/index.js';
import { render, unmount } from '../../render/index.js';
import type { EffuseNode } from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

type ControlledAwaitNode = EffuseNode & {
	readonly _start: () => void;
	readonly _refresh: () => void;
};

describe('Await renderer ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('starts automatic work on first client render instead of construction', async () => {
		const run = deferred<string>();
		const factory = vi.fn(() => run.promise);
		const node = Await({
			promise: factory,
			pending: 'Loading',
			children: (value) => value,
		});
		expect(factory).not.toHaveBeenCalled();

		const container = document.querySelector('#app')!;
		render(node, container);
		await Promise.resolve();

		expect(factory).toHaveBeenCalledOnce();
		unmount(container);
	});

	it('unsubscribes from promise signals on teardown', async () => {
		const source = signal(Promise.resolve('first'));
		const dependency = getSignalDep(source);
		const node = Await({
			promise: source,
			pending: 'Loading',
			children: (value) => value,
		});
		const container = document.querySelector('#app')!;
		render(node, container);
		await Promise.resolve();
		expect(dependency?.hasSubscribers()).toBe(true);

		unmount(container);

		expect(dependency?.hasSubscribers()).toBe(false);
	});

	it('suppresses late promise writes after teardown', async () => {
		const run = deferred<string>();
		const renderSuccess = vi.fn((value: string) => value);
		const node = Await({
			promise: run.promise,
			pending: 'Loading',
			children: renderSuccess,
		});
		if (node._tag !== 'List') throw new Error('Expected a List node');
		const container = document.querySelector('#app')!;
		render(node, container);
		await Promise.resolve();
		let evaluations = 0;
		const observer = watchEffect(() => {
			evaluations += 1;
			void node.children;
		});

		unmount(container);
		const evaluationsAfterUnmount = evaluations;
		run.resolve('Late');
		await flushPromises();

		expect(evaluations).toBe(evaluationsAfterUnmount);
		expect(node.children).toEqual([]);
		expect(renderSuccess).not.toHaveBeenCalled();
		observer.stop();
	});

	it('revokes retained start and refresh controls after teardown', async () => {
		const factory = vi.fn(() => Promise.resolve('value'));
		const node = Await({
			promise: factory,
			defer: true,
			pending: 'Loading',
			children: (value) => value,
		}) as ControlledAwaitNode;
		const container = document.querySelector('#app')!;
		render(node, container);
		await Promise.resolve();
		unmount(container);

		node._start();
		node._refresh();
		await flushPromises();

		expect(factory).not.toHaveBeenCalled();
	});

	it('keeps the latest signal promise as the sole state owner', async () => {
		const first = deferred<string>();
		const second = deferred<string>();
		const source = signal(first.promise);
		const node = Await({
			promise: source,
			pending: 'Loading',
			children: (value) => value,
		});
		if (node._tag !== 'List') throw new Error('Expected a List node');
		const container = document.querySelector('#app')!;
		render(node, container);
		await Promise.resolve();
		source.value = second.promise;

		first.resolve('stale');
		await flushPromises();
		expect(node.children).toEqual(['Loading']);

		second.resolve('latest');
		await flushPromises();
		expect(node.children).toEqual(['latest']);
		unmount(container);
	});

	it('renders client failures through the existing error fallback', async () => {
		const failure = new Error('request failed');
		const node = Await({
			promise: Promise.reject(failure),
			pending: 'Loading',
			error: (error) => (error === failure ? 'Failed' : 'Wrong error'),
			children: (value) => value,
		});
		if (node._tag !== 'List') throw new Error('Expected a List node');
		const container = document.querySelector('#app')!;
		render(node, container);
		await flushPromises();

		expect(node.children).toEqual(['Failed']);
		unmount(container);
	});

	it('renders pending SSR content without starting or subscribing', async () => {
		const source = signal(Promise.resolve('signal result'));
		const dependency = getSignalDep(source);
		const factory = vi.fn(() => Promise.resolve('factory result'));
		const App = define({
			script: () => ({}),
			template: () => [
				Await({
					promise: factory,
					pending: 'Factory loading',
					children: (value) => value,
				}),
				Await({
					promise: source,
					pending: 'Signal loading',
					children: (value) => value,
				}),
			],
		});
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(runtime.run(() => renderToFragment(App, runtime))).toBe(
				'Factory loadingSignal loading'
			);
			expect(factory).not.toHaveBeenCalled();
			expect(dependency?.hasSubscribers()).toBe(false);
		} finally {
			await runtime.dispose();
		}
	});
});
