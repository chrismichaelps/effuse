// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Deferred, useDeferredState } from '../../components/Deferred.js';
import { hydrate, render, unmount } from '../../render/index.js';
import { createListNode } from '../../render/node.js';
import { attachNodeResourceDisposer } from '../../render/node-resource.js';

describe('public unmount cleanup ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('runs renderer cleanup registered by render', async () => {
		const container = document.querySelector('#app')!;
		const node = Deferred({
			timeout: 100,
			fallback: 'Loading',
			children: 'Ready',
		});
		render(node, container);
		await Promise.resolve();
		expect(vi.getTimerCount()).toBe(1);

		unmount(container);
		vi.advanceTimersByTime(100);

		expect(container.childNodes).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(useDeferredState(node).ready.value).toBe(false);
	});

	it('runs renderer cleanup registered by hydrate', () => {
		const container = document.querySelector('#app')!;
		container.textContent = 'Hydrated';
		const dispose = vi.fn();
		const node = createListNode(['Hydrated']);
		attachNodeResourceDisposer(node, dispose);
		hydrate(node, container);

		unmount(container);

		expect(dispose).toHaveBeenCalledOnce();
		expect(container.childNodes).toHaveLength(0);
	});

	it('revokes renderer work when unmounted before its mount microtask', async () => {
		const container = document.querySelector('#app')!;
		const dispose = vi.fn();
		const node = createListNode(['Queued']);
		attachNodeResourceDisposer(node, dispose);
		render(node, container);

		unmount(container);
		await Promise.resolve();

		expect(dispose).toHaveBeenCalledOnce();
		expect(container.childNodes).toHaveLength(0);
	});

	it('cleans every independently rendered root in a container', async () => {
		const container = document.querySelector('#app')!;
		const firstDispose = vi.fn();
		const secondDispose = vi.fn();
		const first = createListNode(['First']);
		const second = createListNode(['Second']);
		attachNodeResourceDisposer(first, firstDispose);
		attachNodeResourceDisposer(second, secondDispose);
		render(first, container);
		render(second, container);
		await Promise.resolve();

		unmount(container);

		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).toHaveBeenCalledOnce();
		expect(container.childNodes).toHaveLength(0);
	});

	it('does not repeat a cleanup already invoked by its returned handle', async () => {
		const container = document.querySelector('#app')!;
		const dispose = vi.fn();
		const node = createListNode(['Resource']);
		attachNodeResourceDisposer(node, dispose);
		const cleanup = render(node, container);
		await Promise.resolve();

		cleanup();
		cleanup();
		unmount(container);

		expect(dispose).toHaveBeenCalledOnce();
	});

	it('clears the container and aggregates failures from every root', async () => {
		const container = document.querySelector('#app')!;
		const firstFailure = new Error('first cleanup failed');
		const secondFailure = new Error('second cleanup failed');
		const firstDispose = vi.fn(() => {
			throw firstFailure;
		});
		const secondDispose = vi.fn(() => {
			throw secondFailure;
		});
		const first = createListNode(['First']);
		const second = createListNode(['Second']);
		attachNodeResourceDisposer(first, firstDispose);
		attachNodeResourceDisposer(second, secondDispose);
		render(first, container);
		render(second, container);
		await Promise.resolve();
		container.append(document.createElement('aside'));

		expect(() => unmount(container)).toThrow(
			expect.objectContaining({ errors: [firstFailure, secondFailure] })
		);
		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).toHaveBeenCalledOnce();
		expect(container.childNodes).toHaveLength(0);
	});
});
