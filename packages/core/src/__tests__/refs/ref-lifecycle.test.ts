// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { createRef } from '../../refs/ref.js';
import { signal } from '../../reactivity/signal.js';
import { CreateElementNode, EFFUSE_NODE } from '../../render/node.js';
import { patchElementRef } from '../../services/dom-renderer/props.js';
import type { RefCallback, RefObject } from '../../refs/types.js';

type MountedApp = { unmount: () => Promise<void> };

const flush = async (): Promise<void> => {
	for (let index = 0; index < 5; index++) await Promise.resolve();
};

const appWithRef = (ref: RefObject | RefCallback) =>
	define({
		script: () => ({}),
		template: () =>
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'main',
				props: { ref },
				children: ['content'],
			}),
	});

describe('ref lifecycle across mount and unmount', () => {
	let mounted: MountedApp | undefined;

	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = undefined;
		document.body.replaceChildren();
	});

	it('releases the element from a ref object on unmount', async () => {
		const ref = createRef<HTMLElement>();
		mounted = await createApp(appWithRef(ref)).mount('#app');
		await flush();

		const element = ref.current;
		expect(element).toBeInstanceOf(HTMLElement);
		expect(element?.isConnected).toBe(true);

		await mounted.unmount();
		mounted = undefined;
		await flush();

		expect(ref.current).toBeNull();
		expect(element?.isConnected).toBe(false);
	});

	it('invokes a callback ref with null on unmount', async () => {
		const seen: (Element | null)[] = [];
		const callback = vi.fn((element: Element | null) => {
			seen.push(element);
		});

		mounted = await createApp(appWithRef(callback)).mount('#app');
		await flush();
		expect(seen[0]).toBeInstanceOf(HTMLElement);

		await mounted.unmount();
		mounted = undefined;
		await flush();

		expect(seen.at(-1)).toBeNull();
	});

	it('notifies ref subscribers when the element detaches', async () => {
		const ref = createRef<HTMLElement>();
		const seen: (Element | null)[] = [];
		const unsubscribe = ref.subscribe((element) => {
			seen.push(element);
		});

		mounted = await createApp(appWithRef(ref)).mount('#app');
		await flush();
		await mounted.unmount();
		mounted = undefined;
		await flush();

		unsubscribe();
		expect(seen[0]).toBeNull();
		expect(seen.at(-1)).toBeNull();
		expect(seen.some((element) => element instanceof HTMLElement)).toBe(true);
	});

	it('transfers object refs while preserving the patched DOM element', async () => {
		const selected = signal<'first' | 'second'>('first');
		const first = createRef<HTMLElement>();
		const second = createRef<HTMLElement>();
		const App = define({
			script: () => ({}),
			template: () => () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: { ref: selected.value === 'first' ? first : second },
					children: ['content'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flush();
		const element = first.current;
		expect(element).toBeInstanceOf(HTMLElement);

		selected.value = 'second';
		await flush();
		expect(document.querySelector('main')).toBe(element);
		expect(first.current).toBeNull();
		expect(second.current).toBe(element);

		await mounted.unmount();
		mounted = undefined;
		await flush();
		expect(second.current).toBeNull();
	});

	it('patches callback ref replacement, removal, and addition in place', async () => {
		const selected = signal<'first' | 'second' | 'none'>('none');
		const first = vi.fn<(element: Element | null) => void>();
		const second = vi.fn<(element: Element | null) => void>();
		const App = define({
			script: () => ({}),
			template: () => () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {
						ref:
							selected.value === 'first'
								? first
								: selected.value === 'second'
									? second
									: undefined,
					},
					children: ['content'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flush();
		const element = document.querySelector('main');
		expect(first).not.toHaveBeenCalled();

		selected.value = 'first';
		await flush();
		expect(first).toHaveBeenLastCalledWith(element);
		selected.value = 'second';
		await flush();
		expect(first).toHaveBeenLastCalledWith(null);
		expect(second).toHaveBeenLastCalledWith(element);
		selected.value = 'none';
		await flush();
		expect(second).toHaveBeenLastCalledWith(null);
		expect(document.querySelector('main')).toBe(element);

		selected.value = 'first';
		await flush();
		expect(first).toHaveBeenLastCalledWith(element);
		await mounted.unmount();
		mounted = undefined;
		await flush();
		expect(first).toHaveBeenLastCalledWith(null);
	});

	it('preserves a ref transfer triggered synchronously by a callback', () => {
		const element = document.createElement('main');
		const second = vi.fn<(element: Element | null) => void>();
		const first = vi.fn((value: Element | null) => {
			if (value) patchElementRef(element, second);
		});

		patchElementRef(element, first);
		expect(first.mock.calls).toEqual([[element], [null]]);
		expect(second).toHaveBeenLastCalledWith(element);

		patchElementRef(element, undefined);
		expect(second).toHaveBeenLastCalledWith(null);
	});

	it('recovers ownership after an attaching callback throws', () => {
		const element = document.createElement('main');
		const failing = vi.fn(() => {
			throw new Error('ref failed');
		});
		const recovered = vi.fn<(element: Element | null) => void>();

		expect(() => patchElementRef(element, failing)).toThrow('ref failed');
		expect(() => patchElementRef(element, recovered)).not.toThrow();
		expect(recovered).toHaveBeenLastCalledWith(element);

		patchElementRef(element, undefined);
		expect(recovered).toHaveBeenLastCalledWith(null);
	});
});
