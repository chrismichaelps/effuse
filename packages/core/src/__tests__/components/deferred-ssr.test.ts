import { describe, expect, it, vi } from 'vitest';
import { Deferred, useDeferredState } from '../../components/Deferred.js';
import { renderToFragment, renderToString } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

describe('Deferred SSR behavior', () => {
	it('preserves standalone timer behavior outside an SSR render', () => {
		vi.useFakeTimers();
		try {
			const node = Deferred({
				timeout: 10,
				fallback: 'Loading',
				children: 'Ready',
			});
			if (node._tag !== 'List') throw new Error('Expected a List node');

			expect(node.children).toEqual(['Loading']);
			vi.advanceTimersByTime(10);
			expect(node.children).toEqual(['Ready']);
			useDeferredState(node).cancel();
		} finally {
			vi.useRealTimers();
		}
	});

	it.each([0, 25])(
		'renders children without scheduling work for timeout %i',
		async (timeout) => {
			const queueMicrotaskSpy = vi.fn();
			const setTimeoutSpy = vi.fn(() => 1);
			vi.stubGlobal('queueMicrotask', queueMicrotaskSpy);
			vi.stubGlobal('setTimeout', setTimeoutSpy);
			const runtime = await createSSRRuntime([]);

			try {
				const html = runtime.run(() =>
					renderToFragment(
						Deferred({
							timeout,
							fallback: 'Loading',
							children: 'Ready',
						}),
						runtime
					)
				);

				expect(html).toBe('Ready');
				expect(queueMicrotaskSpy).not.toHaveBeenCalled();
				expect(setTimeoutSpy).not.toHaveBeenCalled();
			} finally {
				await runtime.dispose();
				vi.unstubAllGlobals();
			}
		}
	);

	it('renders children without scheduling work in a full document', async () => {
		const queueMicrotaskSpy = vi.fn();
		const setTimeoutSpy = vi.fn(() => 1);
		vi.stubGlobal('queueMicrotask', queueMicrotaskSpy);
		vi.stubGlobal('setTimeout', setTimeoutSpy);
		const runtime = await createSSRRuntime([]);

		try {
			const result = runtime.run(() =>
				renderToString(
					Deferred({
						timeout: 25,
						fallback: 'Loading',
						children: 'Ready',
					}),
					'/',
					runtime
				)
			);

			expect(result.html).toContain('<div id="app">Ready</div>');
			expect(result.html).not.toContain('Loading');
			expect(queueMicrotaskSpy).not.toHaveBeenCalled();
			expect(setTimeoutSpy).not.toHaveBeenCalled();
		} finally {
			await runtime.dispose();
			vi.unstubAllGlobals();
		}
	});
});
