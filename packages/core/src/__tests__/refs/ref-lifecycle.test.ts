// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { createRef } from '../../refs/ref.js';
import { CreateElementNode, EFFUSE_NODE } from '../../render/node.js';
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
});
