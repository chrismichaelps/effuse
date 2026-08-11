// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Deferred, useDeferredState } from '../../components/Deferred.js';
import { KeepAlive, type KeepAliveNode } from '../../components/KeepAlive.js';
import { signal } from '../../reactivity/index.js';
import { render } from '../../render/index.js';
import { createListNode, type EffuseChild } from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import {
	attachNodeResourceDisposer,
	getNodeResourceDisposer,
} from '../../render/node-resource.js';

describe('render node resource lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('cancels a Deferred timeout when its mounted node is cleaned up', async () => {
		const node = Deferred({
			timeout: 100,
			fallback: 'Loading',
			children: 'Ready',
		});
		const cleanup = render(node, document.querySelector('#app')!);
		await Promise.resolve();
		expect(vi.getTimerCount()).toBe(1);

		cleanup();
		vi.advanceTimersByTime(100);

		expect(vi.getTimerCount()).toBe(0);
		expect(useDeferredState(node).ready.value).toBe(false);
		if (node._tag !== 'List') throw new Error('Expected a List node');
		expect(node.children).toEqual([]);
	});

	it('invalidates Deferred microtasks queued before cleanup', async () => {
		const node = Deferred({ fallback: 'Loading', children: 'Ready' });
		const cleanup = render(node, document.querySelector('#app')!);
		await Promise.resolve();

		cleanup();
		await Promise.resolve();

		expect(useDeferredState(node).ready.value).toBe(false);
	});

	it('lets manual cancellation invalidate a Deferred microtask', async () => {
		const node = Deferred({ fallback: 'Loading', children: 'Ready' });
		if (node._tag !== 'List') throw new Error('Expected a List node');
		expect(node.children).toEqual(['Loading']);

		useDeferredState(node).cancel();
		await Promise.resolve();

		expect(useDeferredState(node).ready.value).toBe(false);
		expect(node.children).toEqual(['Loading']);
	});

	it('attaches KeepAlive scope cleanup to the renderer protocol', () => {
		const node = KeepAlive({ children: 'Kept' }) as KeepAliveNode;

		expect(getNodeResourceDisposer(node)).toBe(node._cleanup);
	});

	it('disposes a resource node once across repeated render cleanup', async () => {
		const dispose = vi.fn();
		const node = createListNode(['Resource']);
		attachNodeResourceDisposer(node, dispose);
		const cleanup = render(node, document.querySelector('#app')!);
		await Promise.resolve();

		cleanup();
		cleanup();

		expect(dispose).toHaveBeenCalledOnce();
	});

	it('runs sibling resource cleanup when node disposers fail', async () => {
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
		const cleanup = render([first, second], document.querySelector('#app')!);
		await Promise.resolve();

		expect(cleanup).toThrow(
			expect.objectContaining({
				errors: [firstFailure, secondFailure],
			})
		);
		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).toHaveBeenCalledOnce();
	});

	it('disposes replaced resource nodes and the currently mounted node', async () => {
		const firstDispose = vi.fn();
		const secondDispose = vi.fn();
		const first = createListNode(['First']);
		const second = createListNode(['Second']);
		attachNodeResourceDisposer(first, firstDispose);
		attachNodeResourceDisposer(second, secondDispose);
		const current = signal<EffuseChild>(first);
		const cleanup = render(current, document.querySelector('#app')!);
		await Promise.resolve();

		current.value = second;
		await Promise.resolve();
		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).not.toHaveBeenCalled();

		cleanup();
		expect(secondDispose).toHaveBeenCalledOnce();
	});

	it('disposes resource nodes after server rendering', async () => {
		const dispose = vi.fn();
		const node = createListNode(['Server resource']);
		attachNodeResourceDisposer(node, dispose);
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(runtime.run(() => renderToFragment(node, runtime))).toBe(
				'Server resource'
			);
			expect(dispose).toHaveBeenCalledOnce();
		} finally {
			await runtime.dispose();
		}
	});

	it('disposes resource nodes when server rendering fails', async () => {
		const dispose = vi.fn();
		const failure = new Error('render failed');
		const node = createListNode([
			() => {
				throw failure;
			},
		]);
		attachNodeResourceDisposer(node, dispose);
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(() => runtime.run(() => renderToFragment(node, runtime))).toThrow(
				failure
			);
			expect(dispose).toHaveBeenCalledOnce();
		} finally {
			await runtime.dispose();
		}
	});

	it('preserves server render and resource cleanup failures together', async () => {
		const renderFailure = new Error('render failed');
		const cleanupFailure = new Error('cleanup failed');
		const node = createListNode([
			() => {
				throw renderFailure;
			},
		]);
		attachNodeResourceDisposer(node, () => {
			throw cleanupFailure;
		});
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(() => runtime.run(() => renderToFragment(node, runtime))).toThrow(
				expect.objectContaining({
					errors: [renderFailure, cleanupFailure],
				})
			);
		} finally {
			await runtime.dispose();
		}
	});
});
