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
	CreateBlueprintNode,
	CreateElementNode,
	CreateListNode,
	EFFUSE_NODE,
} from '../../render/node.js';
import { getSignalDep, signal, type Signal } from '../../reactivity/signal.js';
import type { EffuseChild } from '../../render/node.js';

type MountedApp = { unmount: () => Promise<void> };

const flush = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

const subscribers = (source: Signal<string>): number =>
	getSignalDep(source)?.subscriberCount ?? -1;

const listApp = (bound: Signal<string>, extra: EffuseChild[] = []) =>
	define({
		script: () => ({}),
		template: () =>
			CreateListNode({
				[EFFUSE_NODE]: true,
				children: [
					CreateElementNode({
						[EFFUSE_NODE]: true,
						tag: 'span',
						props: { title: bound },
						children: ['item'],
					}),
					...extra,
				],
			}),
	});

describe('list deferred mount lifetime', () => {
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

	it('releases bindings on a normal mount and unmount', async () => {
		const bound = signal('a');
		mounted = await createApp(listApp(bound)).mount('#app');
		await flush();
		expect(subscribers(bound)).toBeGreaterThan(0);

		await mounted.unmount();
		mounted = undefined;
		await flush();

		expect(subscribers(bound)).toBe(0);
	});

	it('creates no binding when unmounted before the deferred mount', async () => {
		const bound = signal('a');
		mounted = await createApp(listApp(bound)).mount('#app');

		// No flush: the list mount is still queued when the app goes away.
		await mounted.unmount();
		mounted = undefined;
		await flush();

		expect(subscribers(bound)).toBe(0);
	});

	it('does not resurrect work after an early unmount', async () => {
		const bound = signal('a');
		mounted = await createApp(listApp(bound)).mount('#app');
		await mounted.unmount();
		mounted = undefined;
		await flush();

		bound.value = 'b';
		await flush();

		expect(subscribers(bound)).toBe(0);
		expect(document.querySelector('#app')?.innerHTML ?? '').toBe('');
	});

	it('releases sibling bindings when a list child fails to mount', async () => {
		const bound = signal('a');
		const Broken = define({
			script: () => ({}),
			template: () => {
				throw new Error('broken list child');
			},
		});

		mounted = await createApp(
			listApp(bound, [
				CreateBlueprintNode({
					[EFFUSE_NODE]: true,
					blueprint: Broken,
					props: {},
					portals: null,
				}),
			])
		).mount('#app');
		await flush();

		await mounted.unmount();
		mounted = undefined;
		await flush();

		expect(subscribers(bound)).toBe(0);
	});
});
