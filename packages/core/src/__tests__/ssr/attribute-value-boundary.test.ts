// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const flushRenderer = async (): Promise<void> => {
	for (let index = 0; index < 8; index++) await Promise.resolve();
};

const node = (props: Record<string, unknown>) =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'div',
		props: { id: 'target', ...props },
		children: ['x'] as never,
	});

/** The `data-x` attribute the server writes, or null when it writes none. */
const serverAttr = async (value: unknown): Promise<string | null> => {
	const runtime = await createSSRRuntime([]);
	try {
		const html = renderToFragment(node({ 'data-x': value }) as never, runtime);
		if (!/\sdata-x[\s=>]/.test(html)) return null;
		return /data-x="([^"]*)"/.exec(html)?.[1] ?? '';
	} finally {
		await runtime.dispose();
	}
};

/** The same attribute after a client render. */
const clientAttr = async (value: unknown): Promise<string | null> => {
	const App = define({
		script: () => ({}),
		template: () => node({ 'data-x': value }),
	}) as unknown as Component;

	const app = await createApp(App).mount('#app');
	await flushRenderer();
	const element = document.querySelector('#target') as Element;
	const written = element.hasAttribute('data-x')
		? (element.getAttribute('data-x') ?? '')
		: null;
	await app.unmount();
	return written;
};

describe('attribute values across the render boundary', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		const host = document.createElement('div');
		host.id = 'app';
		document.body.append(host);
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	describe('values neither side should write', () => {
		// The server coerced anything with `String(...)`, so these reached the
		// HTML as "[object Object]", "1,2", and a locale-dependent date.
		const cases: [string, unknown][] = [
			['a plain object', { a: 1 }],
			['an array', [1, 2]],
			['a bigint', BigInt(7)],
			['a Date', new Date(0)],
			['a function result that is an object', { toString: () => 'x' }],
		];

		it.each(cases)('drops %s on both sides', async (_label, value) => {
			expect(await serverAttr(value)).toBeNull();
			expect(await clientAttr(value)).toBeNull();
		});
	});

	describe('values both sides should keep', () => {
		it('writes a string', async () => {
			expect(await serverAttr('S')).toBe('S');
			expect(await clientAttr('S')).toBe('S');
		});

		it('writes a number', async () => {
			expect(await serverAttr(5)).toBe('5');
			expect(await clientAttr(5)).toBe('5');
		});

		it('writes zero rather than treating it as absent', async () => {
			expect(await serverAttr(0)).toBe('0');
			expect(await clientAttr(0)).toBe('0');
		});

		it('writes an empty attribute for true', async () => {
			// The server writes it bare and the client writes `=""`; those are
			// the same attribute in HTML.
			expect(await serverAttr(true)).toBe('');
			expect(await clientAttr(true)).toBe('');
		});

		it('omits the attribute for false', async () => {
			expect(await serverAttr(false)).toBeNull();
			expect(await clientAttr(false)).toBeNull();
		});

		it('omits the attribute for null and undefined', async () => {
			expect(await serverAttr(null)).toBeNull();
			expect(await clientAttr(null)).toBeNull();
			expect(await serverAttr(undefined)).toBeNull();
			expect(await clientAttr(undefined)).toBeNull();
		});
	});

	describe('the dedicated branches keep their object handling', () => {
		it('still flattens a class object', async () => {
			const runtime = await createSSRRuntime([]);
			const html = renderToFragment(
				node({ class: { a: true, b: false } }) as never,
				runtime
			);
			await runtime.dispose();

			expect(html).toContain('class="a"');
		});

		it('still serializes a style object', async () => {
			const runtime = await createSSRRuntime([]);
			const html = renderToFragment(
				node({ style: { fontSize: '2px' } }) as never,
				runtime
			);
			await runtime.dispose();

			expect(html).toContain('font-size: 2px');
		});
	});

	it('does not make output depend on the machine that rendered it', async () => {
		// `String(new Date(0))` is timezone dependent, so coercing it put a
		// different string in the HTML on every differently-configured server.
		expect(await serverAttr(new Date(0))).toBeNull();
	});
});
