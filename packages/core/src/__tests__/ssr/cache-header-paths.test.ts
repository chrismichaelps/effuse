/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { createHandler, createStreamingHandler } from '../../ssr/handler.js';
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

const Broken = define({
	script: () => {
		throw new Error('view exploded');
	},
	template: () =>
		CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'div',
			props: {},
			children: [] as never,
		}),
}) as unknown as Component;

const CACHED = {
	cacheSMaxAge: 3600,
	cacheStaleWhileRevalidate: 86400,
};

const cacheOf = async (
	make: typeof createHandler | typeof createStreamingHandler,
	config: Record<string, unknown> = CACHED
): Promise<string | null> => {
	const handler = make({ root: Root, layers: [], ...config } as never);
	const response = await handler(new Request('http://localhost/'));
	return response.headers.get('Cache-Control');
};

describe('the streaming handler honours the cache options', () => {
	it('sends the same Cache-Control as the string handler', async () => {
		// It takes the same HandlerConfig, so every cache option was accepted by
		// the type and silently discarded.
		expect(await cacheOf(createStreamingHandler)).toBe(
			await cacheOf(createHandler)
		);
	});

	it('sends the documented default when nothing is configured', async () => {
		expect(await cacheOf(createStreamingHandler, {})).toBe(
			'public, max-age=0, must-revalidate'
		);
	});

	it('honours a literal override', async () => {
		expect(
			await cacheOf(createStreamingHandler, { cacheControl: 'no-store' })
		).toBe('no-store');
	});

	it('honours no-store', async () => {
		expect(await cacheOf(createStreamingHandler, { cacheNoStore: true })).toBe(
			'no-store'
		);
	});

	it('does not send an ETag, which a stream cannot support', async () => {
		// The body is not known when the headers go out, so there is nothing to
		// hash. Saying so beats sending a wrong one.
		const handler = createStreamingHandler({
			root: Root,
			layers: [],
			...CACHED,
		} as never);
		const response = await handler(new Request('http://localhost/'));

		expect(response.headers.get('ETag')).toBeNull();
		expect(response.status).toBe(200);
	});
});

describe('the 304 carries the freshness of the 200 it stands in for', () => {
	const conditional = async (): Promise<Response> => {
		const handler = createHandler({
			root: Root,
			layers: [],
			...CACHED,
		} as never);
		const first = await handler(new Request('http://localhost/'));
		return handler(
			new Request('http://localhost/', {
				headers: { 'If-None-Match': first.headers.get('ETag') as string },
			})
		);
	};

	it('sends Cache-Control alongside the ETag', async () => {
		// Without it a shared cache learns the entry is still good but gets no
		// directive to refresh its lifetime with, so it revalidates again next
		// time and the s-maxage window never takes effect.
		const response = await conditional();

		expect(response.status).toBe(304);
		expect(response.headers.get('Cache-Control')).toBe(
			await cacheOf(createHandler)
		);
		expect(response.headers.get('ETag')).toBeTruthy();
	});

	it('still sends no body', async () => {
		expect(await (await conditional()).text()).toBe('');
	});
});

describe('error responses agree about storage', () => {
	it('the string handler refuses storage', async () => {
		const handler = createHandler({ root: Broken, layers: [] } as never);
		const response = await handler(new Request('http://localhost/'));

		expect(response.status).toBe(500);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it('the streaming handler refuses storage too', async () => {
		// Its 500 covers failures *before* the stream opens; once the body has
		// started the status is already sent, so a render throw surfaces in the
		// stream rather than as a 500. A throwing `transform` is the reachable
		// pre-stream failure.
		const handler = createStreamingHandler({
			root: Root,
			layers: [],
			...CACHED,
			transform: () => {
				throw new Error('transform exploded');
			},
		} as never);
		const response = await handler(new Request('http://localhost/'));
		const body = await response.text();

		expect(response.status).toBe(500);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(body).toContain('Error');
	});
});
