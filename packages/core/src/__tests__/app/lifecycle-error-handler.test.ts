// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { LifecycleError } from '../../blueprint/lifecycle.js';
import { defineLayer } from '../../layers/api/defineLayer.js';

const flushRenderer = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

describe('application lifecycle error handling', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('reports mount failures through the app error surface', async () => {
		const onError = vi.fn();
		const laterMount = vi.fn();
		const App = define({
			script: ({ onMount }) => {
				onMount(() => {
					throw new Error('mount failed');
				});
				onMount(laterMount);
				return {};
			},
			template: () => 'mounted',
		});
		const mounted = await createApp(App, { onError }).mount('#app');
		await flushRenderer();

		expect(onError).toHaveBeenCalledOnce();
		expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(LifecycleError);
		expect(laterMount).toHaveBeenCalledOnce();
		expect(document.querySelector('#app')?.textContent).toBe('mounted');
		await mounted.unmount();
	});

	it('reports to console when no app handler is configured', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		const App = define({
			script: ({ onMount }) => {
				onMount(() => {
					throw new Error('visible failure');
				});
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		await flushRenderer();

		expect(consoleError).toHaveBeenCalledOnce();
		expect(consoleError.mock.calls[0]?.[0]).toBeInstanceOf(LifecycleError);
		await mounted.unmount();
	});

	it('reports handler failures without interrupting sibling callbacks', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		const laterMount = vi.fn();
		const App = define({
			script: ({ onMount }) => {
				onMount(() => {
					throw new Error('mount failed');
				});
				onMount(laterMount);
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App, {
			onError: () => {
				throw new Error('handler failed');
			},
		}).mount('#app');
		await flushRenderer();

		expect(laterMount).toHaveBeenCalledOnce();
		expect(consoleError).toHaveBeenCalledOnce();
		expect(consoleError.mock.calls[0]?.[0]).toBeInstanceOf(AggregateError);
		await mounted.unmount();
	});

	it('rejects unmount after every cleanup has run', async () => {
		const calls: string[] = [];
		const App = define({
			script: ({ onUnmount }) => {
				onUnmount(() => {
					calls.push('first');
					throw new Error('first failed');
				});
				onUnmount(() => {
					calls.push('second');
				});
				return {};
			},
			template: () => null,
		});
		const mounted = await createApp(App).mount('#app');
		await flushRenderer();

		await expect(mounted.unmount()).rejects.toBeInstanceOf(LifecycleError);
		expect(calls).toEqual(['second', 'first']);
		expect(document.querySelector('#app')?.innerHTML).toBe('');
	});

	it('keeps error handlers isolated across concurrently mounted roots', async () => {
		document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
		const firstHandler = vi.fn();
		const secondHandler = vi.fn();
		const failingApp = (message: string) =>
			define({
				script: ({ onMount }) => {
					onMount(() => {
						throw new Error(message);
					});
					return {};
				},
				template: () => message,
			});

		const first = await createApp(failingApp('first'), {
			onError: firstHandler,
		}).mount('#first');
		const second = await createApp(failingApp('second'), {
			onError: secondHandler,
		}).mount('#second');
		await flushRenderer();

		expect(firstHandler).toHaveBeenCalledOnce();
		expect(secondHandler).toHaveBeenCalledOnce();
		expect(
			(firstHandler.mock.calls[0]?.[0] as LifecycleError).failures[0]?.error
		).toEqual(new Error('first'));
		expect(
			(secondHandler.mock.calls[0]?.[0] as LifecycleError).failures[0]?.error
		).toEqual(new Error('second'));
		await first.unmount();
		await second.unmount();
	});

	it('preserves component and layer cleanup failures', async () => {
		const componentCleanup = vi.fn();
		const layerCleanup = vi.fn();
		const App = define({
			script: ({ onUnmount }) => {
				onUnmount(() => {
					componentCleanup();
					throw new Error('component cleanup failed');
				});
				return {};
			},
			template: () => null,
		});
		const FailingLayer = defineLayer({
			name: 'failing-cleanup',
			setup: () => () => {
				layerCleanup();
				throw new Error('layer cleanup failed');
			},
		});
		const app = await createApp(App).useLayers([FailingLayer]);
		const mounted = await app.mount('#app');
		await flushRenderer();

		await expect(mounted.unmount()).rejects.toMatchObject({
			name: 'AggregateError',
			errors: [expect.any(LifecycleError), expect.any(Error)],
		});
		expect(componentCleanup).toHaveBeenCalledOnce();
		expect(layerCleanup).toHaveBeenCalledOnce();
	});

	it('preserves mount and cleanup failures together', async () => {
		const layerCleanup = vi.fn();
		const App = define({
			script: () => {
				throw new Error('component mount failed');
			},
			template: () => null,
		});
		const FailingLayer = defineLayer({
			name: 'mount-failure-cleanup',
			setup: () => () => {
					layerCleanup();
					throw new Error('layer cleanup failed');
				},
		});
		const app = await createApp(App).useLayers([FailingLayer]);

		await expect(app.mount('#app')).rejects.toMatchObject({
			name: 'AggregateError',
			errors: [expect.any(Error), expect.any(Error)],
		});
		expect(layerCleanup).toHaveBeenCalledOnce();
	});
});
