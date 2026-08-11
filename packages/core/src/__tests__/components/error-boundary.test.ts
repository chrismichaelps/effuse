// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { getSignalDep, signal } from '../../reactivity/signal.js';
import {
	CreateBlueprintNode,
	CreateElementNode,
	CreateListNode,
	EFFUSE_NODE,
	type Component,
	type EffuseChild,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: EffuseChild[] = []
) => CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

const boundaryApp = (boundary: EffuseChild): Component =>
	define({
		script: () => ({}),
		template: () => boundary,
	}) as Component;

const component = (blueprint: Component): EffuseChild =>
	CreateBlueprintNode({
		[EFFUSE_NODE]: true,
		blueprint,
		props: {},
		portals: null,
	});

describe('ErrorBoundary render propagation (issue #487)', () => {
	let mounted: { unmount: () => Promise<void> } | undefined;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = undefined;
		document.body.innerHTML = '';
	});

	it('renders children without invoking the boundary on the happy path', async () => {
		const onError = vi.fn();
		mounted = await createApp(
			boundaryApp(
				ErrorBoundary({
					fallback: 'fallback',
					children: element('span', { 'data-testid': 'content' }, ['ready']),
					onError,
				})
			)
		).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="content"]')?.textContent).toBe(
			'ready'
		);
		expect(onError).not.toHaveBeenCalled();
	});

	it('renders the nearest fallback and reports the original error once', async () => {
		const onError = vi.fn();
		const failure = new Error('child exploded');
		mounted = await createApp(
			boundaryApp(
				ErrorBoundary({
					fallback: element('p', { 'data-testid': 'fallback' }, ['recovered']),
					children: () => {
						throw failure;
					},
					onError,
				})
			)
		).mount('#app');
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="fallback"]')?.textContent
		).toBe('recovered');
		expect(document.querySelector('[data-effuse-render-error]')).toBeNull();
		expect(onError).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(failure);
	});

	it('reset restores children after the failure condition clears', async () => {
		const shouldThrow = signal(true);
		const childCleanup = vi.fn();
		const Broken = define({
			script: ({ onUnmount }) => {
				onUnmount(childCleanup);
				return {};
			},
			template: () => {
				if (shouldThrow.value) throw new Error('retry me');
				return element('strong', { 'data-testid': 'restored' }, ['restored']);
			},
		});
		const boundary = ErrorBoundary({
			children: component(Broken as Component),
			fallback: (_error, reset) =>
				element(
					'button',
					{
						'data-testid': 'reset',
						onClick: () => {
							shouldThrow.value = false;
							reset();
						},
					},
					['retry']
				),
		});

		mounted = await createApp(boundaryApp(boundary)).mount('#app');
		await flushRenderer();
		expect(childCleanup).toHaveBeenCalledOnce();
		expect(getSignalDep(shouldThrow)?.subscriberCount).toBe(0);
		(
			document.querySelector('[data-testid="reset"]') as HTMLButtonElement
		).click();
		await flushRenderer();

		expect(document.querySelector('[data-testid="reset"]')).toBeNull();
		expect(
			document.querySelector('[data-testid="restored"]')?.textContent
		).toBe('restored');
	});

	it('does not let an inner failure escape to an outer boundary', async () => {
		const innerError = vi.fn();
		const outerError = vi.fn();
		const nested = ErrorBoundary({
			fallback: element('p', { 'data-testid': 'outer' }, ['outer']),
			onError: outerError,
			children: ErrorBoundary({
				fallback: element('p', { 'data-testid': 'inner' }, ['inner']),
				onError: innerError,
				children: () => {
					throw new Error('nested failure');
				},
			}),
		});

		mounted = await createApp(boundaryApp(nested)).mount('#app');
		await flushRenderer();

		expect(document.querySelector('[data-testid="inner"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="outer"]')).toBeNull();
		expect(innerError).toHaveBeenCalledOnce();
		expect(outerError).not.toHaveBeenCalled();
	});

	it('escalates a throwing onError callback without rendering its fallback', async () => {
		const innerFallback = vi.fn((): EffuseChild => 'inner fallback');
		const outerError = vi.fn();
		const nested = ErrorBoundary({
			fallback: element('p', { 'data-testid': 'outer-handler' }, [
				'outer handler recovery',
			]),
			onError: outerError,
			children: ErrorBoundary({
				fallback: innerFallback,
				onError: () => {
					throw new Error('onError exploded');
				},
				children: () => {
					throw new Error('inner child exploded');
				},
			}),
		});

		mounted = await createApp(boundaryApp(nested)).mount('#app');
		await flushRenderer();

		expect(
			document.querySelector('[data-testid="outer-handler"]')
		).not.toBeNull();
		expect(innerFallback).not.toHaveBeenCalled();
		expect(outerError).toHaveBeenCalledOnce();
		expect(outerError.mock.calls[0]?.[0]).toMatchObject({
			message: 'onError exploded',
		});
	});

	it('renders a diagnostic instead of looping when its fallback throws', async () => {
		const onError = vi.fn();
		const fallback = vi.fn((): EffuseChild => {
			throw new Error('fallback exploded');
		});
		mounted = await createApp(
			boundaryApp(
				ErrorBoundary({
					fallback,
					children: () => {
						throw new Error('child exploded');
					},
					onError,
				})
			)
		).mount('#app');
		await flushRenderer();

		expect(
			document.querySelector('[data-effuse-render-error]')?.textContent
		).toContain('fallback exploded');
		expect(onError).toHaveBeenCalledOnce();
		expect(fallback).toHaveBeenCalledOnce();
	});

	it('switches to the fallback during synchronous hydration', async () => {
		const createBoundary = (onError?: (error: Error) => void) =>
			ErrorBoundary({
				fallback: element('p', { 'data-testid': 'hydrated-fallback' }, [
					'hydrated recovery',
				]),
				children: CreateListNode({
					[EFFUSE_NODE]: true,
					children: [
						CreateListNode({
							[EFFUSE_NODE]: true,
							children: [
								() => {
									throw new Error('hydrate failure');
								},
							],
						}),
					],
				}),
				onError,
			});
		const runtime = await createSSRRuntime([]);
		let serverMarkup: string;
		try {
			serverMarkup = runtime.run(() =>
				renderToFragment(createBoundary() as never, runtime)
			);
		} finally {
			await runtime.dispose();
		}
		document.body.innerHTML = `<div id="app">${serverMarkup}</div>`;
		const serverFallback = document.querySelector(
			'[data-testid="hydrated-fallback"]'
		);
		const onError = vi.fn();

		mounted = await createApp(boundaryApp(createBoundary(onError))).hydrate(
			'#app'
		);
		await flushRenderer();

		expect(document.querySelector('[data-testid="hydrated-fallback"]')).toBe(
			serverFallback
		);
		expect(onError).toHaveBeenCalledOnce();
		expect(document.querySelector('[data-effuse-render-error]')).toBeNull();
	});
});
