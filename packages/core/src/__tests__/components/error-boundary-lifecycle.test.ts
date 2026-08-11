// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { getErrorBoundaryController } from '../../components/error-boundary-runtime.js';
import { watchEffect } from '../../effects/effect.js';
import { render, unmount } from '../../render/index.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

describe('ErrorBoundary renderer ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('invalidates a queued notification when teardown wins the race', async () => {
		const boundary = ErrorBoundary({ children: 'Ready', fallback: 'Failed' });
		if (boundary._tag !== 'List') throw new Error('Expected a List node');
		const controller = getErrorBoundaryController(boundary);
		const container = document.querySelector('#app')!;
		render(boundary, container);
		await Promise.resolve();
		let evaluations = 0;
		const observer = watchEffect(() => {
			evaluations += 1;
			void boundary.children;
		});

		controller?.capture(new Error('async failure'), true);
		unmount(container);
		const evaluationsAfterUnmount = evaluations;
		await Promise.resolve();

		expect(evaluations).toBe(evaluationsAfterUnmount);
		expect(boundary.children).toEqual([]);
		expect(controller?.hasError()).toBe(false);
		observer.stop();
	});

	it('rejects retained controller captures after teardown', async () => {
		const onError = vi.fn();
		const boundary = ErrorBoundary({
			children: 'Ready',
			fallback: 'Failed',
			onError,
		});
		if (boundary._tag !== 'List') throw new Error('Expected a List node');
		const controller = getErrorBoundaryController(boundary);
		const container = document.querySelector('#app')!;
		render(boundary, container);
		await Promise.resolve();
		unmount(container);

		controller?.capture(new Error('late failure'), true);
		await Promise.resolve();

		expect(onError).not.toHaveBeenCalled();
		expect(controller?.hasError()).toBe(false);
		expect(boundary.children).toEqual([]);
	});

	it('revokes a reset function retained from the fallback', async () => {
		let retainedReset: (() => void) | undefined;
		const boundary = ErrorBoundary({
			children: 'Ready',
			fallback: (_error, reset) => {
				retainedReset = reset;
				return 'Failed';
			},
		});
		if (boundary._tag !== 'List') throw new Error('Expected a List node');
		const controller = getErrorBoundaryController(boundary);
		controller?.capture(new Error('failure'), false);
		expect(boundary.children).toEqual(['Failed']);
		const container = document.querySelector('#app')!;
		render(boundary, container);
		await Promise.resolve();
		let evaluations = 0;
		const observer = watchEffect(() => {
			evaluations += 1;
			void boundary.children;
		});

		unmount(container);
		const evaluationsAfterUnmount = evaluations;
		retainedReset?.();

		expect(evaluations).toBe(evaluationsAfterUnmount);
		expect(boundary.children).toEqual([]);
		observer.stop();
	});

	it('preserves capture and reset recovery while mounted', async () => {
		let reset: (() => void) | undefined;
		const onError = vi.fn();
		const failure = new Error('failure');
		const boundary = ErrorBoundary({
			children: 'Ready',
			fallback: (error, nextReset) => {
				expect(error).toBe(failure);
				reset = nextReset;
				return 'Failed';
			},
			onError,
		});
		if (boundary._tag !== 'List') throw new Error('Expected a List node');
		const controller = getErrorBoundaryController(boundary);
		const container = document.querySelector('#app')!;
		render(boundary, container);
		await Promise.resolve();

		controller?.capture(failure, false);
		expect(boundary.children).toEqual(['Failed']);
		expect(onError).toHaveBeenCalledOnce();

		reset?.();
		expect(boundary.children).toEqual(['Ready']);
		unmount(container);
	});

	it('disposes boundary state after synchronous SSR recovery', async () => {
		const failure = new Error('server render failed');
		const boundary = ErrorBoundary({
			children: () => {
				throw failure;
			},
			fallback: (error) => (error === failure ? 'Server failed' : 'Wrong error'),
		});
		if (boundary._tag !== 'List') throw new Error('Expected a List node');
		const controller = getErrorBoundaryController(boundary);
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(runtime.run(() => renderToFragment(boundary, runtime))).toBe(
				'Server failed'
			);
			expect(controller?.hasError()).toBe(false);
			expect(boundary.children).toEqual([]);
		} finally {
			await runtime.dispose();
		}
	});
});
