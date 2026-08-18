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
	signal,
	unref,
} from '../../reactivity/signal.js';
import {
	computed,
	disposeComputed,
	writableComputed,
} from '../../reactivity/computed.js';
import { watchEffect } from '../../effects/effect.js';
import {
	EFFUSE_NODE,
	CreateElementNode,
	type Component,
} from '../../render/node.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 6; index++) await Promise.resolve();
};

/** A doubling view over `source`, writable back through halving. */
const doubled = (source: ReturnType<typeof signal<number>>) =>
	writableComputed({
		get: () => source.value * 2,
		set: (value: number) => {
			source.value = value / 2;
		},
	});

describe('writableComputed', () => {
	it('reads through and writes back', () => {
		const source = signal(1);
		const view = doubled(source);

		expect(view.value).toBe(2);
		view.value = 10;
		expect(source.value).toBe(5);
		expect(view.value).toBe(10);
	});

	it('is recognised as a signal', () => {
		const source = signal(1);

		expect(isSignal(doubled(source))).toBe(true);
	});

	it('unwraps through unref', () => {
		const source = signal(1);

		expect(unref(doubled(source) as never)).toBe(2);
	});

	it('exposes a dependency, like computed', () => {
		const source = signal(1);

		expect(getSignalDep(doubled(source) as never)).not.toBeNull();
		// Same shape as the read-only form, which is the reference here.
		expect(getSignalDep(computed(() => 1) as never)).not.toBeNull();
	});

	it('drives an effect when its source changes', () => {
		const source = signal(1);
		const view = doubled(source);
		const seen: number[] = [];

		const handle = watchEffect(() => {
			seen.push(view.value);
		});
		source.value = 5;
		handle.stop();

		expect(seen).toEqual([2, 10]);
	});

	it('releases its source when disposed', () => {
		const source = signal(1);
		const view = doubled(source);
		const handle = watchEffect(() => {
			void view.value;
		});
		expect(getSignalDep(source)?.subscriberCount).toBeGreaterThan(0);

		// Matching only `ComputedSignal` made this a silent no-op, since a
		// writable view wraps a computed rather than being one.
		disposeComputed(view as never);

		expect(getSignalDep(source)?.subscriberCount).toBe(0);
		handle.stop();
	});

	it('drives an effect when written through', () => {
		const source = signal(1);
		const view = doubled(source);
		const seen: number[] = [];

		const handle = watchEffect(() => {
			seen.push(view.value);
		});
		view.value = 8;
		handle.stop();

		expect(seen).toEqual([2, 8]);
		expect(source.value).toBe(4);
	});
});

describe('writableComputed bound to the DOM', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('renders its value and updates with its source', async () => {
		const source = signal(1);
		const view = doubled(source);
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
		expect(document.querySelector('#target')?.getAttribute('title')).toBe('2');

		source.value = 25;
		await flushRenderer();
		expect(document.querySelector('#target')?.getAttribute('title')).toBe('50');

		await app.unmount();
	});
});
