// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import {
	getSignalDep,
	isSignal,
	readonlySignal,
	signal,
	unref,
} from '../../reactivity/signal.js';
import { isReadonly, readonly } from '../../reactivity/readonly.js';
import { reactive } from '../../reactivity/reactive.js';
import { watchEffect } from '../../effects/effect.js';
import {
	EFFUSE_NODE,
	CreateElementNode,
	type Component,
} from '../../render/node.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

describe('readonly over a signal', () => {
	it('is recognised as a signal', () => {
		const source = signal(1);

		expect(isSignal(readonly(source))).toBe(true);
		// The sibling that already did this is the reference.
		expect(isSignal(readonlySignal(source))).toBe(true);
	});

	it('unwraps through unref', () => {
		const source = signal(1);

		expect(unref(readonly(source) as never)).toBe(1);
	});

	it('exposes the source dependency', () => {
		const source = signal(1);

		expect(getSignalDep(readonly(source) as never)).toBe(getSignalDep(source));
	});

	it('reads through to the current value', () => {
		const source = signal(1);
		const view = readonly(source);

		expect(view.value).toBe(1);
		source.value = 7;
		expect(view.value).toBe(7);
	});

	it('drives an effect', () => {
		const source = signal(1);
		const view = readonly(source);
		const seen: number[] = [];

		const handle = watchEffect(() => {
			seen.push(view.value);
		});
		source.value = 5;
		handle.stop();

		expect(seen).toEqual([1, 5]);
	});

	it('refuses writes through the view', () => {
		const source = signal(1);
		const view = readonly(source) as unknown as { value: number };

		expect(() => {
			view.value = 99;
		}).toThrow();
		expect(source.value).toBe(1);
	});
});

describe('readonly over other targets', () => {
	it('still marks an object view readonly and blocks writes', () => {
		const target = reactive({ a: 1 });
		const view = readonly(target as never) as unknown as { a: number };

		expect(isReadonly(view)).toBe(true);
		expect(() => {
			view.a = 99;
		}).toThrow();
		expect((target as { a: number }).a).toBe(1);
	});

	it('returns a primitive unchanged', () => {
		expect(readonly(5 as never)).toBe(5);
	});
});

describe('readonly signal bound to the DOM', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('renders and updates with its source', async () => {
		const source = signal(1);
		const view = readonly(source);
		const App = define({
			script: () => ({}),
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'div',
					props: { id: 'target', title: view },
					children: ['x'] as never,
				}),
		}) as unknown as Component;

		const app = await createApp(App).mount('#app');
		await flushRenderer();
		expect(document.querySelector('#target')?.getAttribute('title')).toBe('1');

		source.value = 42;
		await flushRenderer();
		expect(document.querySelector('#target')?.getAttribute('title')).toBe('42');

		await app.unmount();
	});
});
