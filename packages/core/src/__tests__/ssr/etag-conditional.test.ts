/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createHandler } from '../../ssr/handler.js';
import { define } from '../../blueprint/define.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const Root = define({
	script: () => ({}),
	template: () =>
		CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'div',
			props: { id: 'app' },
			children: ['x'] as never,
		}),
}) as unknown as Component;

const handler = () => createHandler({ root: Root, layers: [] });

/** Renders are separated in time so a wall-clock stamp would differ. */
const tick = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, 3));

const etagOf = async (): Promise<string> => {
	const response = await handler()(new Request('http://localhost/'));
	return response.headers.get('ETag') as string;
};

const conditional = async (ifNoneMatch: string): Promise<Response> => {
	const h = handler();
	const first = await h(new Request('http://localhost/'));
	const etag = first.headers.get('ETag') as string;
	return h(
		new Request('http://localhost/', {
			headers: { 'If-None-Match': ifNoneMatch.replace('<etag>', etag) },
		})
	);
};

describe('ETag determinism', () => {
	it('is the same for two renders of the same content', async () => {
		// The hydration payload carried `timestamp: Date.now()`, so identical
		// content hashed differently every time and no 304 could ever fire.
		const first = await etagOf();
		await tick();

		expect(await etagOf()).toBe(first);
	});

	it('is the same across separate handler instances', async () => {
		const a = await etagOf();
		await tick();
		const b = await etagOf();

		expect(a).toBe(b);
		expect(a).toMatch(/^"[0-9a-f]+"$/);
	});

	it('still differs when the content differs', async () => {
		const other = createHandler({
			root: define({
				script: () => ({}),
				template: () =>
					CreateElementNode({
						[EFFUSE_NODE]: true,
						tag: 'div',
						props: { id: 'app' },
						children: ['different'] as never,
					}),
			}) as unknown as Component,
			layers: [],
		});
		const response = await other(new Request('http://localhost/'));

		expect(response.headers.get('ETag')).not.toBe(await etagOf());
	});

	it('does not carry a timestamp in the hydration payload', async () => {
		const response = await handler()(new Request('http://localhost/'));

		expect(await response.text()).not.toContain('"timestamp"');
	});
});

describe('If-None-Match', () => {
	it('answers 304 for the exact tag', async () => {
		const response = await conditional('<etag>');

		expect(response.status).toBe(304);
		expect(response.headers.get('ETag')).toBeTruthy();
		expect(await response.text()).toBe('');
	});

	it('answers 304 for a weak tag', async () => {
		// A proxy that compresses downgrades a strong ETag to weak; nginx does
		// this whenever gzip is on, and RFC 7232 specifies weak comparison here.
		const response = await conditional('W/<etag>');

		expect(response.status).toBe(304);
	});

	it('answers 304 when the tag appears in a list', async () => {
		const response = await conditional('"other", <etag>');

		expect(response.status).toBe(304);
	});

	it('answers 304 for a list with mixed weakness and spacing', async () => {
		const response = await conditional('W/"a","b",  <etag>');

		expect(response.status).toBe(304);
	});

	it('answers 304 for the wildcard', async () => {
		const response = await conditional('*');

		expect(response.status).toBe(304);
	});

	it('answers 200 for a tag that does not match', async () => {
		const response = await conditional('"nope"');

		expect(response.status).toBe(200);
		expect(await response.text()).toContain('<div');
	});

	it('answers 200 for a list of non-matching tags', async () => {
		const response = await conditional('"a", W/"b"');

		expect(response.status).toBe(200);
	});

	it('answers 200 when the header is absent', async () => {
		const response = await handler()(new Request('http://localhost/'));

		expect(response.status).toBe(200);
	});

	it('answers 200 for an empty header', async () => {
		const response = await conditional('');

		expect(response.status).toBe(200);
	});
});
