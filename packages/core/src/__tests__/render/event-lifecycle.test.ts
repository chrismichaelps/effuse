// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { signal } from '../../reactivity/signal.js';
import { CreateElementNode, EFFUSE_NODE } from '../../render/node.js';
import {
	clearElementEvents,
	patchElementEvent,
} from '../../services/dom-renderer/events.js';

type MountedApp = { unmount: () => Promise<void> };

const flush = async (): Promise<void> => {
	for (let index = 0; index < 5; index++) await Promise.resolve();
};

describe('patched event listener lifecycle (issue #517)', () => {
	let mounted: MountedApp | undefined;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(async () => {
		await mounted?.unmount();
		mounted = undefined;
		document.body.replaceChildren();
	});

	it('removes the latest replacement handler on unmount', async () => {
		const selected = signal<'first' | 'second'>('first');
		const first = vi.fn();
		const second = vi.fn();
		const App = define({
			script: () => ({}),
			template: () => () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'button',
					props: { onClick: selected.value === 'first' ? first : second },
					children: ['go'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flush();
		const element = document.querySelector('button')!;
		selected.value = 'second';
		await flush();
		element.dispatchEvent(new Event('click'));
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();

		await mounted.unmount();
		mounted = undefined;
		element.dispatchEvent(new Event('click'));
		expect(second).toHaveBeenCalledOnce();
	});

	it('patches listener addition and removal without replacing the element', async () => {
		const enabled = signal(false);
		const handler = vi.fn();
		const App = define({
			script: () => ({}),
			template: () => () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'button',
					props: enabled.value ? { onClick: handler } : {},
					children: ['go'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flush();
		const element = document.querySelector('button')!;
		enabled.value = true;
		await flush();
		element.dispatchEvent(new Event('click'));
		expect(handler).toHaveBeenCalledOnce();

		enabled.value = false;
		await flush();
		expect(document.querySelector('button')).toBe(element);
		element.dispatchEvent(new Event('click'));
		expect(handler).toHaveBeenCalledOnce();
	});

	it('cleans a listener added after mount when the element unmounts', async () => {
		const enabled = signal(false);
		const handler = vi.fn();
		const App = define({
			script: () => ({}),
			template: () => () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'button',
					props: enabled.value ? { onClick: handler } : {},
					children: ['go'],
				}),
		});

		mounted = await createApp(App).mount('#app');
		await flush();
		const element = document.querySelector('button')!;
		enabled.value = true;
		await flush();
		await mounted.unmount();
		mounted = undefined;

		element.dispatchEvent(new Event('click'));
		expect(handler).not.toHaveBeenCalled();
	});

	it('preserves listener options through replacement and cleanup', () => {
		const element = document.createElement('button');
		const add = vi.spyOn(element, 'addEventListener');
		const remove = vi.spyOn(element, 'removeEventListener');
		const options = { capture: true, passive: true };
		const first = vi.fn();
		const second = vi.fn();

		patchElementEvent(element, 'click', first, options);
		patchElementEvent(element, 'click', second);
		expect(remove).toHaveBeenCalledWith('click', first, options);
		expect(add).toHaveBeenLastCalledWith('click', second, options);

		clearElementEvents(element);
		expect(remove).toHaveBeenLastCalledWith('click', second, options);
	});
});
